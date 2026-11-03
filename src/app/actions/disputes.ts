'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createDispute, resolveDispute } from '@/lib/disputes';

export async function createDisputeAction(formData: FormData) {
  try {
    const session = await requireRole(['STUDENT']);
    const targetType = (formData.get('targetType') as string)?.trim() as 'AWARD' | 'REDEMPTION';
    const targetId = (formData.get('targetId') as string)?.trim();
    const reason = (formData.get('reason') as string) || '';

    if (targetType !== 'AWARD' && targetType !== 'REDEMPTION') {
      return { error: 'Invalid dispute target type' };
    }
    if (!targetId) {
      return { error: 'Missing dispute target' };
    }

    await createDispute({
      studentId: session.userId,
      targetType,
      targetId,
      reason,
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to create dispute' };
  }
}

export async function resolveDisputeAction(formData: FormData) {
  try {
    const session = await requireRole(['ADMIN']);
    const disputeId = (formData.get('disputeId') as string)?.trim();
    const status = (formData.get('status') as string)?.trim() as 'RESOLVED' | 'REJECTED';
    const resolution = (formData.get('resolution') as string) || '';

    if (!disputeId) {
      return { error: 'Missing dispute ID' };
    }

    await resolveDispute({
      disputeId,
      actorId: session.userId,
      status,
      resolution,
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to resolve dispute' };
  }
}