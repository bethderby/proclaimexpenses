ALTER TABLE "Team" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Team_archivedAt_idx" ON "Team"("archivedAt");
