'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { updateRedemptionStatus } from '@/lib/services/points';
import { RedemptionStatus, UserStatus } from '@/lib/types';

export async function updateTeacherStatusAction(
  teacherId: string,
  status: 'APPROVED' | 'REVOKED' | 'PENDING'
) {
  try {
    const session = await requireRole(['ADMIN', 'TEACHER']);

    if (!['APPROVED', 'REVOKED', 'PENDING'].includes(status)) {
      return { error: 'Invalid teacher status' };
    }

    await prisma.$transaction(async (tx) => {
      const teacher = await tx.user.findUnique({ where: { id: teacherId } });
      if (!teacher || teacher.role !== 'TEACHER') {
        throw new Error('TEACHER_NOT_FOUND: Invalid teacher');
      }

      await tx.user.update({
        where: { id: teacherId },
        data: {
          teacherStatus: status,
          approvedById: status === 'PENDING' ? null : session.userId,
          approvedAt: status === 'PENDING' ? null : new Date(),
          approvalReason:
            status === 'REVOKED'
              ? 'Revoked by administrator'
              : status === 'PENDING'
                ? 'Reset to pending by administrator'
                : null,
        },
      });

      await logAudit(tx, {
        actorId: session.userId,
        action: 'TEACHER_STATUS_CHANGED',
        entityType: 'User',
        entityId: teacherId,
        details: { previousStatus: teacher.teacherStatus, newStatus: status },
      });
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to update teacher status' };
  }
}

export async function updateTeacherDailyLimitAction(teacherId: string, dailyAwardLimit: number) {
  try {
    const session = await requireRole(['ADMIN', 'TEACHER']);

    if (!Number.isInteger(dailyAwardLimit) || dailyAwardLimit < 0) {
      return { error: 'Daily limit must be a non-negative integer' };
    }

    await prisma.$transaction(async (tx) => {
      const teacher = await tx.user.findUnique({ where: { id: teacherId } });
      if (!teacher || teacher.role !== 'TEACHER') {
        throw new Error('TEACHER_NOT_FOUND: Invalid teacher');
      }

      await tx.user.update({
        where: { id: teacherId },
        data: { dailyAwardLimit },
      });

      await logAudit(tx, {
        actorId: session.userId,
        action: 'TEACHER_DAILY_LIMIT_CHANGED',
        entityType: 'User',
        entityId: teacherId,
        details: { previousLimit: teacher.dailyAwardLimit, newLimit: dailyAwardLimit },
      });
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to update daily award limit' };
  }
}

export async function updateUserStatusAction(userId: string, status: UserStatus) {
  try {
    const session = await requireRole(['ADMIN', 'TEACHER']);

    if (status !== 'ACTIVE' && status !== 'DISABLED') {
      return { error: 'Invalid account status' };
    }

    if (userId === session.userId) {
      return { error: 'You cannot change your own account status' };
    }

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new Error('USER_NOT_FOUND: Invalid account');
      }

      await tx.user.update({
        where: { id: userId },
        data: { status },
      });

      await logAudit(tx, {
        actorId: session.userId,
        action: 'ACCOUNT_STATUS_CHANGED',
        entityType: 'User',
        entityId: userId,
        details: { previousStatus: user.status, newStatus: status },
      });
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to update account status' };
  }
}

export async function createRewardAction(formData: FormData) {
  try {
    const session = await requireRole(['ADMIN', 'TEACHER']);

    const name = (formData.get('name') as string)?.trim();
    const emoji = (formData.get('emoji') as string)?.trim() || '??';
    const pointCost = parseInt(formData.get('pointCost') as string, 10);
    const stock = parseInt(formData.get('stock') as string, 10);

    if (!name || name.length > 150) {
      return { error: 'Please provide a valid reward name (1-150 characters).' };
    }
    if (emoji.length > 16) {
      return { error: 'Emoji icon is too long.' };
    }
    if (!Number.isInteger(pointCost) || pointCost <= 0) {
      return { error: 'Point cost must be a positive integer.' };
    }
    if (!Number.isInteger(stock) || stock < 0) {
      return { error: 'Stock must be a non-negative integer.' };
    }

    await prisma.$transaction(async (tx) => {
      const reward = await tx.reward.create({
        data: {
          name,
          emoji,
          pointCost,
          stock,
          active: true,
        },
      });

      await logAudit(tx, {
        actorId: session.userId,
        action: 'REWARD_CREATED',
        entityType: 'Reward',
        entityId: reward.id,
        details: { name, pointCost, stock },
      });
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to create reward' };
  }
}

export async function updateRewardStockAction(rewardId: string, stock: number) {
  try {
    const session = await requireRole(['ADMIN', 'TEACHER']);

    if (!Number.isInteger(stock) || stock < 0) {
      return { error: 'Stock must be a non-negative integer' };
    }

    await prisma.$transaction(async (tx) => {
      const reward = await tx.reward.findUnique({ where: { id: rewardId } });
      if (!reward) {
        throw new Error('REWARD_NOT_FOUND: Invalid reward');
      }

      await tx.reward.update({
        where: { id: rewardId },
        data: { stock },
      });

      await logAudit(tx, {
        actorId: session.userId,
        action: 'REWARD_STOCK_CHANGED',
        entityType: 'Reward',
        entityId: rewardId,
        details: { previousStock: reward.stock, newStock: stock },
      });
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to update stock' };
  }
}

export async function setRewardActiveAction(rewardId: string, active: boolean) {
  try {
    const session = await requireRole(['ADMIN', 'TEACHER']);

    await prisma.$transaction(async (tx) => {
      const reward = await tx.reward.findUnique({ where: { id: rewardId } });
      if (!reward) {
        throw new Error('REWARD_NOT_FOUND: Invalid reward');
      }

      await tx.reward.update({
        where: { id: rewardId },
        data: { active },
      });

      await logAudit(tx, {
        actorId: session.userId,
        action: 'REWARD_ACTIVE_CHANGED',
        entityType: 'Reward',
        entityId: rewardId,
        details: { previousActive: reward.active, newActive: active },
      });
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to update reward availability' };
  }
}

export async function updateRedemptionStatusAction(
  redemptionId: string,
  status: RedemptionStatus
) {
  try {
    const session = await requireRole(['ADMIN', 'TEACHER']);

    if (status !== 'READY' && status !== 'COLLECTED' && status !== 'CANCELLED') {
      return { error: 'Invalid redemption action' };
    }

    await updateRedemptionStatus(redemptionId, status, {
      actorId: session.userId,
      reason: `Administrator action: ${status}`,
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to update redemption status' };
  }
}
