import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCancelledPaymentExpenseState,
  canEnterPaymentBatch,
  canReuseOpenWiseBatch,
  nextStatusAfterWiseBatchSync,
  shouldCreateNewWiseBatch,
} from '../lib/payment-workflow';

test('approved expenses A, B and C can all enter the same open Wise batch', () => {
  const run = {
    id: 'run-1',
    status: 'WISE_OPEN',
    wiseBatchGroupId: 'wise-batch-1',
  };

  assert.equal(canReuseOpenWiseBatch(run, 'NEW'), true);
  assert.equal(
    canEnterPaymentBatch({
      paymentStatus: 'READY',
      paymentRunId: null,
      status: 'READY_TO_PAY',
    }),
    true,
  );

  // The same open batch remains reusable for each subsequently approved expense.
  assert.equal(canReuseOpenWiseBatch(run, 'NEW'), true);
  assert.equal(canReuseOpenWiseBatch(run, 'NEW'), true);
});

test('a completed or cancelled Wise batch is not reused for new payments', () => {
  const run = {
    id: 'run-1',
    status: 'WISE_OPEN',
    wiseBatchGroupId: 'wise-batch-1',
  };

  assert.equal(canReuseOpenWiseBatch(run, 'COMPLETED'), false);
  assert.equal(canReuseOpenWiseBatch(run, 'CANCELLED'), false);
  assert.equal(shouldCreateNewWiseBatch(run, 'COMPLETED'), true);
  assert.equal(shouldCreateNewWiseBatch(run, 'CANCELLED'), true);
});

test('an expense already reserved in a payment run cannot enter another batch', () => {
  assert.equal(
    canEnterPaymentBatch({
      paymentStatus: 'EXPORTED',
      paymentRunId: 'run-1',
      status: 'PAYMENT_PENDING',
    }),
    false,
  );

  assert.equal(
    canEnterPaymentBatch({
      paymentStatus: 'READY',
      paymentRunId: null,
      status: 'READY_TO_PAY',
    }),
    true,
  );
});

test('cancelling a payment run returns every unpaid expense to Pending and clears approval/payment data', () => {
  const previous = {
    paymentRunId: 'run-1',
    paymentStatus: 'EXPORTED',
    status: 'PAYMENT_PENDING',
    approvedAmount: 42.5,
    decisionNote: 'Approved',
    decidedAt: new Date('2026-09-17T10:00:00Z'),
    paymentReference: 'PRO260917ABC123',
    wiseBatchGroupId: 'wise-batch-1',
    wiseTransferId: '12345',
    wiseStatus: 'incoming_payment_waiting',
    wasInCancelledPaymentRun: false,
  };

  const next = buildCancelledPaymentExpenseState(previous);

  assert.equal(next.paymentRunId, null);
  assert.equal(next.paymentStatus, 'NOT_READY');
  assert.equal(next.status, 'PENDING');
  assert.equal(next.approvedAmount, null);
  assert.equal(next.decisionNote, 'Payment run was cancelled. Approval is required again.');
  assert.equal(next.decidedAt, null);
  assert.equal(next.paymentReference, null);
  assert.equal(next.wiseBatchGroupId, null);
  assert.equal(next.wiseTransferId, null);
  assert.equal(next.wiseStatus, null);
  assert.equal(next.wasInCancelledPaymentRun, true);
});

test('cancelled expenses cannot jump straight back into a payment batch', () => {
  const cancelled = buildCancelledPaymentExpenseState({
    paymentRunId: 'run-1',
    paymentStatus: 'EXPORTED',
    status: 'PAYMENT_PENDING',
    approvedAmount: 100,
    decisionNote: 'Approved',
    decidedAt: new Date(),
    paymentReference: 'REF',
    wiseBatchGroupId: 'batch-1',
    wiseTransferId: '123',
    wiseStatus: 'incoming_payment_waiting',
  });

  assert.equal(
    canEnterPaymentBatch({
      paymentStatus: cancelled.paymentStatus,
      paymentRunId: cancelled.paymentRunId,
      status: cancelled.status,
    }),
    false,
  );

  // Re-approval produces the state required to enter the next open batch.
  assert.equal(
    canEnterPaymentBatch({
      paymentStatus: 'READY',
      paymentRunId: null,
      status: 'READY_TO_PAY',
    }),
    true,
  );
});

test('Wise sync keeps an open batch open while Wise reports NEW', () => {
  assert.equal(
    nextStatusAfterWiseBatchSync('WISE_OPEN', 'NEW', [
      'incoming_payment_waiting',
      'incoming_payment_waiting',
    ]),
    'WISE_OPEN',
  );
});

test('Wise sync marks an all-successful batch completed', () => {
  assert.equal(
    nextStatusAfterWiseBatchSync('WISE_PREPARED', 'COMPLETED', [
      'outgoing_payment_sent',
      'outgoing_payment_sent',
    ]),
    'COMPLETED',
  );
});

test('Wise sync marks a prepared batch with a failed transfer as prepared, not fully paid', () => {
  assert.equal(
    nextStatusAfterWiseBatchSync('WISE_PREPARED', 'COMPLETED', [
      'outgoing_payment_sent',
      'bounced_back',
    ]),
    'WISE_PREPARED',
  );
});

test('Wise sync requires recovery when Wise is in an unexpected state', () => {
  assert.equal(
    nextStatusAfterWiseBatchSync('WISE_OPEN', 'PROCESSING', [
      'incoming_payment_waiting',
    ]),
    'WISE_RECOVERY_REQUIRED',
  );
});

test('Wise sync cancellation wins over transfer states', () => {
  assert.equal(
    nextStatusAfterWiseBatchSync('WISE_OPEN', 'CANCELLED', [
      'outgoing_payment_sent',
    ]),
    'CANCELLED',
  );
});
