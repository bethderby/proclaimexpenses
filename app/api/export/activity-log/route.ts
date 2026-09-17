import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatReportDate, formatUKDateTime } from '@/lib/date';

const text = (value: unknown) => value === null || value === undefined || value === '' ? '' : String(value);

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const user = session.user;
  if (!user.isAdmin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const startValue = sp.get('start');
  const endValue = sp.get('end');
  if (!startValue || !endValue) return NextResponse.json({ error: 'start and end are required.' }, { status: 400 });

  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return NextResponse.json({ error: 'Invalid date range.' }, { status: 400 });
  }

  const expenses = await prisma.expense.findMany({
    where: { date: { gte: start, lt: new Date(end.getTime() + 1) } },
    include: { team: true, user: true },
    orderBy: [{ date: 'desc' }, { submittedAt: 'desc' }],
  });

  const lines: string[] = [
    'PROCLAIM EXPENSES ACTIVITY LOG',
    '================================',
    `Date range: ${formatReportDate(start)} to ${formatReportDate(end)}`,
    'Teams: ALL',
    `Expenses: ${expenses.length}`,
    `Generated: ${formatUKDateTime(new Date())}`,
    '',
  ];

  expenses.forEach((e, index) => {
    lines.push(
      `ENTRY ${index + 1}`,
      '--------------------------------',
      `Expense ID: ${e.id}`,
      `Date: ${formatReportDate(e.date)}`,
      `Description: ${text(e.description)}`,
      `Amount: £${e.amount.toFixed(2)}`,
      `Employee: ${text(e.user.name)}`,
      `Email: ${text(e.user.email)}`,
      `User ID: ${e.userId}`,
      `Team: ${text(e.team.name)}`,
      `Team ID: ${e.teamId}`,
      `Status: ${text(e.status)}`,
      `Purchase status: ${text(e.purchaseStatus)}`,
      `Payment timing: ${text(e.paymentTiming)}`,
      `Approved amount: ${e.approvedAmount == null ? '' : `£${e.approvedAmount.toFixed(2)}`}`,
      `Actual amount: ${e.actualAmount == null ? '' : `£${e.actualAmount.toFixed(2)}`}`,
      `Advance amount: ${e.advanceAmount == null ? '' : `£${e.advanceAmount.toFixed(2)}`}`,
      `Payment status: ${text(e.paymentStatus)}`,
      `Payment reference: ${text(e.paymentReference)}`,
      `Payment run ID: ${text(e.paymentRunId)}`,
      `Wise recipient ID: ${text(e.wiseRecipientId)}`,
      `Wise transfer ID: ${text(e.wiseTransferId)}`,
      `Wise batch group ID: ${text(e.wiseBatchGroupId)}`,
      `Wise status: ${text(e.wiseStatus)}`,
      `Settlement status: ${text(e.settlementStatus)}`,
      `Settlement note: ${text(e.settlementNote)}`,
      `Decision note: ${text(e.decisionNote)}`,
      `Receipt uploaded: ${e.receiptUrl ? 'Yes' : 'No'}`,
      `Receipt due: ${e.receiptDueAt ? formatUKDateTime(e.receiptDueAt) : ''}`,
      `Reminder count: ${e.reminderCount}`,
      `Last reminder: ${e.lastReminderAt ? formatUKDateTime(e.lastReminderAt) : ''}`,
      `Submitted: ${formatUKDateTime(e.submittedAt)}`,
      `Purchased: ${e.purchasedAt ? formatUKDateTime(e.purchasedAt) : ''}`,
      `Decided: ${e.decidedAt ? formatUKDateTime(e.decidedAt) : ''}`,
      `Paid: ${e.paidAt ? formatUKDateTime(e.paidAt) : ''}`,
      `Related expense ID: ${text(e.relatedExpenseId)}`,
      '',
    );
  });

  const body = lines.join('\r\n');
  const filename = `Activity Log - ${formatReportDate(start)} to ${formatReportDate(end)}.txt`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
