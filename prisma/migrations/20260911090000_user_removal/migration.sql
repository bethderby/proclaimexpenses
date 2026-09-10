-- Run with: npx prisma migrate deploy
-- Adds a soft-delete marker so removed users keep their historical
-- Expenses and approved FundingRequests intact (name/email preserved),
-- while being blocked from signing back in (see lib/auth.ts).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3);
