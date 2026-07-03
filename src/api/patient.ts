import { Router, Response } from 'express';
import { db } from '../db/index.ts';
import { users, doctors, appointments, patients, medicationReminders, medications, prescriptions, aiVisitSummaries } from '../db/schema.ts';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.ts';
import { analyzeSymptoms } from '../services/gemini.ts';
import { sendEmail, EmailTemplates } from '../services/email.ts';
import { createGoogleCalendarEvent } from '../services/calendar.ts';
import { eq, and } from 'drizzle-orm';

const router = Router();

// Secure all endpoints to Patient role (and admins)
router.use(requireAuth, requireRole(['patient', 'admin']));

/**
 * Load logged-in user's Patient Profile
 */
router.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await db.query.patients.findFirst({
      where: eq(patients.userId, req.user!.id),
    });

    if (!profile) {
      // Auto create patient profile if missing
      const [newProfile] = await db.insert(patients)
        .values({
          userId: req.user!.id,
          name: req.user!.name || 'Anonymous Patient',
        })
        .returning();
      return res.json(newProfile);
    }

    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve patient profile', details: error.message });
  }
});

/**
 * Update patient profile details
 */
router.put('/profile', async (req: AuthenticatedRequest, res: Response) => {
  const { phone, dob, medicalHistory, name, gender, bloodGroup } = req.body;

  try {
    const [updated] = await db.update(patients)
      .set({
        phone,
        dob,
        medicalHistory,
        name: name || undefined,
        gender: gender || undefined,
        bloodGroup: bloodGroup || undefined,
      })
      .where(eq(patients.userId, req.user!.id))
      .returning();

    res.json({ message: 'Profile updated successfully', profile: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update patient profile', details: error.message });
  }
});

/**
 * Search doctors / List active doctors
 */
router.get('/doctors', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await db.select({
      id: doctors.id,
      name: doctors.name,
      specialization: doctors.specialization,
      workingHours: doctors.workingHours,
      slotDuration: doctors.slotDuration,
      qualifications: doctors.qualifications,
      experienceYears: doctors.experienceYears,
      consultantFee: doctors.consultantFee,
    })
    .from(doctors);

    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to search doctors', details: error.message });
  }
});

/**
 * List patient's appointments and follow-ups
 */
router.get('/appointments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get patient ID
    const patProfile = await db.query.patients.findFirst({
      where: eq(patients.userId, req.user!.id),
    });

    if (!patProfile) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    const list = await db.select({
      id: appointments.id,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      doctorId: appointments.doctorId,
      doctorName: doctors.name,
      specialization: doctors.specialization,
    })
    .from(appointments)
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .where(eq(appointments.patientId, patProfile.id));

    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve appointments', details: error.message });
  }
});

/**
 * List active medications and schedule reminders for the patient
 */
router.get('/medications', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patProfile = await db.query.patients.findFirst({
      where: eq(patients.userId, req.user!.id),
    });

    if (!patProfile) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    // Load active prescribed medications
    const meds = await db.select({
      id: medications.id,
      name: medications.name,
      dosage: medications.dosage,
      frequency: medications.frequency,
      duration: medications.duration,
      reminderTime: medications.reminderTime,
      clinicalNotes: prescriptions.clinicalNotes,
      doctorName: doctors.name,
      date: appointments.date,
    })
    .from(medications)
    .innerJoin(prescriptions, eq(medications.prescriptionId, prescriptions.id))
    .innerJoin(appointments, eq(prescriptions.appointmentId, appointments.id))
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .where(eq(appointments.patientId, patProfile.id));

    res.json(meds);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load prescribed medications', details: error.message });
  }
});

export default router;
