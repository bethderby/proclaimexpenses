-- Convert monetary values from floating point to fixed-point decimal.
-- Rounding to two decimal places preserves the application's pounds-and-pence contract.
ALTER TABLE "Team"
  ALTER COLUMN "budgetTarget" TYPE DECIMAL(12,2)
  USING ROUND("budgetTarget"::numeric, 2);

ALTER TABLE "PaymentRun"
  ALTER COLUMN "totalAmount" TYPE DECIMAL(12,2)
  USING ROUND("totalAmount"::numeric, 2);

ALTER TABLE "Expense"
  ALTER COLUMN "amount" TYPE DECIMAL(12,2)
  USING ROUND("amount"::numeric, 2),
  ALTER COLUMN "approvedAmount" TYPE DECIMAL(12,2)
  USING CASE WHEN "approvedAmount" IS NULL THEN NULL ELSE ROUND("approvedAmount"::numeric, 2) END,
  ALTER COLUMN "actualAmount" TYPE DECIMAL(12,2)
  USING CASE WHEN "actualAmount" IS NULL THEN NULL ELSE ROUND("actualAmount"::numeric, 2) END,
  ALTER COLUMN "advanceAmount" TYPE DECIMAL(12,2)
  USING CASE WHEN "advanceAmount" IS NULL THEN NULL ELSE ROUND("advanceAmount"::numeric, 2) END;
