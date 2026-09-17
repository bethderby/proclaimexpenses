import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeExpenseIds,
  wouldExceedWiseBatchLimit,
  parseWiseRecipientId,
  WISE_BATCH_TRANSFER_LIMIT,
} from '../lib/payment-workflow';

// addExpensesToOpenWiseBatch itself talks to Postgres and the live Wise API,
// so it isn't unit-tested directly. These are the decision points it relies
// on before making any of those calls, pulled out into pure functions so the
// riskiest edge cases - duplicate expense ids, the 1,000-transfer cap, and a
// malformed recipient id - are covered without needing a database or network
// mocking.

test('dedupeExpenseIds removes duplicates and falsy entries, preserving order', () => {
  assert.deepEqual(
    dedupeExpenseIds(['a', 'b', 'a', '', 'c', 'b']),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(dedupeExpenseIds([]), []);
});

test('wouldExceedWiseBatchLimit is false right up to the limit and true one over it', () => {
  assert.equal(wouldExceedWiseBatchLimit(0, WISE_BATCH_TRANSFER_LIMIT), false);
  assert.equal(wouldExceedWiseBatchLimit(0, WISE_BATCH_TRANSFER_LIMIT + 1), true);
  assert.equal(wouldExceedWiseBatchLimit(998, 2), false);
  assert.equal(wouldExceedWiseBatchLimit(998, 3), true);
});

test('wouldExceedWiseBatchLimit respects a custom limit', () => {
  assert.equal(wouldExceedWiseBatchLimit(5, 5, 10), false);
  assert.equal(wouldExceedWiseBatchLimit(5, 6, 10), true);
});

test('parseWiseRecipientId accepts a genuine positive integer, from a number or a string', () => {
  assert.equal(parseWiseRecipientId(12345), 12345);
  assert.equal(parseWiseRecipientId('12345'), 12345);
});

test('parseWiseRecipientId rejects values that would silently become the wrong request', () => {
  // Number('') is 0, not NaN - a naive `Number(value) || fail` check would
  // let an empty recipient id through as account 0.
  assert.throws(() => parseWiseRecipientId(''), /Invalid Wise recipient ID/);
  assert.throws(() => parseWiseRecipientId('12abc'), /Invalid Wise recipient ID/);
  assert.throws(() => parseWiseRecipientId('0'), /Invalid Wise recipient ID/);
  assert.throws(() => parseWiseRecipientId('-5'), /Invalid Wise recipient ID/);
  assert.throws(() => parseWiseRecipientId('1.5'), /Invalid Wise recipient ID/);
  assert.throws(() => parseWiseRecipientId(Number.MAX_SAFE_INTEGER + 1), /Invalid Wise recipient ID/);
});
