import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type AuditActor = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

export type AuditEventInput = {
  actor?: AuditActor | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  expenseId?: string | null;
  paymentRunId?: string | null;
  teamId?: string | null;
  targetUserId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
};

export function sanitiseAuditMetadata(metadata?: Record<string, unknown> | null) {
  if (!metadata) return null;
  const sensitive = /bank|account(number|name)?|sort.?code|access.?token|refresh.?token|id.?token|secret|password/i;
  const scrub = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(scrub);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, sensitive.test(key) ? '[REDACTED]' : scrub(child)]));
    }
    return value;
  };
  return scrub(metadata) as Record<string, unknown>;
}

export function auditEventData(input: AuditEventInput) {
  return {
    actorId: input.actor?.id ?? null,
    actorName: input.actor?.name ?? null,
    actorEmail: input.actor?.email ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    expenseId: input.expenseId ?? null,
    paymentRunId: input.paymentRunId ?? null,
    teamId: input.teamId ?? null,
    targetUserId: input.targetUserId ?? null,
    summary: input.summary,
    metadata: input.metadata == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(input.metadata)) as Prisma.InputJsonValue,
  };
}

export async function recordAuditEvent(input: AuditEventInput) {
  return prisma.auditEvent.create({ data: auditEventData(input) });
}

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
