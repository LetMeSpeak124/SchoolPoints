import { prisma } from './prisma';
import { expireOverdueRedemptions } from './services/points';

type JobHandler = (payload: unknown) => Promise<unknown>;

const handlers: Record<string, JobHandler> = {
  EXPIRE_REDEMPTIONS: async () => {
    const expired = await expireOverdueRedemptions();
    return { expired };
  },
};

export async function enqueueJob(type: string, payload: unknown = null, runAt = new Date()) {
  return prisma.job.create({
    data: {
      type,
      payload: JSON.stringify(payload),
      runAt,
      status: 'PENDING',
    },
  });
}

export async function processDueJobs(limit = 25) {
  const now = new Date();
  const due = await prisma.job.findMany({
    where: {
      status: 'PENDING',
      runAt: { lte: now },
    },
    orderBy: { runAt: 'asc' },
    take: limit,
  });

  const results: Array<{ id: string; type: string; status: string; result?: unknown; error?: string }> = [];

  for (const job of due) {
    const locked = await prisma.job.updateMany({
      where: { id: job.id, status: 'PENDING' },
      data: { status: 'RUNNING', lockedAt: now, lockedBy: 'local-worker' },
    });

    if (locked.count !== 1) {
      continue;
    }

    const handler = handlers[job.type];
    if (!handler) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          lastError: `No handler registered for job type ${job.type}`,
          attempts: { increment: 1 },
        },
      });
      results.push({ id: job.id, type: job.type, status: 'FAILED', error: 'No handler registered' });
      continue;
    }

    try {
      const result = await handler(JSON.parse(job.payload));
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          attempts: { increment: 1 },
          lockedAt: null,
          lockedBy: null,
        },
      });
      results.push({ id: job.id, type: job.type, status: 'COMPLETED', result });
    } catch (error) {
      const attempts = job.attempts + 1;
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: attempts >= job.maxAttempts ? 'FAILED' : 'PENDING',
          attempts,
          lastError: error instanceof Error ? error.message : String(error),
          lockedAt: null,
          lockedBy: null,
          runAt: attempts >= job.maxAttempts ? job.runAt : new Date(Date.now() + attempts * 60 * 1000),
        },
      });
      results.push({
        id: job.id,
        type: job.type,
        status: attempts >= job.maxAttempts ? 'FAILED' : 'PENDING',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}