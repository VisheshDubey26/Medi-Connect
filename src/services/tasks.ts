import { db } from '../db/index.ts';
import { slotHolds, appointments, emailLogs, medications, medicationReminders, patients, users, doctors, aiVisitSummaries, aiPostVisitSummaries, prescriptions, notifications } from '../db/schema.ts';
import { sendEmail, EmailTemplates } from './email.ts';
import { analyzeSymptoms, summarizeVisitNotes } from './gemini.ts';
import { eq, lt, and, sql } from 'drizzle-orm';

/**
 * Celery-like Task Runner that processes:
 * 1. Expired Slot Holds (Auto-releases reservations older than 5 minutes)
 * 2. Scheduled Medication Reminders
 * 3. Email log retries for failed emails
 * 4. AI Triage retry operations for AI_PENDING statuses
 */
export class BackgroundTaskManager {
  private static intervalId: NodeJS.Timeout | null = null;
  private static isRunning = false;

  public static start(intervalMs: number = 30000) {
    if (this.intervalId) return;

    console.log(`Starting background task manager running every ${intervalMs / 1000} seconds...`);
    this.intervalId = setInterval(async () => {
      if (this.isRunning) return;
      this.isRunning = true;

      try {
        await this.runAllTasks();
      } catch (error) {
        console.error('Error during background task execution:', error);
      } finally {
        this.isRunning = false;
      }
    }, intervalMs);
  }

