-- Keep one editable Wise batch open at a time. Approved expenses are added
-- to this batch immediately; it is only closed when an approver explicitly
-- completes the batch.
ALTER TYPE "PaymentRunStatus" ADD VALUE IF NOT EXISTS 'WISE_OPEN';

CREATE TABLE "WiseBatchLock" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "lockToken" TEXT,
  "lockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WiseBatchLock_pkey" PRIMARY KEY ("id")
);

INSERT INTO "WiseBatchLock" ("id", "lockToken", "lockedUntil", "updatedAt")
VALUES ('default', NULL, NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

