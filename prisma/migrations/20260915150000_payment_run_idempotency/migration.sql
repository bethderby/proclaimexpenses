-- Prevent two concurrent Prepare Wise payment run requests from creating
-- separate local runs for the same set of expenses.
ALTER TYPE "PaymentRunStatus" ADD VALUE IF NOT EXISTS 'WISE_RECOVERY_REQUIRED';

ALTER TABLE "PaymentRun" ADD COLUMN "preparationKey" TEXT;
CREATE UNIQUE INDEX "PaymentRun_preparationKey_key" ON "PaymentRun"("preparationKey");
