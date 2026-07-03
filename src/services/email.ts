import { db } from '../db/index.ts';
import { emailLogs } from '../db/schema.ts';
import nodemailer from 'nodemailer';

interface EmailParams {
  recipient: string;
  subject: string;
  body: string;
}

// Lazy-loaded SMTP transporter
let transporter: any = null;

function getTransporter() {
  if (!transporter) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for 587
      auth: user && pass ? { user, pass } : undefined,
    });
  }
  return transporter;
}

/**
 * Triggers emails and logs them inside the database email_logs table.
 */
export async function sendEmail(params: EmailParams): Promise<boolean> {
  const { recipient, subject, body } = params;

  // Insert a pending log entry
  const [log] = await db.insert(emailLogs)
    .values({
      recipient,
      subject,
      body,
      status: 'pending',
    })
    .returning();

  try {
    const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER || 'vk.dubey2607@gmail.com';
    const mailTransporter = getTransporter();

    console.log(`=========================================`);
    console.log(`SENDING SMTP EMAIL TO: ${recipient}`);
    console.log(`FROM: ${smtpFrom}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`=========================================`);

    await mailTransporter.sendMail({
      from: smtpFrom,
      to: recipient,
      subject: subject,
      text: body,
    });

    console.log(`SMTP Email sent successfully to ${recipient}`);

    // Mark as sent
    await db.update(emailLogs)
      .set({ status: 'sent' })
      .where(eq(emailLogs.id, log.id));

    return true;
  } catch (error: any) {
    console.error(`Failed to send SMTP email to ${recipient}:`, error);

    // Mark as failed
    await db.update(emailLogs)
      .set({
        status: 'failed',
        error: error.message || String(error),
      })
      .where(eq(emailLogs.id, log.id));

    return false;
  }
}

// Quick helper to bypass circular Drizzle references
import { eq } from 'drizzle-orm';

/**
 * Templates for system notifications
 */
export const EmailTemplates = {
  bookingConfirmation: (patientName: string, doctorName: string, date: string, time: string) => ({
    subject: 'Appointment Booked Successfully - Healthcare Manager',
    body: `Dear ${patientName},

Your appointment with Dr. ${doctorName} has been booked successfully.

Date: ${date}
Time: ${time}

If you need to reschedule or cancel, please log into your patient portal.

Best regards,
The Healthcare Management Team`
  }),

  appointmentReminder: (patientName: string, doctorName: string, date: string, time: string) => ({
    subject: 'Upcoming Appointment Reminder - Healthcare Manager',
    body: `Dear ${patientName},

This is a reminder for your upcoming appointment with Dr. ${doctorName}.

Date: ${date}
Time: ${time}

Please join or arrive 10 minutes prior to your schedule.

Best regards,
The Healthcare Management Team`
  }),

  bookingCancellation: (patientName: string, doctorName: string, date: string, time: string, reason?: string) => ({
    subject: 'Appointment Cancelled - Healthcare Manager',
    body: `Dear ${patientName},

Your appointment with Dr. ${doctorName} on ${date} at ${time} has been cancelled.
${reason ? `Reason: ${reason}` : ''}

You can log into the patient portal to choose another slot.

Best regards,
The Healthcare Management Team`
  }),

  doctorLeaveNotification: (patientName: string, doctorName: string, date: string, time: string, suggestionText: string) => ({
    subject: 'Reschedule Required: Dr. Leave Notice - Healthcare Manager',
    body: `Dear ${patientName},

We regret to inform you that Dr. ${doctorName} has requested leave and is unavailable for your scheduled appointment on ${date} at ${time}.

${suggestionText}

We sincerely apologize for the inconvenience. Please log in to reschedule your visit.

Best regards,
The Healthcare Management Team`
  }),

  medicationReminder: (patientName: string, medicationName: string, dosage: string, frequency: string) => ({
    subject: `Daily Medication Reminder: ${medicationName} - Healthcare Manager`,
    body: `Dear ${patientName},

This is your automated reminder to take your prescribed medication:

Medication: ${medicationName}
Dosage: ${dosage}
Frequency: ${frequency}

Please remember to follow the instructions carefully.

Best regards,
The Healthcare Management Team`
  }),

  followUpReminder: (patientName: string, doctorName: string, advisory: string) => ({
    subject: 'Follow-up Care Notice - Healthcare Manager',
    body: `Dear ${patientName},

Dr. ${doctorName} has suggested a follow-up assessment for your recent clinical visit.

Advisory:
"${advisory}"

Please book a follow-up appointment via your patient dashboard.

Best regards,
The Healthcare Management Team`
  })
};
