-- Team is now chosen per request/expense, not fixed on the user's account.
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_teamId_fkey";
ALTER TABLE "User" DROP COLUMN IF EXISTS "teamId";
