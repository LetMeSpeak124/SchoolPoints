import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

const MANILA_TIME_ZONE = 'Asia/Manila';

export function getManilaPeriod(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);

  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}`;
}

export async function getMonthlyAllocation(teacherId: string, period = getManilaPeriod()) {
  return prisma.monthlyAllocation.findUnique({
    where: { teacherId_period: { teacherId, period } },
  });
}

export async function allocateMonthlyPoints(
  tx: Prisma.TransactionClient,
  teacherId: string,
  period: string,
  allocatedPoints: number
) {
  if (!Number.isInteger(allocatedPoints) || allocatedPoints < 0) {
    throw new Error('INVALID_ALLOCATION: Allocated points must be a non-negative integer');
  }

  return tx.monthlyAllocation.upsert({
    where: { teacherId_period: { teacherId, period } },
    create: {
      teacherId,
      period,
      allocatedPoints,
      usedPoints: 0,
    },
    update: {
      allocatedPoints,
    },
  });
}

export async function consumeMonthlyAllocation(
  tx: Prisma.TransactionClient,
  teacherId: string,
  period: string,
  amount: number
) {
  const allocation = await tx.monthlyAllocation.findUnique({
    where: { teacherId_period: { teacherId, period } },
  });

  // Monthly allocations are opt-in. Teachers without an allocation keep using
  // their configured daily limit until an administrator allocates a budget.
  if (!allocation) return null;

  if (allocation.usedPoints + amount > allocation.allocatedPoints) {
    throw new Error(
      `MONTHLY_ALLOCATION_EXCEEDED: ${allocation.usedPoints} of ${allocation.allocatedPoints} monthly points already used`
    );
  }

  return tx.monthlyAllocation.update({
    where: { teacherId_period: { teacherId, period } },
    data: { usedPoints: { increment: amount } },
  });
}