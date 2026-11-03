import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { logAudit } from '../audit';
import { getActivePolicy } from '../policy';
import { consumeMonthlyAllocation, getManilaPeriod } from '../allocations';
import { runWithIdempotency } from '../idempotency';
import {
  ACTIVE_REDEMPTION_STATUSES,
  AWARD_CATEGORIES,
  AwardCategory,
  COLLECTION_WINDOW_HOURS,
  MAX_AWARD_POINTS,
  REDEMPTION_TRANSITIONS,
  RedemptionStatus,
  STUDENT_DAILY_CAP,
} from '../types';

const MANILA_TIME_ZONE = 'Asia/Manila';

/**
 * The proposal uses Asia/Manila school-local days. The server may run in any
 * timezone, so compute the UTC instants for the current Manila day explicitly.
 */
export function getManilaDayRange(now = new Date()): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const year = value('year');
  const month = value('month');
  const day = value('day');

  // Asia/Manila is UTC+8 year-round (no daylight saving time).
  const start = new Date(Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function isRedemptionStatus(value: string): value is RedemptionStatus {
  return ['REQUESTED', 'READY', 'COLLECTED', 'CANCELLED', 'EXPIRED'].includes(value);
}

function assertAwardCategory(category: string): asserts category is AwardCategory {
  if (!AWARD_CATEGORIES.some((item) => item.value === category)) {
    throw new Error(`INVALID_CATEGORY: "${category}" is not an approved award category`);
  }
}

export async function getStudentBalance(studentId: string): Promise<number> {
  const result = await prisma.pointLedger.aggregate({
    _sum: { amount: true },
    where: { studentId },
  });
  return result._sum.amount ?? 0;
}

export async function awardPoints(params: {
  teacherId: string;
  studentId: string;
  amount: number;
  category: AwardCategory;
  note?: string;
  activityId?: string | null;
  idempotencyKey?: string | null;
}) {
  const { teacherId, studentId, amount, category, note, activityId, idempotencyKey } = params;

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('INVALID_AMOUNT: Award amount must be a positive integer');
  }

  assertAwardCategory(category);

  if (note && note.trim().length > 500) {
    throw new Error('INVALID_NOTE: The note cannot exceed 500 characters');
  }

  const requestHash = JSON.stringify({ teacherId, studentId, amount, category, note, activityId });

  return runWithIdempotency('awardPoints', idempotencyKey, teacherId, requestHash, async () => {
    const policy = await getActivePolicy();

    if (amount > policy.maxAwardPoints) {
      throw new Error(
        `AWARD_LIMIT_EXCEEDED: A single award cannot exceed ${policy.maxAwardPoints} points`
      );
    }

    return await prisma.$transaction(async (tx) => {
      const teacher = await tx.user.findUnique({
        where: { id: teacherId },
        include: { taughtClasses: true },
      });

      if (!teacher || teacher.role !== 'TEACHER') {
        throw new Error('TEACHER_NOT_FOUND: Invalid teacher');
      }

      if (teacher.status !== 'ACTIVE') {
        throw new Error('ACCOUNT_DISABLED: This teacher account is disabled');
      }

      if (teacher.teacherStatus !== 'APPROVED') {
        throw new Error('TEACHER_NOT_APPROVED: Teacher must be approved by an administrator to award points');
      }

      const student = await tx.user.findUnique({
        where: { id: studentId },
      });

      if (!student || student.role !== 'STUDENT') {
        throw new Error('STUDENT_NOT_FOUND: Invalid student');
      }

      if (student.status !== 'ACTIVE') {
        throw new Error('STUDENT_DISABLED: This student account is disabled');
      }

      const teacherClassIds = teacher.taughtClasses.map((classroom) => classroom.id);
      if (!student.classroomId || !teacherClassIds.includes(student.classroomId)) {
        throw new Error('STUDENT_NOT_IN_TEACHER_CLASS: Teachers can only award points to students in their own classes');
      }

      if (activityId) {
        const activity = await tx.activity.findUnique({ where: { id: activityId } });
        if (!activity) {
          throw new Error('ACTIVITY_NOT_FOUND: The referenced activity does not exist');
        }
      }

      const { start, end } = getManilaDayRange();

      const [teacherToday, studentToday] = await Promise.all([
        tx.pointLedger.aggregate({
          _sum: { amount: true },
          where: {
            awardedById: teacherId,
            type: 'AWARD',
            createdAt: { gte: start, lt: end },
          },
        }),
        tx.pointLedger.aggregate({
          _sum: { amount: true },
          where: {
            studentId,
            type: 'AWARD',
            createdAt: { gte: start, lt: end },
          },
        }),
      ]);

      const teacherIssuedToday = teacherToday._sum.amount ?? 0;
      const studentIssuedToday = studentToday._sum.amount ?? 0;
      const dailyLimit = teacher.dailyAwardLimit ?? 50;

      if (teacherIssuedToday + amount > dailyLimit) {
        throw new Error(
          `DAILY_LIMIT_EXCEEDED: You have awarded ${teacherIssuedToday} of your daily ${dailyLimit} points limit. Cannot award ${amount} more.`
        );
      }

      if (studentIssuedToday + amount > policy.studentDailyCap) {
        throw new Error(
          `STUDENT_DAILY_LIMIT_EXCEEDED: This student has received ${studentIssuedToday} of the ${policy.studentDailyCap}-point daily limit. Cannot award ${amount} more today.`
        );
      }

      await consumeMonthlyAllocation(tx, teacherId, getManilaPeriod(), amount);

      const entry = await tx.pointLedger.create({
        data: {
          studentId,
          amount,
          type: 'AWARD',
          category,
          note: note?.trim() || null,
          awardedById: teacherId,
          policyVersionId: policy.id,
          activityId: activityId ?? null,
        },
      });

      await logAudit(tx, {
        actorId: teacherId,
        action: 'AWARD_CREATED',
        entityType: 'PointLedger',
        entityId: entry.id,
        details: { studentId, amount, category, activityId: activityId ?? null, policyVersion: policy.version },
      });

      return entry;
    });
  });
}

