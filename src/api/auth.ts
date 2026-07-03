import { Router, Response } from 'express';
import { db } from '../db/index.ts';
import { users, doctors, patients } from '../db/schema.ts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';
import { eq } from 'drizzle-orm';

const router = Router();

router.post('/onboard', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { 
    role, 
    name, 
    // Patient fields
    gender, 
    dob, 
    bloodGroup,
    // Doctor fields
    specialization,
    qualifications,
    experienceYears,
    consultantFee
  } = req.body;

  if (!role || !['patient', 'doctor', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid or missing role selection' });
  }

  try {
    // 1. Update user role and name in users table
    const [updatedUser] = await db.update(users)
      .set({ 
        role, 
        name: name || req.user!.name 
      })
      .where(eq(users.id, userId))
      .returning();

    // 2. Ensure role profile exists and is updated
    if (role === 'patient') {
      // Find or create
      const existingPat = await db.query.patients.findFirst({
        where: eq(patients.userId, userId),
      });

      if (existingPat) {
        await db.update(patients)
          .set({
            name: name || existingPat.name,
            gender: gender || null,
            dob: dob || null,
            bloodGroup: bloodGroup || null,
          })
          .where(eq(patients.id, existingPat.id));
      } else {
        await db.insert(patients)
          .values({
            userId,
            name: name || 'Anonymous Patient',
            gender: gender || null,
            dob: dob || null,
            bloodGroup: bloodGroup || null,
          });
      }
    } else if (role === 'doctor') {
      const existingDoc = await db.query.doctors.findFirst({
        where: eq(doctors.userId, userId),
      });

      if (existingDoc) {
        await db.update(doctors)
          .set({
            name: name || existingDoc.name,
            specialization: specialization || 'General Medicine',
            qualifications: qualifications || null,
            experienceYears: experienceYears ? parseInt(experienceYears) : null,
            consultantFee: consultantFee ? parseInt(consultantFee) : null,
          })
          .where(eq(doctors.id, existingDoc.id));
      } else {
        await db.insert(doctors)
          .values({
            userId,
            name: name || 'Dr. Specialist',
            specialization: specialization || 'General Medicine',
            qualifications: qualifications || null,
            experienceYears: experienceYears ? parseInt(experienceYears) : null,
            consultantFee: consultantFee ? parseInt(consultantFee) : null,
            workingHours: { start: "09:00", end: "17:00", days: [1, 2, 3, 4, 5] },
            slotDuration: 30,
          });
      }
    }

    res.json({ 
      success: true, 
      message: 'Onboarding credentials registered successfully', 
      user: {
        id: updatedUser.id,
        uid: updatedUser.uid,
        email: updatedUser.email,
        role: updatedUser.role,
        name: updatedUser.name
      }
    });
  } catch (error: any) {
    console.error('Error in onboarding:', error);
    res.status(500).json({ error: 'Failed to complete registration onboarding', details: error.message });
  }
});

export default router;
