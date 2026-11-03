import { prisma } from './prisma';

export async function runWithIdempotency<T>(
  scope: string,
  key: string | null | undefined,
  actorId: string | null | undefined,
  requestHash: string,
  executor: () => Promise<T>
): Promise<T> {
  if (!key) {
    return executor();
  }

  const normalizedActorId = actorId ?? null;
  const existing = await prisma.idempotencyKey.findUnique({
    where: {
      scope_key_actorId: {
        scope,
        key,
        actorId: normalizedActorId as string,
      },
    },
  });

  if (existing?.status === 'COMPLETED' && existing.response) {
    return JSON.parse(existing.response) as T;
  }

  if (existing?.status === 'PENDING') {
    throw new Error('IDEMPOTENCY_IN_PROGRESS: This request is already being processed');
  }

  let record;
  try {
    record = await prisma.idempotencyKey.create({
      data: {
        scope,
        key,
        actorId: normalizedActorId as string,
        requestHash,
        status: 'PENDING',
      },
    });
  } catch {
    const raced = await prisma.idempotencyKey.findUnique({
      where: {
        scope_key_actorId: {
          scope,
          key,
          actorId: normalizedActorId as string,
        },
      },
    });

    if (raced?.status === 'COMPLETED' && raced.response) {
      return JSON.parse(raced.response) as T;
    }

    throw new Error('IDEMPOTENCY_IN_PROGRESS: This request is already being processed');
  }

  try {
    const result = await executor();
    await prisma.idempotencyKey.update({
      where: { id: record.id },
      data: {
        status: 'COMPLETED',
        response: JSON.stringify(result),
        completedAt: new Date(),
      },
    });
    return result;
  } catch (error) {
    await prisma.idempotencyKey.delete({ where: { id: record.id } }).catch(() => undefined);
    throw error;
  }
}