import test from 'node:test';
import assert from 'node:assert/strict';
import { auditEventData, sanitiseAuditMetadata } from '../lib/audit';

test('audit metadata is JSON-safe and preserves structured values', () => {
  const input = { amount: 12.5, nested: { status: 'PAID' }, list: ['a', 'b'] };
  assert.deepEqual(sanitiseAuditMetadata(input), input);
});

test('audit event data snapshots actor and links targets', () => {
  const data = auditEventData({
    actor: { id: 'u1', name: 'Alex', email: 'alex@example.com' },
    action: 'EXPENSE_APPROVED',
    entityType: 'EXPENSE',
    entityId: 'e1',
    expenseId: 'e1',
    teamId: 't1',
    targetUserId: 'u2',
    summary: 'Expense approved',
    metadata: { amount: 25 },
  });
  assert.equal(data.actorId, 'u1');
  assert.equal(data.actorEmail, 'alex@example.com');
  assert.equal(data.expenseId, 'e1');
  assert.equal(data.targetUserId, 'u2');
  assert.deepEqual(data.metadata, { amount: 25 });
});

test('audit event data never stores bank account numbers', () => {
  const data = auditEventData({ actor: { id: 'u1' }, action: 'BANK_DETAILS_UPDATED', entityType: 'USER', entityId: 'u1', summary: 'Bank details updated', metadata: { sortCodeLast4: '1234', accountNumberLast4: '5678' } });
  const json = JSON.stringify(data);
  assert.equal(json.includes('accountNumber'), true);
  assert.equal(json.includes('12345678'), false);
});
