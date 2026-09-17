-- Expense workflow migration.
-- Existing FundingRequest rows are intentionally retained as legacy history.

CREATE TYPE "PurchaseMode" AS ENUM ('ALREADY_PURCHASED', 'NEEDS_ADVANCE', 'WILL_PURCHASE_LATER');
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'AWAITING_PURCHASE', 'READY_TO_PAY', 'PAYMENT_PENDING', 'ADVANCE_PAID_AWAITING_RECEIPT', 'PAID', 'PAYMENT_FAILED');
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_READY', 'READY', 'EXPORTED', 'PAID', 'FAILED');
CREATE TYPE "PaymentRunStatus" AS ENUM ('DRAFT', 'EXPORTED', 'COMPLETED', 'CANCELLED');

ALTER TABLE "User" ADD COLUMN "bankAccountName" TEXT;
ALTER TABLE "User" ADD COLUMN "bankSortCode" TEXT;
ALTER TABLE "User" ADD COLUMN "bankAccountNumber" TEXT;

ALTER TABLE "Expense" ALTER COLUMN "receiptUrl" DROP NOT NULL;
ALTER TABLE "Expense" ADD COLUMN "purchaseMode" "PurchaseMode" NOT NULL DEFAULT 'ALREADY_PURCHASED';
ALTER TABLE "Expense" ADD COLUMN "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Expense" ADD COLUMN "receiptDueAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN "lastReminderAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Expense" ADD COLUMN "decisionNote" TEXT;
ALTER TABLE "Expense" ADD COLUMN "decidedAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN "purchasedAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_READY';
ALTER TABLE "Expense" ADD COLUMN "paymentRunId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "paymentReference" TEXT;
ALTER TABLE "Expense" ADD COLUMN "paidAt" TIMESTAMP(3);

-- Existing logged expenses were already submitted as completed expenses in the old app.
-- Keep them out of the new payment queue until an admin deliberately re-enters/reviews them.
UPDATE "Expense"
SET "status" = 'APPROVED', "purchaseMode" = 'ALREADY_PURCHASED', "purchasedAt" = "date"
WHERE "status" = 'PENDING';

CREATE TABLE "PaymentRun" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "status" "PaymentRunStatus" NOT NULL DEFAULT 'DRAFT',
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "exportedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdById" TEXT,
  CONSTRAINT "PaymentRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRun_reference_key" ON "PaymentRun"("reference");
CREATE INDEX "Expense_paymentRunId_idx" ON "Expense"("paymentRunId");
CREATE INDEX "Expense_status_idx" ON "Expense"("status");
CREATE INDEX "Expense_receiptDueAt_idx" ON "Expense"("receiptDueAt");

ALTER TABLE "PaymentRun" ADD CONSTRAINT "PaymentRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paymentRunId_fkey" FOREIGN KEY ("paymentRunId") REFERENCES "PaymentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
