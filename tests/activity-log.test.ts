import test from 'node:test';
import assert from 'node:assert/strict';
import { buildActivityLogRows, buildActivityLogText } from '../lib/activity-log';

const event = {
  id: 'audit-1',
  createdAt: new Date('2026-09-17T10:30:00Z'),
  actorName: 'Admin User',
  actorEmail: 'admin@example.com',
  action: 'EXPENSE_APPROVED',
  entityType: 'EXPENSE',
  entityId: 'expense-1',
  expenseId: 'expense-1',
  paymentRunId: null,
  teamId: 'team-1',
  targetUserId: 'user-1',
  summary: 'Expense approved and made ready to pay',
  metadata: { amount: 42.5, decision: 'APPROVED' },
};

test('activity rows contain audit identifiers and metadata', () => {
  const [row] = buildActivityLogRows([event]);
  assert.equal(row.Action, 'EXPENSE_APPROVED');
  assert.equal(row['Expense ID'], 'expense-1');
  assert.match(row.Metadata, /42.5/);
  assert.equal(row['Audit event ID'], 'audit-1');
});

test('activity text includes every event and its identifiers', () => {
  const text = buildActivityLogText(new Date('2026-09-01T00:00:00Z'), new Date('2026-09-17T23:59:59Z'), [event]);
  assert.match(text, /PROCLAIM EXPENSES FULL ACTIVITY LOG/);
  assert.match(text, /EXPENSE_APPROVED/);
  assert.match(text, /expense-1/);
  assert.match(text, /audit-1/);
  assert.match(text, /ALL/);
});
