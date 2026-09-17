import { formatReportDate, formatUKDateTime } from '@/lib/date';
import { formatAuditValue } from '@/lib/audit';

export type ActivityLogEvent = {
  id: string;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  expenseId: string | null;
  paymentRunId: string | null;
  teamId: string | null;
  targetUserId: string | null;
  summary: string;
  metadata: unknown;
};

export type ActivityLogRow = {
  Timestamp: string;
  Action: string;
  Entity: string;
  'Entity ID': string;
  Actor: string;
  'Actor email': string;
  Summary: string;
  'Expense ID': string;
  'Payment run ID': string;
  'Team ID': string;
  'Target user ID': string;
  Metadata: string;
  'Audit event ID': string;
};

export function buildActivityLogRows(events: ActivityLogEvent[]): ActivityLogRow[] {
  return events.map((event) => ({
    Timestamp: formatUKDateTime(event.createdAt),
    Action: event.action,
    Entity: event.entityType,
    'Entity ID': event.entityId ?? '',
    Actor: event.actorName ?? '',
    'Actor email': event.actorEmail ?? '',
    Summary: event.summary,
    'Expense ID': event.expenseId ?? '',
    'Payment run ID': event.paymentRunId ?? '',
    'Team ID': event.teamId ?? '',
    'Target user ID': event.targetUserId ?? '',
    Metadata: formatAuditValue(event.metadata),
    'Audit event ID': event.id,
  }));
}

export function buildActivityLogText(start: Date, end: Date, events: ActivityLogEvent[]) {
  const rows = buildActivityLogRows(events);
  const lines = [
    'PROCLAIM EXPENSES FULL ACTIVITY LOG',
    '====================================',
    `Date range: ${formatReportDate(start)} to ${formatReportDate(end)}`,
    'Teams: ALL',
    `Events: ${rows.length}`,
    `Generated: ${formatUKDateTime(new Date())}`,
    '',
  ];
  rows.forEach((row, index) => {
    lines.push(
      `EVENT ${index + 1}`,
      '------------------------------------',
      `Timestamp: ${row.Timestamp}`,
      `Action: ${row.Action}`,
      `Entity: ${row.Entity}`,
      `Entity ID: ${row['Entity ID']}`,
      `Actor: ${row.Actor}`,
      `Actor email: ${row['Actor email']}`,
      `Summary: ${row.Summary}`,
      `Expense ID: ${row['Expense ID']}`,
      `Payment run ID: ${row['Payment run ID']}`,
      `Team ID: ${row['Team ID']}`,
      `Target user ID: ${row['Target user ID']}`,
      `Metadata: ${row.Metadata}`,
      `Audit event ID: ${row['Audit event ID']}`,
      '',
    );
  });
  return lines.join('\r\n');
}
