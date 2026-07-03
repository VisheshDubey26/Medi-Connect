import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { users, doctors, patients } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    uid: string;
    email: string;
    role: string;
    name: string | null;
  };
  firebaseUser?: any;
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    let decodedToken: any;

    if (token.startsWith('mock_')) {
      let email = 'vk.dubey2607@gmail.com';
      let uid = 'mock_patient_uid';
      let name = 'Patient User';
      let role = 'patient';

      if (token === 'mock_admin_token') {
        email = 'admin@hospital.com';
        uid = 'mock_admin_uid';
        name = 'Admin User';
        role = 'admin';
      } else if (token === 'mock_doctor_token') {
        email = 'doctor@hospital.com';
        uid = 'mock_doctor_uid';
        name = 'Dr. Alexander Pierce';
        role = 'doctor';
      } else if (token === 'mock_patient_token') {
        email = 'vk.dubey2607@gmail.com';
        uid = 'mock_patient_uid';
        name = 'Patient User';
        role = 'patient';
      } else if (token.includes('__')) {
        const parts = token.split('__');
        role = parts[0].replace('mock_', '') || 'patient';
        email = parts[1] || 'user@example.com';
        name = parts[2] ? decodeURIComponent(parts[2]) : 'User';
        uid = `mock_uid_${role}_${email.replace(/[@.]/g, '_')}`;
      } else {
        uid = token;
        role = token.includes('admin') ? 'admin' : token.includes('doctor') ? 'doctor' : 'patient';
        email = `${role}@hospital.com`;
        name = `${role.charAt(0).toUpperCase() + role.slice(1)} User`;
      }

      decodedToken = {
        uid,
        email,
        name,
        role,
      };
    } else {
      decodedToken = await adminAuth.verifyIdToken(token);
    }

    const email = decodedToken.email;
    const uid = decodedToken.uid;
    const role = decodedToken.role || 'patient'; // default fallback role

    if (!email) {
      return res.status(401).json({ error: 'Unauthorized: Token is missing email claim' });
    }

    // Check if user exists in our local PostgreSQL database
    let userRecord = await db.query.users.findFirst({
      where: eq(users.uid, uid),
    });

    // If user does not exist, auto-register them
    if (!userRecord) {
      // Create user record
      const [newUser] = await db.insert(users)
        .values({
          uid,
          email,
          role,
          name: decodedToken.name || email.split('@')[0],
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: { email, role },
        })
        .returning();

      userRecord = newUser;
    } else if (userRecord.role !== role) {
      // Synchronize role if they changed roles in the developer simulator
      const [updatedUser] = await db.update(users)
        .set({ role })
        .where(eq(users.id, userRecord.id))
        .returning();
      userRecord = updatedUser;
    }

    // Ensure profiles exist depending on the user's role
    if (userRecord.role === 'patient') {
      const existingPat = await db.query.patients.findFirst({
        where: eq(patients.userId, userRecord.id),
      });
      if (!existingPat) {
        await db.insert(patients)
          .values({
            userId: userRecord.id,
            name: userRecord.name || 'Anonymous Patient',
          })
          .onConflictDoNothing();
      }
    } else if (userRecord.role === 'doctor') {
      const existingDoc = await db.query.doctors.findFirst({
        where: eq(doctors.userId, userRecord.id),
      });
      if (!existingDoc) {
        await db.insert(doctors)
          .values({
            userId: userRecord.id,
            name: userRecord.name || 'Dr. Practitioner',
            specialization: 'General Medicine',
            workingHours: { start: "09:00", end: "17:00", days: [1, 2, 3, 4, 5] },
            slotDuration: 30,
          })
          .onConflictDoNothing();
      }
    }

    req.firebaseUser = decodedToken;
    req.user = {
      id: userRecord.id,
      uid: userRecord.uid,
      email: userRecord.email,
      role: userRecord.role,
      name: userRecord.name,
    };

    next();
  } catch (error: any) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token', details: error.message });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Access restricted to roles [${allowedRoles.join(', ')}]`
      });
    }

    next();
  };
};
