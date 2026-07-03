import { Router, Response } from 'express';
import { db } from '../db/index.ts';
import { users, doctors, appointments, patients, prescriptions, medications, aiVisitSummaries, aiPostVisitSummaries } from '../db/schema.ts';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.ts';
import { summarizeVisitNotes } from '../services/gemini.ts';
import { sendEmail, EmailTemplates } from '../services/email.ts';
import { eq, and, sql } from 'drizzle-orm';

const router = Router();

// Secure all endpoints to Doctors (and admins for cross-checking)
router.use(requireAuth, requireRole(['doctor', 'admin']));

/**
 * Get active Doctor profile for logged-in user
 */
router.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doctorProfile = await db.query.doctors.findFirst({
      where: eq(doctors.userId, req.user!.id),
    });

    if (!doctorProfile) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    res.json(doctorProfile);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load doctor profile', details: error.message });
  }
});

/**
 * List Doctor's appointments
 */
router.get('/appointments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Look up doctor profile matching user
    const doctorProfile = await db.query.doctors.findFirst({
      where: eq(doctors.userId, req.user!.id),
    });

    if (!doctorProfile) {
      return res.status(404).json({ error: 'Doctor profile not found for authenticated user' });
    }

    const list = await db.select({
      id: appointments.id,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      patientId: appointments.patientId,
      patientName: patients.name,
      patientDob: patients.dob,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .where(eq(appointments.doctorId, doctorProfile.id));

    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load appointments', details: error.message });
  }
});

/**
 * Get a specific patient's medical history & previous consult summaries
 */
