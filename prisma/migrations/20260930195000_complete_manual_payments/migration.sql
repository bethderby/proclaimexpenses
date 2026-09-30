-- Expenses that were already paid manually may have progressed beyond
-- READY_TO_PAY into PAYMENT_PENDING because a Wise run/transfer was prepared.
-- In manual-payment mode approval is the final app state, so normalize both
-- pre-payment states to APPROVED.
--
-- Keep paymentRunId intact so the historical payment-run relationship remains
-- visible in the database, but detach Wise transfer identifiers so subsequent
-- Wise webhooks cannot move these manually completed expenses back into a Wise
-- payment lifecycle.
UPDATE "Expense"
SET
    "status" = 'APPROVED',
    "paymentStatus" = 'NOT_READY',
    "wiseTransferId" = NULL,
    "wiseStatus" = NULL
WHERE "status" IN ('READY_TO_PAY', 'PAYMENT_PENDING');
