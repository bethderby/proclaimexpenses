import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

function deterministicWiseTransactionId(paymentRunId: string, expenseId: string) {
  const hash = crypto.createHash('sha256').update(`proclaim-payment-run:${paymentRunId}:expense:${expenseId}`).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-${((parseInt(hash.slice(16,18), 16) & 0x3f) | 0x80).toString(16).padStart(2,'0')}${hash.slice(18,20)}-${hash.slice(20,32)}`;
}

test('Wise transaction IDs are deterministic UUID-shaped values', () => {
  const a = deterministicWiseTransactionId('run-1', 'expense-1');
  const b = deterministicWiseTransactionId('run-1', 'expense-1');
  const c = deterministicWiseTransactionId('run-1', 'expense-2');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
