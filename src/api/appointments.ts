import { Router, Response } from 'express';
import { db } from '../db/index.ts';
import { appointments, slotHolds, patients, doctors, users, aiVisitSummaries } from '../db/schema.ts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';
import { analyzeSymptoms } from '../services/gemini.ts';
import { sendEmail, EmailTemplates } from '../services/email.ts';
import { createGoogleCalendarEvent, deleteGoogleCalendarEvent } from '../services/calendar.ts';
import { eq, and, sql } from 'drizzle-orm';

const router = Router();

router.use(requireAuth);

/**
 * Endpoint to create a Temporary Slot Hold (Reservations)
 * Hold slot for 5 minutes.
 */
router.post('/hold', async (req: AuthenticatedRequest, res: Response) => {
  const { doctorId, date, startTime } = req.body;

  if (!doctorId || !date || !startTime) {
    return res.status(400).json({ error: 'Missing parameters: doctorId, date, startTime' });
  }

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Lock the Doctor-date-time-slot using safe FOR UPDATE postgres locking
      // This prevents race conditions under heavy concurrency
      const existingApp = await tx.execute(sql`
        SELECT id FROM ${appointments} 
        WHERE doctor_id = ${doctorId} 
          AND date = ${date} 
          AND start_time = ${startTime} 
          AND status = 'scheduled' 
        FOR UPDATE
      `);

      if (existingApp.rows.length > 0) {
        return { status: 409, error: 'Double Booking Blocked: Slot is already booked.' };
      }

      // Check for existing active slot holds by other users
      const now = new Date();
      const existingHold = await tx.execute(sql`
        SELECT id, user_id FROM ${slotHolds}
        WHERE doctor_id = ${doctorId}
          AND date = ${date}
          AND start_time = ${startTime}
          AND hold_until > ${now}
        FOR UPDATE
      `);

      if (existingHold.rows.length > 0) {
        const heldBy = existingHold.rows[0].user_id;
        if (heldBy !== req.user!.id) {
          return { status: 409, error: 'Slot is currently reserved by another patient.' };
        }
      }

      // 2. Set expiration to 5 minutes from now
      const holdUntil = new Date(Date.now() + 5 * 60 * 1000);

      // Create or update the hold
      const [hold] = await tx.insert(slotHolds)
        .values({
          doctorId,
          date,
          startTime,
          holdUntil,
          userId: req.user!.id,
        })
        .onConflictDoUpdate({
          target: slotHolds.id,
          set: { holdUntil },
        })
        .returning();

      return { status: 200, hold };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json({ message: 'Slot reserved successfully for 5 minutes', hold: result.hold });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to reserve slot', details: error.message });
  }
});

/**
 * Safe Appointment Booking with Double Booking Prevention (FOR UPDATE Transactions)
 */
