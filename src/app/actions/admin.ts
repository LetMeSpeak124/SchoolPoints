'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { updateRedemptionStatus } from '@/lib/services/points';
import { RedemptionStatus } from '@/lib/types';

export async function updateTeacherStatusAction(teacherId: string, status: 'APPROVED' | 'REVOKED' | 'PENDING') {
  try {
    await requireRole(['ADMIN']);

    await prisma.user.update({
      where: { id: teacherId, role: 'TEACHER' },
      data: { teacherStatus: status },
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to update teacher status' };
  }
}

export async function updateTeacherDailyLimitAction(teacherId: string, dailyAwardLimit: number) {
  try {
    await requireRole(['ADMIN']);

    if (isNaN(dailyAwardLimit) || dailyAwardLimit < 0) {
      return { error: 'Daily limit must be a non-negative number' };
    }

    await prisma.user.update({
      where: { id: teacherId, role: 'TEACHER' },
      data: { dailyAwardLimit },
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to update daily award limit' };
  }
}

export async function createRewardAction(formData: FormData) {
  try {
    await requireRole(['ADMIN']);

    const name = (formData.get('name') as string)?.trim();
    const emoji = (formData.get('emoji') as string)?.trim() || '🎁';
    const pointCost = parseInt(formData.get('pointCost') as string, 10);
    const stock = parseInt(formData.get('stock') as string, 10);

    if (!name || isNaN(pointCost) || pointCost <= 0 || isNaN(stock) || stock < 0) {
      return { error: 'Please provide valid reward details (positive points and non-negative stock).' };
    }

    await prisma.reward.create({
      data: {
        name,
        emoji,
        pointCost,
        stock,
        active: true,
      },
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to create reward' };
  }
}

export async function updateRewardStockAction(rewardId: string, stock: number) {
  try {
    await requireRole(['ADMIN']);

    if (isNaN(stock) || stock < 0) {
      return { error: 'Stock cannot be negative' };
    }

    await prisma.reward.update({
      where: { id: rewardId },
      data: { stock },
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to update stock' };
  }
}

export async function updateRedemptionStatusAction(redemptionId: string, status: RedemptionStatus) {
  try {
    await requireRole(['ADMIN']);

    await updateRedemptionStatus(redemptionId, status);

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to update redemption status' };
  }
}
