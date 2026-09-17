-- Replace the legacy FundingRequest concept with one unified Expense workflow.
-- This database currently contains example FundingRequest data only.

ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_requestId_fkey";
ALTER TABLE "Expense" DROP COLUMN IF EXISTS "requestId";
DROP TABLE IF EXISTS "FundingRequest";
DROP TYPE IF EXISTS "RequestStatus";

CREATE TYPE "PurchaseStatus" AS ENUM ('ALREADY_PURCHASED', 'NOT_PURCHASED');
CREATE TYPE "PaymentTiming" AS ENUM ('AFTER_PURCHASE', 'ADVANCE');
CREATE TYPE "SettlementStatus" AS ENUM ('NOT_APPLICABLE', 'AWAITING_RECEIPT', 'SETTLED', 'BALANCE_TO_RETURN', 'ADDITIONAL_REIMBURSEMENT_REQUIRED');

ALTER TABLE "Expense" ADD COLUMN "purchaseStatus" "PurchaseStatus" NOT NULL DEFAULT 'ALREADY_PURCHASED';
ALTER TABLE "Expense" ADD COLUMN "paymentTiming" "PaymentTiming" NOT NULL DEFAULT 'AFTER_PURCHASE';
ALTER TABLE "Expense" ADD COLUMN "approvedAmount" DOUBLE PRECISION;
ALTER TABLE "Expense" ADD COLUMN "actualAmount" DOUBLE PRECISION;
ALTER TABLE "Expense" ADD COLUMN "advanceAmount" DOUBLE PRECISION;
ALTER TABLE "Expense" ADD COLUMN "settlementStatus" "SettlementStatus" NOT NULL DEFAULT 'NOT_APPLICABLE';
ALTER TABLE "Expense" ADD COLUMN "settlementNote" TEXT;
ALTER TABLE "Expense" ADD COLUMN "wiseRecipientId" INTEGER;
ALTER TABLE "Expense" ADD COLUMN "wiseTransferId" INTEGER;
ALTER TABLE "Expense" ADD COLUMN "wiseBatchGroupId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "wiseStatus" TEXT;

UPDATE "Expense"
SET "purchaseStatus" = CASE
  WHEN "purchaseMode" = 'ALREADY_PURCHASED' THEN 'ALREADY_PURCHASED'::"PurchaseStatus"
  ELSE 'NOT_PURCHASED'::"PurchaseStatus"
END,
"paymentTiming" = CASE
  WHEN "purchaseMode" = 'NEEDS_ADVANCE' THEN 'ADVANCE'::"PaymentTiming"
  ELSE 'AFTER_PURCHASE'::"PaymentTiming"
END;

UPDATE "Expense"
SET "settlementStatus" = CASE
  WHEN "purchaseMode" = 'NEEDS_ADVANCE' THEN 'AWAITING_RECEIPT'::"SettlementStatus"
  ELSE 'NOT_APPLICABLE'::"SettlementStatus"
END;

ALTER TABLE "Expense" DROP COLUMN "purchaseMode";
DROP TYPE "PurchaseMode";

ALTER TABLE "PaymentRun" ADD COLUMN "wiseBatchGroupId" TEXT;
ALTER TABLE "PaymentRun" ADD COLUMN "wiseStatus" TEXT;

CREATE TYPE "PaymentRunStatus_new" AS ENUM ('DRAFT', 'WISE_PREPARED', 'WISE_FUNDED', 'COMPLETED', 'CANCELLED');
ALTER TABLE "PaymentRun" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PaymentRun" ALTER COLUMN "status" TYPE "PaymentRunStatus_new" USING (
  CASE
    WHEN "status"::text = 'EXPORTED' THEN 'WISE_PREPARED'::"PaymentRunStatus_new"
    ELSE "status"::text::"PaymentRunStatus_new"
  END
);
DROP TYPE "PaymentRunStatus";
ALTER TYPE "PaymentRunStatus_new" RENAME TO "PaymentRunStatus";
ALTER TABLE "PaymentRun" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- Example-only legacy rows were removed above. Existing expenses are preserved.