export async function redeemReward(params: { studentId: string; rewardId: string; activityId?: string | null; idempotencyKey?: string | null }) {
  const { studentId, rewardId, activityId, idempotencyKey } = params;

  const requestHash = JSON.stringify({ studentId, rewardId, activityId });

  return runWithIdempotency('redeemReward', idempotencyKey, studentId, requestHash, async () => {
    const policy = await getActivePolicy();

    return await prisma.$transaction(async (tx) => {
      const student = await tx.user.findUnique({ where: { id: studentId } });
      if (!student || student.role !== 'STUDENT') {
        throw new Error('STUDENT_NOT_FOUND');
      }

      if (student.status !== 'ACTIVE') {
        throw new Error('STUDENT_DISABLED: This student account is disabled');
      }

      const reward = await tx.reward.findUnique({ where: { id: rewardId } });
      if (!reward || !reward.active) {
        throw new Error('REWARD_NOT_FOUND: The requested reward does not exist or is inactive');
      }

      if (reward.stock < 1) {
        throw new Error('OUT_OF_STOCK: This item is currently out of stock');
      }

      if (activityId) {
        const activity = await tx.activity.findUnique({ where: { id: activityId } });
        if (!activity) {
          throw new Error('ACTIVITY_NOT_FOUND: The referenced activity does not exist');
        }
      }

      const sumResult = await tx.pointLedger.aggregate({
        _sum: { amount: true },
        where: { studentId },
      });
      const currentBalance = sumResult._sum.amount ?? 0;

      if (currentBalance < reward.pointCost) {
        throw new Error(
          `INSUFFICIENT_BALANCE: You need ${reward.pointCost} points but currently have ${currentBalance} points`
        );
      }

      const stockUpdate = await tx.reward.updateMany({
        where: { id: rewardId, active: true, stock: { gte: 1 } },
        data: { stock: { decrement: 1 } },
      });

      if (stockUpdate.count !== 1) {
        throw new Error('OUT_OF_STOCK: This item is currently out of stock');
      }

      const expiresAt = new Date(Date.now() + policy.collectionWindowHours * 60 * 60 * 1000);

      const redemption = await tx.redemption.create({
        data: {
          studentId,
          rewardId,
          pointCost: reward.pointCost,
          status: 'REQUESTED',
          expiresAt,
          policyVersionId: policy.id,
          activityId: activityId ?? null,
        },
      });

      await tx.pointLedger.create({
        data: {
          studentId,
          amount: -reward.pointCost,
          type: 'REDEMPTION',
          redemptionId: redemption.id,
          note: `Redeemed ${reward.name}`,
          policyVersionId: policy.id,
          activityId: activityId ?? null,
        },
      });

      await logAudit(tx, {
        actorId: studentId,
        action: 'REDEMPTION_REQUESTED',
        entityType: 'Redemption',
        entityId: redemption.id,
        details: { rewardId, pointCost: reward.pointCost, expiresAt: expiresAt.toISOString(), activityId: activityId ?? null, policyVersion: policy.version },
      });

      return redemption;
    });
  });
}

interface CancelableRedemption {
  id: string;
  studentId: string;
  rewardId: string;
  rewardName: string;
  pointCost: number;
  status: string;
}

