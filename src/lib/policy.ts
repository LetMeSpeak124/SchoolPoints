import { prisma } from './prisma';
import { MAX_AWARD_POINTS, STUDENT_DAILY_CAP, COLLECTION_WINDOW_HOURS } from './types';

export interface EffectivePolicy {
  id: string | null;
  version: number | null;
  maxAwardPoints: number;
  studentDailyCap: number;
  collectionWindowHours: number;
}

const FALLBACK_POLICY: EffectivePolicy = {
  id: null,
  version: null,
  maxAwardPoints: MAX_AWARD_POINTS,
  studentDailyCap: STUDENT_DAILY_CAP,
  collectionWindowHours: COLLECTION_WINDOW_HOURS,
};

export async function getActivePolicy(now = new Date()): Promise<EffectivePolicy> {
  const policy = await prisma.pointPolicy.findFirst({
    where: {
      isActive: true,
      effectiveAt: { lte: now },
    },
    orderBy: [{ version: 'desc' }, { effectiveAt: 'desc' }],
  });

  if (!policy) {
    return FALLBACK_POLICY;
  }

  return {
    id: policy.id,
    version: policy.version,
    maxAwardPoints: policy.maxAwardPoints,
    studentDailyCap: policy.studentDailyCap,
    collectionWindowHours: policy.collectionWindowHours,
  };
}

export async function ensureDefaultPolicy(createdById?: string | null) {
  const existing = await prisma.pointPolicy.findFirst({ where: { isActive: true } });
  if (existing) return existing;

  return prisma.pointPolicy.create({
    data: {
      version: 1,
      name: 'Default pilot policy',
      maxAwardPoints: MAX_AWARD_POINTS,
      studentDailyCap: STUDENT_DAILY_CAP,
      collectionWindowHours: COLLECTION_WINDOW_HOURS,
      isActive: true,
      createdById: createdById ?? null,
    },
  });
}