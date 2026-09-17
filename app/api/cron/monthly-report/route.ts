import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendCombinedReport } from '@/lib/report';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { recordAuditEvent } from '@/lib/audit';

function getLocalParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour), minute: Number(values.minute) };
}

function formatDateRange(start: Date, end: Date) { return `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`; }

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const schedule = await prisma.reportSchedule.findUnique({ where: { id: 'default' } });
  if (!schedule) return NextResponse.json({ ok: true, skipped: true, reason: 'Report schedule has not been configured.' });
  if (!schedule.enabled) return NextResponse.json({ ok: true, skipped: true, reason: 'Automatic report sending is disabled.' });

  const now = new Date();
  const local = getLocalParts(now, schedule.timezone || 'Europe/London');
  // Vercel Hobby cron jobs can run at most once per day. The cron is therefore
  // scheduled daily at 06:00 UTC, and the saved schedule controls the day of
  // month. The saved hour is retained for display/future plans but is not used
  // as a second cron trigger on Hobby.
  if (local.day !== schedule.dayOfMonth) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Not scheduled day.' });
  }
  if (schedule.lastSentAt) {
    const last = getLocalParts(schedule.lastSentAt, schedule.timezone || 'Europe/London');
    if (last.year === local.year && last.month === local.month) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'This month has already been sent.' });
    }
  }

  const start = new Date(local.year, local.month - 2, 1);
  const end = new Date(local.year, local.month - 1, 1);
  try {
    const result = await sendCombinedReport(start, end, { recipients: schedule.recipients });
    await prisma.reportSchedule.update({ where: { id: 'default' }, data: { lastSentAt: now } });
    await recordAuditEvent({ action: 'MONTHLY_REPORT_SENT', entityType: 'REPORT', entityId: 'monthly', summary: `Automated monthly report sent for ${formatDateRange(start, end)}`, metadata: { start: start.toISOString(), end: end.toISOString(), recipients: schedule.recipients, result } });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not send report.' }, { status: 500 });
  }
}
