CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" TEXT,
  "actorName" TEXT,
  "actorEmail" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "expenseId" TEXT,
  "paymentRunId" TEXT,
  "teamId" TEXT,
  "targetUserId" TEXT,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");
CREATE INDEX "AuditEvent_expenseId_createdAt_idx" ON "AuditEvent"("expenseId", "createdAt");
CREATE INDEX "AuditEvent_paymentRunId_createdAt_idx" ON "AuditEvent"("paymentRunId", "createdAt");
CREATE INDEX "AuditEvent_teamId_createdAt_idx" ON "AuditEvent"("teamId", "createdAt");

ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_paymentRunId_fkey" FOREIGN KEY ("paymentRunId") REFERENCES "PaymentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve a searchable baseline for records that pre-date the audit trail.
INSERT INTO "AuditEvent" ("id", "createdAt", "action", "entityType", "entityId", "expenseId", "teamId", "targetUserId", "summary", "metadata")
SELECT
  'legacy-expense-' || e."id",
  e."submittedAt",
  'LEGACY_SNAPSHOT',
  'EXPENSE',
  e."id",
  e."id",
  e."teamId",
  e."userId",
  'Legacy expense record imported into the audit trail',
  jsonb_build_object(
    'status', e."status",
    'paymentStatus', e."paymentStatus",
    'amount', e."amount",
    'description', e."description",
    'submittedAt', e."submittedAt",
    'note', 'This is a baseline snapshot because detailed historical events were not stored before the audit trail was introduced.'
  )
FROM "Expense" e;
