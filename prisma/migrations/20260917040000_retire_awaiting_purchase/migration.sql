-- AWAITING_PURCHASE is retired. Expenses that reached this legacy state
-- are restored to the common approved/ready state. New submissions enforce
-- NOT_PURCHASED => ADVANCE, so an approved not-yet-purchased expense is paid
-- immediately and the receipt is collected afterwards.
UPDATE "Expense"
SET
  "status" = 'READY_TO_PAY',
  "paymentStatus" = 'READY'::"PaymentStatus"
WHERE "status" = 'AWAITING_PURCHASE';