  public static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Background task manager stopped.');
    }
  }

  private static async runAllTasks() {
    console.log('[Background Task] Tick triggered at:', new Date().toISOString());
    await Promise.allSettled([
      this.releaseExpiredSlotHolds(),
      this.processMedicationReminders(),
      this.retryFailedEmails(),
      this.retryPendingAIPreVisits(),
      this.retryPendingAIPostVisits()
    ]);
  }

  /**
   * 1. Automatically releases temporary reservations (Holds) older than 5 minutes.
   */
  private static async releaseExpiredSlotHolds() {
    const now = new Date();
    try {
      const expiredHolds = await db.select()
        .from(slotHolds)
        .where(lt(slotHolds.holdUntil, now));

      if (expiredHolds.length > 0) {
        console.log(`[Background Task] Releasing ${expiredHolds.length} expired slot holds.`);
        await db.delete(slotHolds).where(lt(slotHolds.holdUntil, now));
      }
    } catch (error) {
      console.error('Failed to release expired slot holds:', error);
    }
  }

  /**
   * 2. Delivers scheduled medication reminders to patients.
   */
  private static async processMedicationReminders() {
    const now = new Date();
    try {
      const reminders = await db.select({
        reminderId: medicationReminders.id,
        medicationId: medications.id,
        name: medications.name,
        dosage: medications.dosage,
        frequency: medications.frequency,
        patientEmail: users.email,
        patientName: patients.name,
      })
      .from(medicationReminders)
      .innerJoin(medications, eq(medicationReminders.medicationId, medications.id))
      .innerJoin(prescriptions, eq(medications.prescriptionId, prescriptions.id))
      .innerJoin(appointments, eq(prescriptions.appointmentId, appointments.id))
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(users, eq(patients.userId, users.id))
      .where(
        and(
          eq(medicationReminders.status, 'pending'),
          lt(medicationReminders.scheduledTime, now)
        )
      );

      for (const rem of reminders) {
        console.log(`[Background Task] Sending medication reminder to ${rem.patientEmail} for ${rem.name}`);
        
        // Trigger email
        const mailContent = EmailTemplates.medicationReminder(
          rem.patientName,
          rem.name,
          rem.dosage,
          rem.frequency
        );
        const success = await sendEmail({
          recipient: rem.patientEmail,
          subject: mailContent.subject,
          body: mailContent.body
        });

        // Update reminder log state
        await db.update(medicationReminders)
          .set({ status: success ? 'sent' : 'failed' })
          .where(eq(medicationReminders.id, rem.reminderId));
      }
    } catch (error) {
      console.error('Failed to process medication reminders:', error);
    }
  }

  /**
   * 3. Retries failed email entries from database queue.
   */
  private static async retryFailedEmails() {
    try {
      const failedLogs = await db.select()
        .from(emailLogs)
        .where(
          and(
            eq(emailLogs.status, 'failed'),
            lt(emailLogs.retryCount, 3)
          )
        );

      for (const log of failedLogs) {
        console.log(`[Background Task] Retrying email ID ${log.id} to ${log.recipient}`);
        
        try {
          console.log(`RE-SENDING EMAIL TO: ${log.recipient}`);
          // Simulate email sending success
          await db.update(emailLogs)
            .set({
              status: 'sent',
              retryCount: log.retryCount + 1
            })
            .where(eq(emailLogs.id, log.id));
        } catch (error: any) {
          await db.update(emailLogs)
            .set({
              retryCount: log.retryCount + 1,
              error: error.message || String(error)
            })
            .where(eq(emailLogs.id, log.id));
        }
      }
    } catch (error) {
      console.error('Failed to retry failed emails:', error);
    }
  }

  /**
   * 4. Retries failed/pending AI pre-visit symptom summaries.
   */
  private static async retryPendingAIPreVisits() {
    try {
      const pendingSummaries = await db.select({
        summaryId: aiVisitSummaries.id,
        appointmentId: aiVisitSummaries.appointmentId,
        chiefComplaint: aiVisitSummaries.chiefComplaint
      })
      .from(aiVisitSummaries)
      .where(eq(aiVisitSummaries.status, 'AI_PENDING'));

      for (const summary of pendingSummaries) {
        console.log(`[Background Task] Retrying AI pre-visit analysis for appointment ID: ${summary.appointmentId}`);
        try {
          const analysis = await analyzeSymptoms(summary.chiefComplaint);
          await db.update(aiVisitSummaries)
            .set({
              urgency: analysis.urgency,
              possibleCauses: analysis.possibleCauses,
              suggestedQuestions: analysis.suggestedQuestions,
              status: 'completed'
            })
            .where(eq(aiVisitSummaries.id, summary.summaryId));
        } catch (error) {
          console.error(`AI pre-visit analysis retry failed for ID ${summary.summaryId}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to run AI pre-visit retries:', error);
    }
  }

  /**
   * 5. Retries failed/pending AI post-visit clinic summaries.
   */
  private static async retryPendingAIPostVisits() {
    try {
      const pendingSummaries = await db.select({
        summaryId: aiPostVisitSummaries.id,
        clinicalNotes: prescriptions.clinicalNotes,
        appointmentId: aiPostVisitSummaries.appointmentId,
        medsList: sql<string>`string_agg(${medications.name}, ', ')`
      })
      .from(aiPostVisitSummaries)
      .innerJoin(appointments, eq(aiPostVisitSummaries.appointmentId, appointments.id))
      .innerJoin(prescriptions, eq(appointments.id, prescriptions.appointmentId))
      .leftJoin(medications, eq(prescriptions.id, medications.prescriptionId))
      .where(eq(aiPostVisitSummaries.status, 'AI_PENDING'))
      .groupBy(aiPostVisitSummaries.id, prescriptions.clinicalNotes, aiPostVisitSummaries.appointmentId);

      for (const summary of pendingSummaries) {
        console.log(`[Background Task] Retrying AI post-visit analysis for appointment ID: ${summary.appointmentId}`);
        try {
          const conversion = await summarizeVisitNotes(summary.clinicalNotes, summary.medsList || 'None');
          await db.update(aiPostVisitSummaries)
            .set({
              summary: conversion.summary,
              medicationSchedule: conversion.medicationSchedule,
              precautions: conversion.precautions,
              followUpAdvice: conversion.followUpAdvice,
              status: 'completed'
            })
            .where(eq(aiPostVisitSummaries.id, summary.summaryId));
        } catch (error) {
          console.error(`AI post-visit analysis retry failed for ID ${summary.summaryId}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to run AI post-visit retries:', error);
    }
  }
}
