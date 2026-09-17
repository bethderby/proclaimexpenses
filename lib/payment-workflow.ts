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
