'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { awardPoints } from '@/lib/services/points';
import { AwardCategory } from '@/lib/types';

export async function awardPointsAction(formData: FormData) {
  try {
    const session = await requireRole(['TEACHER']);
    const studentId = (formData.get('studentId') as string)?.trim();
    const category = (formData.get('category') as AwardCategory)?.trim() as AwardCategory;
    const amount = Number(formData.get('amount'));
    const note = ((formData.get('note') as string) || '').trim();

    if (!studentId || !category || !Number.isInteger(amount) || amount <= 0) {
      return { error: 'Invalid input. Please provide a student, category, and valid whole-number points.' };
    }

    if (note.length > 500) {
      return { error: 'The note is too long (maximum 500 characters).' };
    }

    await awardPoints({
      teacherId: session.userId,
      studentId,
      amount,
      category,
      note,
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to award points' };
  }
}
