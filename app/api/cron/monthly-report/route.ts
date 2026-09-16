import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendCombinedReport } from '@/lib/report';

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

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const schedule = await prisma.reportSchedule.findUnique({ where: { id: 'default' } });
  if (!schedule) return NextResponse.json({ ok: true, skipped: true, reason: 'Report schedule has not been configured.' });
  if (!schedule.enabled) return NextResponse.json({ ok: true, skipped: true, reason: 'Automatic report sending is disabled.' });

  const now = new Date();
  const local = getLocalParts(now, schedule.timezone || 'Europe/London');
  if (local.day !== schedule.dayOfMonth || local.hour !== schedule.hour) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Not scheduled time.' });
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
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not send report.' }, { status: 500 });
  }
}
