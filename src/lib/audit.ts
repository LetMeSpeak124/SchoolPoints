import { Prisma } from '@prisma/client';

export type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'>;

export interface AuditEvent {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: unknown;
}

/**
 * Writes an audit event using the same transaction client as the action it
 * records. Callers should pass `tx` from prisma.$transaction when possible so
 * the audit record commits or rolls back with the business change.
 */
export async function logAudit(db: AuditClient, event: AuditEvent): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: event.actorId ?? null,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      details: event.details === undefined ? null : JSON.stringify(event.details),
    },
  });
}
