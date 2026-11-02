'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { redeemReward } from '@/lib/services/points';

export async function redeemRewardAction(rewardId: string) {
  try {
    const session = await requireRole(['STUDENT']);

    if (!rewardId) {
      return { error: 'Missing reward ID' };
    }

    await redeemReward({
      studentId: session.userId,
      rewardId,
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to redeem reward' };
  }
}
