'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { allocateMonthlyPoints, getManilaPeriod } from '@/lib/allocations';

export async function allocateMonthlyPointsAction(formData: FormData) {
  try {
    const session = await requireRole(['ADMIN']);
    const teacherId = (formData.get('teacherId') as string)?.trim();
    const period = ((formData.get('period') as string) || getManilaPeriod()).trim();
    const allocatedPoints = Number(formData.get('allocatedPoints'));

    if (!teacherId) {
      return { error: 'Missing teacher ID' };
    }
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return { error: 'Period must use YYYY-MM format' };
    }
    if (!Number.isInteger(allocatedPoints) || allocatedPoints < 0) {
      return { error: 'Allocated points must be a non-negative integer' };
    }

    const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.role !== 'TEACHER') {
      return { error: 'Invalid teacher' };
    }

    await prisma.$transaction(async (tx) => {
      await allocateMonthlyPoints(tx, teacherId, period, allocatedPoints);
      await logAudit(tx, {
        actorId: session.userId,
        action: 'MONTHLY_ALLOCATION_SET',
        entityType: 'MonthlyAllocation',
        entityId: `${teacherId}:${period}`,
        details: { teacherId, period, allocatedPoints },
      });
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to allocate monthly points' };
  }
}