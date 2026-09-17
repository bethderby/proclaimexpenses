-- Run with: npx prisma migrate deploy
-- Lets a requester cancel their own request before it's been approved/rejected.
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
