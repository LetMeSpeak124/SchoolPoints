'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { awardPoints } from '@/lib/services/points';
import { AwardCategory } from '@/lib/types';

export async function awardPointsAction(formData: FormData) {
  try {
    const session = await requireRole(['TEACHER']);
    const studentId = formData.get('studentId') as string;
    const category = formData.get('category') as AwardCategory;
    const amountStr = formData.get('amount') as string;
    const note = (formData.get('note') as string) || '';

    const amount = parseInt(amountStr, 10);
    if (!studentId || !category || isNaN(amount) || amount <= 0) {
      return { error: 'Invalid input. Please provide student, category, and valid points.' };
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
