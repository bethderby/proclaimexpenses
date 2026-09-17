-- Final database-level guard: only one editable Wise batch may exist at a time.
-- This is a separate migration because PostgreSQL must commit the new enum
-- value before it can be used by this partial index.
CREATE UNIQUE INDEX "PaymentRun_one_open_batch_key"
  ON "PaymentRun" (("status"))
  WHERE "status"::text = 'WISE_OPEN';
