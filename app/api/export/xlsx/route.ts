import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import * as XLSX from 'xlsx';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const [requests, expenses] = await Promise.all([
    prisma.fundingRequest.findMany({
      include: { team: true, user: true },
      orderBy: { date: 'desc' },
    }),
    prisma.expense.findMany({
      include: { team: true, user: true, request: true },
      orderBy: { date: 'desc' },
    }),
  ]);

  const requestRows = requests.map((r) => ({
    Date: r.date.toISOString().slice(0, 10),
    Team: r.team.name,
    Employee: r.user.name ?? '',
    Email: r.user.email ?? '',
    Description: r.description,
    'Amount requested': r.amount,
    Status: r.status,
    'Decision note': r.decisionNote ?? '',
  }));

  const expenseRows = expenses.map((e) => ({
    Date: e.date.toISOString().slice(0, 10),
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
      'Content-Disposition': 'attachment; filename="Proclaim-expenses-export.xlsx"',
    },
  });
}
