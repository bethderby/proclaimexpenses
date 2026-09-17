import { prisma } from '@/lib/prisma';
import { buildStatementPdf } from '@/lib/pdf';
import { formatReportDate } from '@/lib/date';

async function getReportRecipients(configured?: string[]) {
  const configuredRecipients = (configured ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean);
  const admins = await prisma.user.findMany({
    where: { isAdmin: true, removedAt: null, email: { not: null } },
    select: { email: true },
  });
  const adminRecipients = admins.map((a) => a.email!).filter(Boolean);
  return [...new Set([...adminRecipients, ...configuredRecipients])];
}

export async function sendCombinedReport(start: Date, end: Date, opts: { manual?: boolean; recipients?: string[] } = {}) {
  const expenses = await prisma.expense.findMany({
    where: { date: { gte: start, lt: end }, status: { notIn: ['CANCELLED', 'REJECTED', 'PAYMENT_FAILED'] }, paymentStatus: { not: 'FAILED' } },
    include: { user: true, team: true },
    orderBy: { date: 'asc' },
  });
  const items = expenses.map((e) => ({ date: formatReportDate(e.date), teamName: e.team.name, userName: e.user.name ?? e.user.email ?? '', description: e.description, settlementNote: e.settlementNote, amount: Number(e.amount) }));
  const label = `${formatReportDate(start)} – ${formatReportDate(new Date(end.getTime() - 1))}`;
  const pdf = await buildStatementPdf('All teams', label, items);
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured.');
  const recipients = await getReportRecipients(opts.recipients);
  if (!recipients.length) throw new Error('No report recipients are configured and no active admin has an email address on file.');
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM;
  if (!from) throw new Error('Set RESEND_FROM to a verified Resend sender, e.g. Expenses <expenses@yourdomain.com>.');
  const result = await resend.emails.send({
    from,
    to: recipients,
    subject: `Proclaim Expense Report - ${label}`,
    text: `Attached is the Proclaim Expense Report for ${label}, including all teams.`,
    attachments: [{ filename: `All teams - Expense Report - ${formatReportDate(start)} to ${formatReportDate(new Date(end.getTime() - 1))}.pdf`, content: pdf.toString('base64') }],
  });
  if (result.error) throw new Error(result.error.message || 'Resend could not send the email.');
  return { recipients, count: expenses.length, manual: !!opts.manual };
}
