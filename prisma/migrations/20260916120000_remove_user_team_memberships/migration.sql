-- Users do not belong to teams. Teams only store the email addresses of their configured approvers,
-- while each expense stores its own teamId. Preserve the existing approver configuration
-- before removing the TeamMember relation.
ALTER TABLE "Team" ADD COLUMN "approverEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Team" t
SET "approverEmails" = (
  SELECT COALESCE(array_agg(DISTINCT lower(s.email)), ARRAY[]::TEXT[])
  FROM (
    SELECT t."approverEmail" AS email
    UNION ALL
    SELECT u.email
    FROM "TeamMember" tm
    JOIN "User" u ON u.id = tm."userId"
    WHERE tm."teamId" = t.id
      AND tm."role" = 'APPROVER'
  ) s
  WHERE s.email IS NOT NULL
);

ALTER TABLE "Team" DROP COLUMN IF EXISTS "approverEmail";
DROP TABLE IF EXISTS "TeamMember";
DROP TYPE IF EXISTS "TeamMemberRole";
