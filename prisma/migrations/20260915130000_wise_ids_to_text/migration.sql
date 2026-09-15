-- Wise IDs are not guaranteed to fit PostgreSQL INT4. Store external Wise
-- identifiers as text so future IDs cannot overflow a 32-bit integer column.
ALTER TABLE "Expense"
  ALTER COLUMN "wiseRecipientId" TYPE TEXT USING "wiseRecipientId"::TEXT,
  ALTER COLUMN "wiseTransferId" TYPE TEXT USING "wiseTransferId"::TEXT;
