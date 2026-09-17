'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent } from '@/lib/audit';
import { requireUser } from './shared';

function parseReportRecipients(value: string) {
  return [...new Set(value.split(/[\n,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

export async function sendReportNow(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Only admins can send reports.');
  const startValue = String(formData.get('start') || '');
  const endValue = String(formData.get('end') || '');
  if (!startValue || !endValue) throw new Error('Choose a start and end date.');
  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) throw new Error('Choose a valid date range.');
  const schedule = await prisma.reportSchedule.findUnique({ where: { id: 'default' }, select: { recipients: true } });
  const { sendCombinedReport } = await import('@/lib/report');
  await sendCombinedReport(start, new Date(end.getTime() + 1), { manual: true, recipients: schedule?.recipients ?? [] });
  await recordAuditEvent({ actor: user, action: 'REPORT_SENT', entityType: 'REPORT', entityId: null, summary: `Report sent for ${startValue} to ${endValue}`, metadata: { start: startValue, end: endValue, recipients: schedule?.recipients ?? [] } });
  revalidatePath('/dashboard/reports');
}

export async function saveReportSchedule(formData: FormData) {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error('Only admins can change report settings.');
  const enabled = String(formData.get('enabled') || '') === 'true';
  const dayOfMonth = Number(formData.get('dayOfMonth'));
  const hour = 6;
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) throw new Error('Choose a day from 1 to 28.');
  const recipients = parseReportRecipients(String(formData.get('recipients') || ''));
  for (const email of recipients) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Invalid recipient email: ${email}`);
  }
  await prisma.reportSchedule.upsert({
    where: { id: 'default' },
    update: { enabled, dayOfMonth, hour, timezone: 'Europe/London', recipients },
    create: { id: 'default', enabled, dayOfMonth, hour, timezone: 'Europe/London', recipients },
  });
  await recordAuditEvent({ actor: user, action: 'REPORT_SCHEDULE_UPDATED', entityType: 'REPORT_SCHEDULE', entityId: 'default', summary: 'Automated report schedule updated', metadata: { enabled, dayOfMonth, recipients } });
  revalidatePath('/dashboard/reports');
}
