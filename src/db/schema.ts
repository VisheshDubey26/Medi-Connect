import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, jsonb, varchar } from 'drizzle-orm/pg-core';

// 1. Users Table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull().unique(),
  role: varchar('role', { length: 20 }).default('patient').notNull(), // admin, doctor, patient
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Doctors Table
export const doctors = pgTable('doctors', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  name: text('name').notNull(),
  specialization: varchar('specialization', { length: 100 }).notNull(),
  qualifications: text('qualifications'),
  experienceYears: integer('experience_years'),
  consultantFee: integer('consultant_fee'),
  workingHours: jsonb('working_hours').default({
    start: "09:00",
    end: "17:00",
    days: [1, 2, 3, 4, 5] // Monday-Friday
  }).notNull(),
  slotDuration: integer('slot_duration').default(30).notNull(), // in minutes
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Patients Table
export const patients = pgTable('patients', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  name: text('name').notNull(),
  phone: varchar('phone', { length: 20 }),
  dob: varchar('dob', { length: 20 }), // YYYY-MM-DD
  gender: varchar('gender', { length: 20 }),
  bloodGroup: varchar('blood_group', { length: 20 }),
  medicalHistory: text('medical_history'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Appointments Table
export const appointments = pgTable('appointments', {
  id: serial('id').primaryKey(),
  doctorId: integer('doctor_id')
    .references(() => doctors.id, { onDelete: 'cascade' })
    .notNull(),
  patientId: integer('patient_id')
    .references(() => patients.id, { onDelete: 'cascade' })
    .notNull(),
  date: varchar('date', { length: 20 }).notNull(), // YYYY-MM-DD
  startTime: varchar('start_time', { length: 10 }).notNull(), // HH:MM
  endTime: varchar('end_time', { length: 10 }).notNull(), // HH:MM
  status: varchar('status', { length: 20 }).default('scheduled').notNull(), // scheduled, completed, cancelled, pending_retry
  calendarEventId: text('calendar_event_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Slot Holds Table (Temporary Reservation)
export const slotHolds = pgTable('slot_holds', {
  id: serial('id').primaryKey(),
  doctorId: integer('doctor_id')
    .references(() => doctors.id, { onDelete: 'cascade' })
    .notNull(),
  date: varchar('date', { length: 20 }).notNull(), // YYYY-MM-DD
  startTime: varchar('start_time', { length: 10 }).notNull(), // HH:MM
  holdUntil: timestamp('hold_until').notNull(), // Current time + 5 minutes
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Doctor Leaves Table
export const doctorLeaves = pgTable('doctor_leaves', {
  id: serial('id').primaryKey(),
  doctorId: integer('doctor_id')
    .references(() => doctors.id, { onDelete: 'cascade' })
    .notNull(),
  startDate: varchar('start_date', { length: 20 }).notNull(), // YYYY-MM-DD
  endDate: varchar('end_date', { length: 20 }).notNull(), // YYYY-MM-DD
  reason: text('reason'),
  notified: integer('notified').default(0).notNull(), // 0 = false, 1 = true
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Prescriptions Table
export const prescriptions = pgTable('prescriptions', {
  id: serial('id').primaryKey(),
  appointmentId: integer('appointment_id')
    .references(() => appointments.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  clinicalNotes: text('clinical_notes').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. Medications Table
export const medications = pgTable('medications', {
  id: serial('id').primaryKey(),
  prescriptionId: integer('prescription_id')
    .references(() => prescriptions.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  dosage: varchar('dosage', { length: 100 }).notNull(), // e.g. "500mg"
  frequency: varchar('frequency', { length: 100 }).notNull(), // e.g. "Once daily"
  duration: varchar('duration', { length: 50 }).notNull(), // e.g. "7 days"
  reminderTime: varchar('reminder_time', { length: 10 }), // e.g. "08:00"
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. Medication Reminders Table
export const medicationReminders = pgTable('medication_reminders', {
  id: serial('id').primaryKey(),
  medicationId: integer('medication_id')
    .references(() => medications.id, { onDelete: 'cascade' })
    .notNull(),
  scheduledTime: timestamp('scheduled_time').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, sent, failed
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. Notifications Table
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  status: varchar('status', { length: 20 }).default('unread').notNull(), // unread, read
  channel: varchar('channel', { length: 20 }).default('in_app').notNull(), // in_app, email
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 11. Email Logs Table
export const emailLogs = pgTable('email_logs', {
  id: serial('id').primaryKey(),
  recipient: text('recipient').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, sent, failed
  error: text('error'),
  retryCount: integer('retry_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. AI Visit Summaries (Pre-Visit symptom summary)
export const aiVisitSummaries = pgTable('ai_visit_summaries', {
  id: serial('id').primaryKey(),
  appointmentId: integer('appointment_id')
    .references(() => appointments.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  urgency: varchar('urgency', { length: 20 }).notNull(), // High, Medium, Low
  chiefComplaint: text('chief_complaint').notNull(),
  possibleCauses: jsonb('possible_causes').notNull(), // array of strings
  suggestedQuestions: jsonb('suggested_questions').notNull(), // array of strings
  status: varchar('status', { length: 20 }).default('completed').notNull(), // completed, AI_PENDING
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. AI Post Visit Summaries
export const aiPostVisitSummaries = pgTable('ai_post_visit_summaries', {
  id: serial('id').primaryKey(),
  appointmentId: integer('appointment_id')
    .references(() => appointments.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  summary: text('summary').notNull(),
  medicationSchedule: jsonb('medication_schedule').notNull(), // structured scheduler
  precautions: jsonb('precautions').notNull(), // array of strings
  followUpAdvice: jsonb('follow_up_advice').notNull(),
  status: varchar('status', { length: 20 }).default('completed').notNull(), // completed, AI_PENDING
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 14. Audit Logs Table
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});


// RELATIONS
export const usersRelations = relations(users, ({ one, many }) => ({
  doctorProfile: one(doctors, {
    fields: [users.id],
    references: [doctors.userId]
  }),
  patientProfile: one(patients, {
    fields: [users.id],
    references: [patients.userId]
  }),
  notifications: many(notifications),
  auditLogs: many(auditLogs)
}));

export const doctorsRelations = relations(doctors, ({ one, many }) => ({
  user: one(users, {
    fields: [doctors.userId],
    references: [users.id]
  }),
  appointments: many(appointments),
  leaves: many(doctorLeaves),
  slotHolds: many(slotHolds)
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  user: one(users, {
    fields: [patients.userId],
    references: [users.id]
  }),
  appointments: many(appointments)
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  doctor: one(doctors, {
    fields: [appointments.doctorId],
    references: [doctors.id]
  }),
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id]
  }),
  prescription: one(prescriptions, {
    fields: [appointments.id],
    references: [prescriptions.appointmentId]
  }),
  aiVisitSummary: one(aiVisitSummaries, {
    fields: [appointments.id],
    references: [aiVisitSummaries.appointmentId]
  }),
  aiPostVisitSummary: one(aiPostVisitSummaries, {
    fields: [appointments.id],
    references: [aiPostVisitSummaries.appointmentId]
  })
}));

export const prescriptionsRelations = relations(prescriptions, ({ one, many }) => ({
  appointment: one(appointments, {
    fields: [prescriptions.appointmentId],
    references: [appointments.id]
  }),
  medications: many(medications)
}));

export const medicationsRelations = relations(medications, ({ one, many }) => ({
  prescription: one(prescriptions, {
    fields: [medications.prescriptionId],
    references: [prescriptions.id]
  }),
  reminders: many(medicationReminders)
}));
