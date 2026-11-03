import { prisma } from './prisma';
import { logAudit } from './audit';

export type DisputeStatus = 'OPEN' | 'RESOLVED' | 'REJECTED';

export async function createDispute(params: {
  studentId: string;
  targetType: 'AWARD' | 'REDEMPTION';
  targetId: string;
  reason: string;
  activityId?: string | null;
}) {
  const { studentId, targetType, targetId, reason, activityId } = params;

  if (!reason || reason.trim().length < 5) {
    throw new Error('INVALID_REASON: Please provide a reason of at least 5 characters');
  }

  if (targetType === 'AWARD') {
    const entry = await prisma.pointLedger.findUnique({ where: { id: targetId } });
    if (!entry || entry.studentId !== studentId || entry.type !== 'AWARD') {
      throw new Error('DISPUTE_TARGET_NOT_FOUND: You can only dispute your own awards');
    }
  } else if (targetType === 'REDEMPTION') {
    const redemption = await prisma.redemption.findUnique({ where: { id: targetId } });
    if (!redemption || redemption.studentId !== studentId) {
      throw new Error('DISPUTE_TARGET_NOT_FOUND: You can only dispute your own redemptions');
    }
  } else {
    throw new Error('INVALID_TARGET_TYPE: Disputes can only target awards or redemptions');
  }

  const dispute = await prisma.dispute.create({
    data: {
      studentId,
      targetType,
      targetId,
      reason: reason.trim(),
      activityId: activityId ?? null,
    },
  });

  return dispute;
}

export async function resolveDispute(params: {
  disputeId: string;
  actorId: string;
  status: 'RESOLVED' | 'REJECTED';
  resolution: string;
}) {
  const { disputeId, actorId, status, resolution } = params;

  if (status !== 'RESOLVED' && status !== 'REJECTED') {
    throw new Error('INVALID_STATUS: Dispute status must be RESOLVED or REJECTED');
  }

  if (!resolution || resolution.trim().length < 3) {
    throw new Error('INVALID_RESOLUTION: Please provide a resolution of at least 3 characters');
  }

  return prisma.$transaction(async (tx) => {
    const dispute = await tx.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) {
      throw new Error('DISPUTE_NOT_FOUND');
    }
    if (dispute.status !== 'OPEN') {
      throw new Error('DISPUTE_ALREADY_CLOSED');
    }

    const updated = await tx.dispute.update({
      where: { id: disputeId },
      data: {
        status,
        resolution: resolution.trim(),
        resolvedById: actorId,
        resolvedAt: new Date(),
      },
    });

    await logAudit(tx, {
      actorId,
      action: status === 'RESOLVED' ? 'DISPUTE_RESOLVED' : 'DISPUTE_REJECTED',
      entityType: 'Dispute',
      entityId: disputeId,
      details: { targetType: dispute.targetType, targetId: dispute.targetId },
    });

    return updated;
  });
}