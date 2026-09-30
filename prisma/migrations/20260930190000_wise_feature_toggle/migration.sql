CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "wiseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AppSettings" ("id", "wiseEnabled", "updatedAt")
VALUES ('default', true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Existing expenses that were waiting for Wise/manual payment before this
-- feature toggle are treated as complete approvals in manual mode. Keep any
-- paymentRunId relationship intact so existing payment-run history is not
-- deleted, but remove the expense from the active payable queue.
UPDATE "Expense"
SET
    "status" = 'APPROVED',
    "paymentStatus" = 'NOT_READY'
WHERE "status" = 'READY_TO_PAY';
