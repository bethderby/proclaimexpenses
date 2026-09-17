export type PaymentExpenseState = {
  paymentRunId: string | null;
  paymentStatus: string;
  status: string;
  approvedAmount?: unknown;
  decisionNote?: string | null;
  decidedAt?: Date | null;
  paymentReference?: string | null;
  wiseBatchGroupId?: string | null;
  wiseTransferId?: string | null;
  wiseStatus?: string | null;
  wasInCancelledPaymentRun?: boolean;
};

export type PaymentRunState = {
  id: string;
  status: string;
  wiseBatchGroupId: string | null;
  wiseStatus?: string | null;
};

export function canReuseOpenWiseBatch(
  run: PaymentRunState | null,
  wiseBatchStatus: string,
): boolean {
  if (!run?.wiseBatchGroupId || run.status !== 'WISE_OPEN') return false;
  return wiseBatchStatus.toUpperCase() === 'NEW';
}

export function shouldCreateNewWiseBatch(
  run: PaymentRunState | null,
  wiseBatchStatus: string,
): boolean {
  if (!run) return true;
  if (!run.wiseBatchGroupId) return true;
  if (run.status !== 'WISE_OPEN') return true;

  const status = wiseBatchStatus.toUpperCase();
  return status === 'COMPLETED' || status === 'CANCELLED';
}

export function buildCancelledPaymentExpenseState(
  previous: PaymentExpenseState,
): PaymentExpenseState {
  return {
    ...previous,
    paymentRunId: null,
    paymentStatus: 'NOT_READY',
    status: 'PENDING',
    approvedAmount: null,
    decisionNote: 'Payment run was cancelled. Approval is required again.',
    decidedAt: null,
    paymentReference: null,
    wiseBatchGroupId: null,
    wiseTransferId: null,
    wiseStatus: null,
    wasInCancelledPaymentRun: true,
  };
}

export function canEnterPaymentBatch(expense: {
  paymentStatus: string;
  paymentRunId: string | null;
  status: string;
}): boolean {
  return (
    expense.paymentStatus === 'READY' &&
    expense.paymentRunId === null &&
    expense.status === 'READY_TO_PAY'
  );
}

/** Wise's hard limit on the number of transfers a single batch group can hold. */
export const WISE_BATCH_TRANSFER_LIMIT = 1000;

/**
 * De-duplicates a list of expense IDs, dropping any falsy entries. Used
 * before reserving expenses for a Wise batch so the same expense is never
 * reserved twice from a single request (e.g. a submitted form with a
 * repeated checkbox value).
 */
export function dedupeExpenseIds(expenseIds: string[]): string[] {
  return [...new Set(expenseIds.filter(Boolean))];
}

/**
 * True if adding `incomingCount` more transfers to a batch that already has
 * `existingCount` would exceed Wise's per-batch transfer limit. Checked
 * before calling Wise so we fail fast locally with a clear message instead
 * of partway through adding transfers.
 */
export function wouldExceedWiseBatchLimit(
  existingCount: number,
  incomingCount: number,
  limit: number = WISE_BATCH_TRANSFER_LIMIT,
): boolean {
  return existingCount + incomingCount > limit;
}

/**
 * Wise recipient ("account") IDs are returned as numbers by the Wise API but
 * often round-trip through storage/URLs as strings. Validates that a value
 * is a genuine safe-integer ID rather than silently coercing something like
 * "12abc" (which `Number()` turns into `NaN`, and worse, empty string which
 * `Number()` turns into `0`) into a request to Wise.
 */
export function parseWiseRecipientId(value: string | number): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`Invalid Wise recipient ID: ${JSON.stringify(value)}.`);
  }
  return id;
}

export function nextStatusAfterWiseBatchSync(
  runStatus: string,
  batchStatus: string,
  transferStatuses: string[],
): string {
  const batch = batchStatus.toUpperCase();
  const transfers = transferStatuses.map(s => s.toLowerCase());

  if (batch === 'CANCELLED') return 'CANCELLED';
  if (batch === 'NEW' && runStatus === 'WISE_OPEN') return 'WISE_OPEN';

  const allSuccessful =
    transfers.length > 0 &&
    transfers.every(s => s === 'outgoing_payment_sent');

  const allComplete =
    transfers.length > 0 &&
    transfers.every(s =>
      ['outgoing_payment_sent', 'bounced_back', 'funds_refunded', 'cancelled'].includes(s),
    );

  if (allSuccessful) return 'COMPLETED';
  if (batch === 'COMPLETED' && allComplete) return 'WISE_PREPARED';
  return 'WISE_RECOVERY_REQUIRED';
}
