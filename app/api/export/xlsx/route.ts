import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import * as XLSX from 'xlsx';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const startValue = sp.get('start');
  const endValue = sp.get('end');
  const teamId = sp.get('team');
  let dateFilter: any = undefined;
  if (startValue && endValue) {
    const start = new Date(`${startValue}T00:00:00`);
    const end = new Date(`${endValue}T23:59:59.999`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return NextResponse.json({ error: 'Invalid date range.' }, { status: 400 });
    dateFilter = { gte: start, lt: new Date(end.getTime() + 1) };
  }
  const where = { ...(dateFilter ? { date: dateFilter } : {}), ...(teamId ? { teamId } : {}) };
  const [requests, expenses] = await Promise.all([
    prisma.fundingRequest.findMany({ where, include: { team: true, user: true }, orderBy: { date: 'desc' } }),
    prisma.expense.findMany({ where, include: { team: true, user: true, request: true }, orderBy: { date: 'desc' } }),
  ]);

  const requestRows = requests.map((r) => ({
    Date: r.date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
    Team: r.team.name,
    Employee: r.user.name ?? '',
    Email: r.user.email ?? '',
    Description: r.description,
    'Amount requested': r.amount,
    Status: r.status,
    'Decision note': r.decisionNote ?? '',
  }));

  const expenseRows = expenses.map((e) => ({
    Date: e.date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
    Team: e.team.name,
    Employee: e.user.name ?? '',
    Email: e.user.email ?? '',
    Description: e.description,
    Amount: e.amount,
    'Linked request': e.request?.description ?? '',
    'Has receipt': e.receiptUrl ? 'Yes' : 'No',
  }));

  const requestsWs = XLSX.utils.json_to_sheet(requestRows);
  requestsWs['!cols'] = [
    { wch: 11 }, { wch: 12 }, { wch: 16 }, { wch: 22 },
    { wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 24 },
  ];
  const expensesWs = XLSX.utils.json_to_sheet(expenseRows);
  expensesWs['!cols'] = [
    { wch: 11 }, { wch: 12 }, { wch: 16 }, { wch: 22 },
    { wch: 28 }, { wch: 10 }, { wch: 24 }, { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, requestsWs, 'Requests');
  XLSX.utils.book_append_sheet(wb, expensesWs, 'Expenses');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${startValue && endValue ? `Proclaim-expenses-${startValue}-to-${endValue}` : 'Proclaim-expenses-export'}.xlsx"`,
    },
  });
}
