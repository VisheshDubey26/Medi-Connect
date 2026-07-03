import { Router, Response } from 'express';
import { db } from '../db/index.ts';
import { users, doctors, appointments, doctorLeaves, patients } from '../db/schema.ts';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.ts';
import { sendEmail, EmailTemplates } from '../services/email.ts';
import { deleteGoogleCalendarEvent } from '../services/calendar.ts';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

const router = Router();

// Secure all endpoints to Admin role
router.use(requireAuth, requireRole(['admin']));

/**
 * CRUD: List all doctors with their profiles
 */
router.get('/doctors', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await db.select({
      id: doctors.id,
      userId: doctors.userId,
      name: doctors.name,
      specialization: doctors.specialization,
      workingHours: doctors.workingHours,
      slotDuration: doctors.slotDuration,
      email: users.email,
    })
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id));

    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve doctors', details: error.message });
  }
});

/**
 * CRUD: Create/Add a new doctor
 */
router.post('/doctors', async (req: AuthenticatedRequest, res: Response) => {
  const { email, name, specialization, workingHours, slotDuration, uid } = req.body;

  if (!email || !name || !specialization) {
    return res.status(400).json({ error: 'Missing required parameters: email, name, specialization' });
  }

  try {
    // 1. Create/get User in database
    const [user] = await db.insert(users)
      .values({
        uid: uid || `doctor_${Date.now()}`, // fallback if auth is mock
        email,
        role: 'doctor',
        name,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { role: 'doctor', name },
      })
      .returning();

    // 2. Create Doctor profile
    const [doctorProfile] = await db.insert(doctors)
      .values({
        userId: user.id,
        name,
        specialization,
        workingHours: workingHours || { start: "09:00", end: "17:00", days: [1, 2, 3, 4, 5] },
        slotDuration: slotDuration || 30,
      })
      .onConflictDoUpdate({
        target: doctors.userId,
        set: { specialization, workingHours, slotDuration },
      })
      .returning();

    res.status(201).json({ message: 'Doctor created successfully', doctor: doctorProfile, user });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create doctor', details: error.message });
  }
});

/**
 * CRUD: Update a doctor's profile
 */
router.put('/doctors/:id', async (req: AuthenticatedRequest, res: Response) => {
  const doctorId = parseInt(req.params.id);
  const { name, specialization, workingHours, slotDuration } = req.body;

  try {
    const [updated] = await db.update(doctors)
      .set({
        name,
        specialization,
        workingHours,
        slotDuration,
      })
      .where(eq(doctors.id, doctorId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    res.json({ message: 'Doctor updated successfully', doctor: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update doctor', details: error.message });
  }
});

/**
 * Manage Leaves & Handle Collisions
 * Admin marks a leave.
 * Core Business Logic: "If appointments exist: Notify patients, Delete calendar events, Suggest nearest slot."
 */
router.post('/leaves', async (req: AuthenticatedRequest, res: Response) => {
  const { doctorId, startDate, endDate, reason } = req.body;

  if (!doctorId || !startDate || !endDate) {
    return res.status(400).json({ error: 'Missing required parameters: doctorId, startDate, endDate' });
  }

  try {
    // 1. Record the Leave
    const [leave] = await db.insert(doctorLeaves)
      .values({
        doctorId,
        startDate,
        endDate,
        reason,
        notified: 0,
      })
      .returning();

    // 2. Find appointments during the leave window (inclusive)
    const activeAppointments = await db.select({
      id: appointments.id,
      date: appointments.date,
      startTime: appointments.startTime,
      calendarEventId: appointments.calendarEventId,
      patientId: appointments.patientId,
      patientName: patients.name,
      patientEmail: users.email,
      doctorName: doctors.name,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(users, eq(patients.userId, users.id))
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .where(
      and(
        eq(appointments.doctorId, doctorId),
        eq(appointments.status, 'scheduled'),
        gte(appointments.date, startDate),
        lte(appointments.date, endDate)
      )
    );

    let notifyCount = 0;

    for (const app of activeAppointments) {
      // a. Mark appointment as cancelled
      await db.update(appointments)
        .set({ status: 'cancelled' })
        .where(eq(appointments.id, app.id));

      // b. Delete calendar event
      if (app.calendarEventId) {
        await deleteGoogleCalendarEvent(null, req.user!.id, app.calendarEventId);
      }

      // c. Calculate Suggestion alternate slot (e.g., first available working day after leave)
      const nextDate = new Date(endDate);
      nextDate.setDate(nextDate.getDate() + 1);
      const suggestedDate = nextDate.toISOString().split('T')[0];
      const suggestionText = `We suggest booking your rescheduled appointment on or after ${suggestedDate} when Dr. ${app.doctorName} returns to active schedule.`;

      // d. Notify patient via email
      const template = EmailTemplates.doctorLeaveNotification(
        app.patientName,
        app.doctorName,
        app.date,
        app.startTime,
        suggestionText
      );

      await sendEmail({
        recipient: app.patientEmail,
        subject: template.subject,
        body: template.body,
      });

      notifyCount++;
    }

    // Update leave notified count
    await db.update(doctorLeaves)
      .set({ notified: 1 })
      .where(eq(doctorLeaves.id, leave.id));

    res.json({
      message: 'Leave recorded and affected patient schedules synchronized successfully',
      leave,
      appointmentsCancelled: activeAppointments.length,
      patientsNotified: notifyCount,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to record doctor leave', details: error.message });
  }
});

/**
 * Dashboard Analytics
 */
router.get('/dashboard-stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const totalDoctors = await db.select({ count: sql<number>`count(*)` }).from(doctors);
    const totalPatients = await db.select({ count: sql<number>`count(*)` }).from(patients);
    const totalAppointments = await db.select({ count: sql<number>`count(*)` }).from(appointments);
    const completedApps = await db.select({ count: sql<number>`count(*)` }).from(appointments).where(eq(appointments.status, 'completed'));
    const cancelledApps = await db.select({ count: sql<number>`count(*)` }).from(appointments).where(eq(appointments.status, 'cancelled'));

    // Specializations breakdown
    const specBreakdown = await db.select({
      specialization: doctors.specialization,
      count: sql<number>`count(*)`
    })
    .from(doctors)
    .groupBy(doctors.specialization);

    res.json({
      summary: {
        doctors: totalDoctors[0]?.count || 0,
        patients: totalPatients[0]?.count || 0,
        appointments: totalAppointments[0]?.count || 0,
        completed: completedApps[0]?.count || 0,
        cancelled: cancelledApps[0]?.count || 0,
      },
      specializations: specBreakdown,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to compute dashboard stats', details: error.message });
  }
});

export default router;
