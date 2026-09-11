import { prisma } from '@/lib/prisma';
import { buildStatementPdf } from '@/lib/pdf';

export async function sendCombinedReport(start: Date, end: Date, opts: { manual?: boolean } = {}) {
  const expenses = await prisma.expense.findMany({
    where: { date: { gte: start, lt: end } },
    include: { user: true, team: true },
    orderBy: { date: 'asc' },
  });
  const items = expenses.map((e) => ({ date: e.date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }), teamName: e.team.name, userName: e.user.name ?? e.user.email ?? '', description: e.description, amount: e.amount }));
  const label = `${start.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} – ${new Date(end.getTime()-1).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}`;
  const pdf = await buildStatementPdf('All teams', label, items);
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured.');
  const recipients = (process.env.REPORT_RECIPIENTS || process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean);
  if (!recipients.length) throw new Error('Set REPORT_RECIPIENTS or ADMIN_EMAILS to the email address that should receive reports.');
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM;
  if (!from) throw new Error('Set RESEND_FROM to a verified Resend sender, e.g. Expenses <expenses@yourdomain.com>.');
  const result = await resend.emails.send({
    from,
    to: recipients,
    subject: `Proclaim expense report — ${label}`,
    text: `Attached is the Proclaim expense report for ${label}, including all teams.`,
    attachments: [{ filename: `proclaim-expenses-${start.toISOString().slice(0,10)}-to-${new Date(end.getTime()-1).toISOString().slice(0,10)}.pdf`, content: pdf.toString('base64') }],
  });
  if (result.error) throw new Error(result.error.message || 'Resend could not send the email.');
  return { recipients, count: expenses.length, manual: !!opts.manual };
}
