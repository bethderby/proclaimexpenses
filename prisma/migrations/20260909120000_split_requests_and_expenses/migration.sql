-- Rename enum to reflect that it now belongs to funding requests
ALTER TYPE "ExpenseStatus" RENAME TO "RequestStatus";

-- Rename the old Expense table (funding-request-with-approval-workflow) to FundingRequest
ALTER TABLE "Expense" RENAME TO "FundingRequest";
ALTER TABLE "FundingRequest" RENAME CONSTRAINT "Expense_pkey" TO "FundingRequest_pkey";
ALTER TABLE "FundingRequest" RENAME CONSTRAINT "Expense_teamId_fkey" TO "FundingRequest_teamId_fkey";
ALTER TABLE "FundingRequest" RENAME CONSTRAINT "Expense_userId_fkey" TO "FundingRequest_userId_fkey";

-- Requests no longer carry a receipt; receipts live on the new Expense table
ALTER TABLE "FundingRequest" DROP COLUMN "receiptUrl";

-- CreateTable: Expense now represents an actual purchase with a receipt
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "receiptUrl" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "FundingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
