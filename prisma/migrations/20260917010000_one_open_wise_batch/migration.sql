-- Final database-level guard: only one editable Wise batch may exist at a time.
-- Use the enum value directly in the predicate. Casting the enum to text
-- makes PostgreSQL reject the partial index because the cast is not
-- considered immutable for an index predicate.
CREATE UNIQUE INDEX "PaymentRun_one_open_batch_key"
  ON "PaymentRun" ("status")
  WHERE "status" = 'WISE_OPEN'::"PaymentRunStatus";