router.post('/book', async (req: AuthenticatedRequest, res: Response) => {
  const { doctorId, date, startTime, endTime, chiefComplaint, googleAccessToken } = req.body;

  if (!doctorId || !date || !startTime || !endTime || !chiefComplaint) {
    return res.status(400).json({ error: 'Missing parameters: doctorId, date, startTime, endTime, chiefComplaint' });
  }

  try {
    // Look up patient profile
    const patProfile = await db.query.patients.findFirst({
      where: eq(patients.userId, req.user!.id),
    });

    if (!patProfile) {
      return res.status(404).json({ error: 'Patient profile not found. Please complete profile registration.' });
    }

    // Use transaction for secure atomic booking
    const result = await db.transaction(async (tx) => {
      // 1. Check double booking via row locking (FOR UPDATE)
      const existingApp = await tx.execute(sql`
        SELECT id FROM ${appointments} 
        WHERE doctor_id = ${doctorId} 
          AND date = ${date} 
          AND start_time = ${startTime} 
          AND status = 'scheduled' 
        FOR UPDATE
      `);

      if (existingApp.rows.length > 0) {
        return { status: 409, error: 'Double Booking Blocked: This slot has been booked by another user.' };
      }

      // 2. Double-check slot holds
      const now = new Date();
      const existingHold = await tx.execute(sql`
        SELECT id, user_id FROM ${slotHolds}
        WHERE doctor_id = ${doctorId}
          AND date = ${date}
          AND start_time = ${startTime}
          AND hold_until > ${now}
        FOR UPDATE
      `);

      if (existingHold.rows.length > 0) {
        const heldBy = existingHold.rows[0].user_id;
        if (heldBy !== req.user!.id) {
          return { status: 409, error: 'Double Booking Blocked: This slot is held by another user.' };
        }
      }

      // Clear any temporary holds of the booking user on this slot
      await tx.delete(slotHolds).where(
        and(
          eq(slotHolds.doctorId, doctorId),
          eq(slotHolds.date, date),
          eq(slotHolds.startTime, startTime),
          eq(slotHolds.userId, req.user!.id)
        )
      );

      // 3. Complete the Booking
      const [newAppointment] = await tx.insert(appointments)
        .values({
          doctorId,
          patientId: patProfile.id,
          date,
          startTime,
          endTime,
          status: 'scheduled',
        })
        .returning();

      return { status: 201, appointment: newAppointment };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    const booking = result.appointment;

    // Load Doctor and Patient details for Sync & Email triggers
    const details = await db.select({
      doctorName: doctors.name,
      patientName: patients.name,
      patientEmail: users.email,
    })
    .from(doctors)
    .innerJoin(appointments, eq(appointments.doctorId, doctors.id))
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(users, eq(patients.userId, users.id))
    .where(eq(appointments.id, booking.id));

    const { doctorName, patientName, patientEmail } = details[0];

    // 4. Sync to Google Calendar OAuth (Module 11)
    let calendarEventId = null;
    try {
      calendarEventId = await createGoogleCalendarEvent(googleAccessToken, req.user!.id, {
        summary: `Appointment with Dr. ${doctorName}`,
        description: `Healthcare Assessment. Symptom Complaint: ${chiefComplaint}`,
        startDateTime: `${date}T${startTime}:00Z`,
        endDateTime: `${date}T${endTime}:00Z`,
        patientEmail,
        doctorName,
      });

      // Store Google event ID to postgres
      await db.update(appointments)
        .set({ calendarEventId })
        .where(eq(appointments.id, booking.id));
    } catch (calError) {
      console.error('Failed to sync to Google Calendar. Booking remains successful.', calError);
    }

    // 5. Run Symptom analysis with Gemini Prompt 1 (Module 10)
    let aiStatus = 'completed';
    try {
      console.log('Analyzing symptom chief complaint using Gemini...');
      const analysis = await analyzeSymptoms(chiefComplaint);

      await db.insert(aiVisitSummaries)
        .values({
          appointmentId: booking.id,
          urgency: analysis.urgency,
          chiefComplaint: analysis.chiefComplaint,
          possibleCauses: analysis.possibleCauses,
          suggestedQuestions: analysis.suggestedQuestions,
          status: 'completed',
        });
    } catch (aiError) {
      console.error('Symptom analysis with Gemini failed. Registering as AI_PENDING:', aiError);
      aiStatus = 'AI_PENDING';

      // Record as pending so Background Worker retries it safely later!
      await db.insert(aiVisitSummaries)
        .values({
          appointmentId: booking.id,
          urgency: 'Medium', // default fallback
          chiefComplaint,
          possibleCauses: ['Symptom analysis pending...'],
          suggestedQuestions: [' Intake assessment pending...'],
          status: 'AI_PENDING',
        });
    }

    // 6. Send Confirmation Email (Module 12)
    try {
      const template = EmailTemplates.bookingConfirmation(patientName, doctorName, date, startTime);
      await sendEmail({
        recipient: patientEmail,
        subject: template.subject,
        body: template.body,
      });
    } catch (emailError) {
      console.error('Failed to send booking confirmation email:', emailError);
    }

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointment: booking,
      googleCalendarEventId: calendarEventId,
      aiTriageStatus: aiStatus,
      patientEmail,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to process booking', details: error.message });
  }
});

/**
 * Cancel Appointment Endpoint
 */
router.post('/:id/cancel', async (req: AuthenticatedRequest, res: Response) => {
  const appointmentId = parseInt(req.params.id);
  const { reason } = req.body;

  try {
    const details = await db.select({
      id: appointments.id,
      date: appointments.date,
      startTime: appointments.startTime,
      calendarEventId: appointments.calendarEventId,
      doctorName: doctors.name,
      patientName: patients.name,
      patientEmail: users.email,
    })
    .from(appointments)
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(users, eq(patients.userId, users.id))
    .where(eq(appointments.id, appointmentId));

    if (details.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const app = details[0];

    // Update status in PostgreSQL
    await db.update(appointments)
      .set({ status: 'cancelled' })
      .where(eq(appointments.id, appointmentId));

    // Delete calendar event
    if (app.calendarEventId) {
      await deleteGoogleCalendarEvent(null, req.user!.id, app.calendarEventId);
    }

    // Send Cancellation Email
    const template = EmailTemplates.bookingCancellation(app.patientName, app.doctorName, app.date, app.startTime, reason);
    await sendEmail({
      recipient: app.patientEmail,
      subject: template.subject,
      body: template.body,
    });

    res.json({ message: 'Appointment cancelled successfully and calendars synchronized' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to cancel appointment', details: error.message });
  }
});

export default router;