async function cancelRedemptionInTransaction(
  tx: Prisma.TransactionClient,
  redemption: CancelableRedemption,
  options: {
    actorId?: string | null;
    status?: 'CANCELLED' | 'EXPIRED';
    reason?: string;
    studentId?: string;
  } = {}
) {
  const nextStatus: 'CANCELLED' | 'EXPIRED' = options.status ?? 'CANCELLED';

  if (options.studentId && redemption.studentId !== options.studentId) {
    throw new Error('FORBIDDEN_REDEMPTION_ACCESS: You can only cancel your own requests');
  }

  if (redemption.status === 'COLLECTED') {
    throw new Error('CANNOT_CANCEL_COLLECTED: Item has already been collected');
  }
  if (redemption.status === 'CANCELLED') {
    throw new Error('ALREADY_CANCELLED: This redemption has already been cancelled');
  }
  if (redemption.status === 'EXPIRED') {
    throw new Error('ALREADY_EXPIRED: This redemption has already expired');
  }
  if (!ACTIVE_REDEMPTION_STATUSES.includes(redemption.status as RedemptionStatus)) {
    throw new Error('INVALID_REDEMPTION_STATE: This redemption cannot be cancelled');
  }

  const now = new Date();

  // The conditional update is the single terminal transition. A racing
  // collect/cancel therefore commits at most once.
  const updated = await tx.redemption.updateMany({
    where: {
      id: redemption.id,
      status: { in: ACTIVE_REDEMPTION_STATUSES },
    },
    data: {
      status: nextStatus,
      cancelledAt: now,
    },
  });

  if (updated.count !== 1) {
    throw new Error('REDEMPTION_STATE_CHANGED: This redemption was already updated. Refresh the page.');
  }

  await tx.reward.update({
    where: { id: redemption.rewardId },
    data: { stock: { increment: 1 } },
  });

  await tx.pointLedger.create({
    data: {
      studentId: redemption.studentId,
      amount: redemption.pointCost,
      type: 'REFUND',
      redemptionId: redemption.id,
      note:
        nextStatus === 'EXPIRED'
          ? `Refund for expired redemption: ${redemption.rewardName}`
          : `Refund for cancelled redemption: ${redemption.rewardName}`,
    },
  });

  await logAudit(tx, {
    actorId: options.actorId ?? null,
    action: nextStatus === 'EXPIRED' ? 'REDEMPTION_EXPIRED' : 'REDEMPTION_CANCELLED',
    entityType: 'Redemption',
    entityId: redemption.id,
    details: {
      refund: redemption.pointCost,
      rewardId: redemption.rewardId,
      reason: options.reason ?? null,
    },
  });

  return tx.redemption.findUniqueOrThrow({ where: { id: redemption.id } });
}

export async function cancelRedemption(
  redemptionId: string,
  options: {
    actorId?: string | null;
    status?: 'CANCELLED' | 'EXPIRED';
    reason?: string;
    studentId?: string;
    idempotencyKey?: string | null;
  } = {}
) {
  const requestHash = JSON.stringify({ redemptionId, ...options });

  return runWithIdempotency(
    'cancelRedemption',
    options.idempotencyKey,
    options.actorId ?? options.studentId ?? null,
    requestHash,
    async () => {
      return await prisma.$transaction(async (tx) => {
        const redemption = await tx.redemption.findUnique({
          where: { id: redemptionId },
          include: { reward: true },
        });

        if (!redemption) {
          throw new Error('REDEMPTION_NOT_FOUND');
        }

        return cancelRedemptionInTransaction(
          tx,
          {
            id: redemption.id,
            studentId: redemption.studentId,
            rewardId: redemption.rewardId,
            rewardName: redemption.reward.name,
            pointCost: redemption.pointCost,
            status: redemption.status,
          },
          options
        );
      });
    }
  );
}

/**
 * Lazily expires overdue requests. A production deployment should also run
 * this from a scheduled job; the dashboard calls it so the local PoC stays
 * consistent even without a scheduler.
 */
export async function expireOverdueRedemptions(): Promise<number> {
  const overdue = await prisma.redemption.findMany({
    where: {
      status: { in: ACTIVE_REDEMPTION_STATUSES },
      expiresAt: { lte: new Date() },
    },
    select: { id: true },
  });

  let expired = 0;
  for (const item of overdue) {
    try {
      await cancelRedemption(item.id, {
        status: 'EXPIRED',
        reason: 'Collection window elapsed',
      });
      expired += 1;
    } catch {
      // Another request may have transitioned it first; the conditional update
      // inside cancelRedemption prevents a double refund.
    }
  }

  return expired;
}

