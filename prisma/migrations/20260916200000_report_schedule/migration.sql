CREATE TABLE "ReportSchedule" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "hour" INTEGER NOT NULL DEFAULT 6,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastSentAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ReportSchedule" ("id", "enabled", "dayOfMonth", "hour", "timezone", "recipients", "lastSentAt", "updatedAt")
VALUES ('default', true, 1, 6, 'Europe/London', ARRAY[]::TEXT[], NULL, NOW());