router.get('/patients/:id/history', async (req: AuthenticatedRequest, res: Response) => {
  const patientId = parseInt(req.params.id);

  try {
    const patientProfile = await db.query.patients.findFirst({
      where: eq(patients.id, patientId),
    });

    if (!patientProfile) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    // Get previous appointments with completed prescriptions and AI summaries
    const pastVisits = await db.select({
      id: appointments.id,
      date: appointments.date,
      status: appointments.status,
      clinicalNotes: prescriptions.clinicalNotes,
      aiSummary: aiPostVisitSummaries.summary,
      aiPrecautions: aiPostVisitSummaries.precautions,
    })
    .from(appointments)
    .leftJoin(prescriptions, eq(appointments.id, prescriptions.appointmentId))
    .leftJoin(aiPostVisitSummaries, eq(appointments.id, aiPostVisitSummaries.appointmentId))
    .where(
      and(
        eq(appointments.patientId, patientId),
        eq(appointments.status, 'completed')
      )
    );

    res.json({
      patient: patientProfile,
      history: pastVisits,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve patient history', details: error.message });
  }
});

/**
 * Get pre-visit AI symptom summary for an appointment
 */
router.get('/appointments/:id/triage', async (req: AuthenticatedRequest, res: Response) => {
  const appointmentId = parseInt(req.params.id);

  try {
    const triage = await db.query.aiVisitSummaries.findFirst({
      where: eq(aiVisitSummaries.appointmentId, appointmentId),
    });

    if (!triage) {
      return res.status(404).json({ error: 'Pre-visit AI symptom assessment not found for this appointment' });
    }

    res.json(triage);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load triage data', details: error.message });
  }
});

/**
 * Write Clinical Notes & Prescriptions + Auto-generate AI Patient Summary (Gemini Prompt 2)
 * Core business rule: "If Gemini fails, booking/notes must continue. Store status AI_PENDING. Retry later using Celery."
 */
router.post('/appointments/:id/prescribe', async (req: AuthenticatedRequest, res: Response) => {
  const appointmentId = parseInt(req.params.id);
  const { clinicalNotes, medicationsList } = req.body; // medicationsList: [{ name, dosage, frequency, duration, reminderTime }]

  if (!clinicalNotes) {
    return res.status(400).json({ error: 'Clinical notes are required' });
  }

  try {
    // 1. Mark appointment as completed
    await db.update(appointments)
      .set({ status: 'completed' })
      .where(eq(appointments.id, appointmentId));

    // 2. Insert Prescription
    const [presc] = await db.insert(prescriptions)
      .values({
        appointmentId,
        clinicalNotes,
      })
      .onConflictDoUpdate({
        target: prescriptions.appointmentId,
        set: { clinicalNotes },
      })
      .returning();

    // 3. Insert Medications if present
    const medsSaved = [];
    if (medicationsList && Array.isArray(medicationsList)) {
      // Clear existing medications for this prescription to prevent duplicates
      await db.delete(medications).where(eq(medications.prescriptionId, presc.id));

      for (const med of medicationsList) {
        const [saved] = await db.insert(medications)
          .values({
            prescriptionId: presc.id,
            name: med.name,
            dosage: med.dosage,
            frequency: med.frequency,
            duration: med.duration,
            reminderTime: med.reminderTime,
          })
          .returning();
        medsSaved.push(saved);
      }
    }

    // 4. Try AI note summarization (Gemini Prompt 2)
    let aiSummarySaved = null;
    let aiStatus = 'completed';

    const medsText = medsSaved.map(m => `${m.name} (${m.dosage}, ${m.frequency})`).join(', ') || 'None prescribed';

    try {
      console.log('Generating patient post-visit summary using Google Gemini...');
      const summaryResult = await summarizeVisitNotes(clinicalNotes, medsText);

      // Save success
      const [savedSummary] = await db.insert(aiPostVisitSummaries)
        .values({
          appointmentId,
          summary: summaryResult.summary,
          medicationSchedule: summaryResult.medicationSchedule,
          precautions: summaryResult.precautions,
          followUpAdvice: summaryResult.followUpAdvice,
          status: 'completed',
        })
        .onConflictDoUpdate({
          target: aiPostVisitSummaries.appointmentId,
          set: {
            summary: summaryResult.summary,
            medicationSchedule: summaryResult.medicationSchedule,
            precautions: summaryResult.precautions,
            followUpAdvice: summaryResult.followUpAdvice,
            status: 'completed'
          }
        })
        .returning();

      aiSummarySaved = savedSummary;

      // 5. Trigger Follow-up Email if advice exists
      const patientContact = await db.select({
        patientEmail: users.email,
        patientName: patients.name,
        doctorName: doctors.name,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(users, eq(patients.userId, users.id))
      .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
      .where(eq(appointments.id, appointmentId));

      if (patientContact.length > 0) {
        const { patientEmail, patientName, doctorName } = patientContact[0];
        const advisoryText = `Follow-up recommendation: ${summaryResult.followUpAdvice?.timeframe || 'as suggested'}. Precautions to notice: ${summaryResult.precautions?.join(', ') || 'none'}`;
        const emailContent = EmailTemplates.followUpReminder(patientName, doctorName, advisoryText);

        await sendEmail({
          recipient: patientEmail,
          subject: emailContent.subject,
          body: emailContent.body,
        });
      }

    } catch (aiError: any) {
      console.error('Gemini post-visit summary generation failed. Saving as AI_PENDING for background retry:', aiError);
      aiStatus = 'AI_PENDING';

      // Record state as AI_PENDING to satisfy graceful failure & Celery retry requirement!
      const [savedSummary] = await db.insert(aiPostVisitSummaries)
        .values({
          appointmentId,
          summary: 'Processing notes, summary will be available shortly...',
          medicationSchedule: {},
          precautions: [],
          followUpAdvice: {},
          status: 'AI_PENDING',
        })
        .onConflictDoUpdate({
          target: aiPostVisitSummaries.appointmentId,
          set: { status: 'AI_PENDING' }
        })
        .returning();

      aiSummarySaved = savedSummary;
    }

    res.json({
      message: 'Consult notes and prescription recorded successfully',
      prescription: presc,
      medications: medsSaved,
      aiSummary: aiSummarySaved,
      aiSyncStatus: aiStatus,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to record medical consult data', details: error.message });
  }
});

export default router;