export async function updateRedemptionStatus(
  redemptionId: string,
  newStatus: RedemptionStatus,
  options: { actorId?: string | null; reason?: string } = {}
) {
  if (!isRedemptionStatus(newStatus)) {
    throw new Error('INVALID_STATUS: Unknown redemption status');
  }

  if (newStatus === 'CANCELLED' || newStatus === 'EXPIRED') {
    return cancelRedemption(redemptionId, {
      actorId: options.actorId,
      status: newStatus,
      reason: options.reason,
    });
  }

  // Expire outside the read/write transaction so the refund is committed even
  // though the caller receives an error instead of a successful collection.
  const existing = await prisma.redemption.findUnique({
    where: { id: redemptionId },
    select: { expiresAt: true },
  });
  if (existing?.expiresAt && existing.expiresAt.getTime() <= Date.now()) {
    await cancelRedemption(redemptionId, {
      status: 'EXPIRED',
      reason: 'Collection window elapsed',
    });
    throw new Error('REDEMPTION_EXPIRED: The collection window has elapsed; points were refunded');
  }

  return await prisma.$transaction(async (tx) => {
    const redemption = await tx.redemption.findUnique({
      where: { id: redemptionId },
      include: { reward: true },
    });

    if (!redemption) {
      throw new Error('REDEMPTION_NOT_FOUND');
    }

    if (redemption.expiresAt && redemption.expiresAt.getTime() <= Date.now()) {
      // A concurrent request may have crossed the deadline after the pre-check.
      // Refuse the collection; the lazy expiry scheduler will post the refund.
      throw new Error('REDEMPTION_EXPIRED: The collection window has elapsed');
    }

    if (!options.actorId) {
      throw new Error('ACTOR_REQUIRED: An authorized staff member must perform this action');
    }

    const currentStatus = redemption.status as RedemptionStatus;
    const allowed = REDEMPTION_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `INVALID_TRANSITION: Cannot move a redemption from ${redemption.status} to ${newStatus}`
      );
    }

    const now = new Date();
    const data =
      newStatus === 'READY'
        ? { status: newStatus, readyAt: now }
        : {
            status: newStatus,
            collectedById: options.actorId,
            collectedAt: now,
          };

    const updated = await tx.redemption.updateMany({
      where: {
        id: redemption.id,
        status: currentStatus,
      },
      data,
    });

    if (updated.count !== 1) {
      throw new Error('REDEMPTION_STATE_CHANGED: This redemption was already updated. Refresh the page.');
    }

    await logAudit(tx, {
      actorId: options.actorId,
      action: newStatus === 'READY' ? 'REDEMPTION_READY' : 'REDEMPTION_COLLECTED',
      entityType: 'Redemption',
      entityId: redemption.id,
      details: { previousStatus: currentStatus, newStatus },
    });

    return tx.redemption.findUniqueOrThrow({ where: { id: redemption.id } });
  });
}

export async function getStudentData(params: {
  currentUserId: string;
  currentUserRole: string;
  targetStudentId: string;
}) {
  const { currentUserId, currentUserRole, targetStudentId } = params;

  if (currentUserRole === 'STUDENT' && currentUserId !== targetStudentId) {
    throw new Error('FORBIDDEN_STUDENT_ACCESS: Students can only view their own data');
  }

  const student = await prisma.user.findUnique({
    where: { id: targetStudentId },
    include: {
      classroom: true,
      ledgerEntries: {
        orderBy: { createdAt: 'desc' },
        include: {
          awardedBy: { select: { id: true, name: true } },
        },
      },
      redemptions: {
        orderBy: { createdAt: 'desc' },
        include: { reward: true },
      },
    },
  });

  if (!student || student.role !== 'STUDENT') {
    throw new Error('STUDENT_NOT_FOUND');
  }

  if (currentUserRole === 'TEACHER') {
    const teacher = await prisma.user.findUnique({
      where: { id: currentUserId },
      include: { taughtClasses: { select: { id: true } } },
    });
    const teachesStudent = Boolean(
      teacher &&
        student.classroomId &&
        teacher.taughtClasses.some((classroom) => classroom.id === student.classroomId)
    );
    if (!teachesStudent) {
      throw new Error('FORBIDDEN_STUDENT_ACCESS: Teachers can only view students in their own classes');
    }
  } else if (currentUserRole !== 'ADMIN' && currentUserRole !== 'STUDENT') {
    throw new Error('FORBIDDEN_STUDENT_ACCESS');
  }

  const balance = student.ledgerEntries.reduce((total, entry) => total + entry.amount, 0);

  const rewards = await prisma.reward.findMany({
    where: { active: true },
    orderBy: { pointCost: 'asc' },
  });

  return {
    student: {
      id: student.id,
      name: student.name,
      username: student.username,
      classroom: student.classroom,
    },
    balance,
    ledger: student.ledgerEntries,
    redemptions: student.redemptions,
    rewards,
  };
}
