export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  role: 'admin' | 'doctor' | 'patient';
  name: string | null;
  createdAt: string;
}

export interface DoctorProfile {
  id: number;
  userId: number;
  name: string;
  specialization: string;
  workingHours: {
    start: string;
    end: string;
    days: number[];
  };
  slotDuration: number;
  createdAt: string;
}

export interface PatientProfile {
  id: number;
  userId: number;
  name: string;
  phone: string | null;
  dob: string | null;
  medicalHistory: string | null;
  createdAt: string;
}

export interface Appointment {
  id: number;
  doctorId: number;
  patientId: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  status: 'scheduled' | 'completed' | 'cancelled';
  calendarEventId: string | null;
  createdAt: string;
}

export interface SlotHold {
  id: number;
  doctorId: number;
  date: string;
  startTime: string;
  holdUntil: string;
  userId: number;
  createdAt: string;
}

export interface DoctorLeave {
  id: number;
  doctorId: number;
  startDate: string;
  endDate: string;
  reason: string | null;
  notified: number;
  createdAt: string;
}

export interface Prescription {
  id: number;
  appointmentId: number;
  clinicalNotes: string;
  createdAt: string;
}

export interface Medication {
  id: number;
  prescriptionId: number;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  reminderTime: string | null;
  createdAt: string;
}

export interface AIVisitSummary {
  id: number;
  appointmentId: number;
  urgency: 'High' | 'Medium' | 'Low';
  chiefComplaint: string;
  possibleCauses: string[];
  suggestedQuestions: string[];
  status: string;
  createdAt: string;
}

export interface AIPostVisitSummary {
  id: number;
  appointmentId: number;
  summary: string;
  medicationSchedule: any;
  precautions: string[];
  followUpAdvice: any;
  status: string;
  createdAt: string;
}

export interface EmailLog {
  id: number;
  recipient: string;
  subject: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  error: string | null;
  createdAt: string;
}
