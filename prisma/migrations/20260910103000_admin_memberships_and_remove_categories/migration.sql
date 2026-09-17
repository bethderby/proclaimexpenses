-- Run with: npx prisma migrate deploy
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Team" ALTER COLUMN "approverEmail" DROP NOT NULL;
CREATE TYPE "TeamMemberRole" AS ENUM ('USER', 'APPROVER');
CREATE TABLE IF NOT EXISTS "TeamMember" (
  "id" TEXT NOT NULL,
  "role" "TeamMemberRole" NOT NULL DEFAULT 'USER',
  "userId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeamMember_userId_teamId_key" UNIQUE ("userId", "teamId"),
  CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "TeamMember" ("id", "role", "userId", "teamId")
SELECT 'legacy_' || md5(random()::text || clock_timestamp()::text), 'APPROVER'::"TeamMemberRole", u.id, t.id
FROM "Team" t JOIN "User" u ON lower(u.email) = lower(t."approverEmail")
WHERE t."approverEmail" IS NOT NULL
ON CONFLICT ("userId", "teamId") DO NOTHING;

ALTER TABLE "Expense" DROP COLUMN IF EXISTS "category";
ALTER TABLE "FundingRequest" DROP COLUMN IF EXISTS "category";
