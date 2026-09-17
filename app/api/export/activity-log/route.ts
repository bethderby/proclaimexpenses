import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import * as XLSX from 'xlsx';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildActivityLogRows } from '@/lib/activity-log';
import { formatReportDate } from '@/lib/date';

async function getEvents(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }) };
  if (!session.user.isAdmin) return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) };

  const sp = new URL(req.url).searchParams;
  const startValue = sp.get('start');
  const endValue = sp.get('end');
  const format = (sp.get('format') || 'xlsx').toLowerCase();
  if (!startValue || !endValue) return { error: NextResponse.json({ error: 'start and end are required.' }, { status: 400 }) };
  if (format !== 'xlsx') return { error: NextResponse.json({ error: 'Unsupported export format.' }, { status: 400 }) };

  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return { error: NextResponse.json({ error: 'Invalid date range.' }, { status: 400 }) };
  }

  const events = await prisma.auditEvent.findMany({
    where: { createdAt: { gte: start, lte: end } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return { start, end, format, events };
}

export async function GET(req: NextRequest) {
  const result = await getEvents(req);
  if ('error' in result) return result.error;
  const { start, end, format, events } = result;
  const rows = buildActivityLogRows(events);
  const filenameBase = `Activity Log - ${formatReportDate(start)} to ${formatReportDate(end)}`;

  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 20 }, { wch: 30 }, { wch: 16 }, { wch: 28 }, { wch: 24 }, { wch: 32 },
      { wch: 60 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 80 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Activity log');
    const summary = XLSX.utils.aoa_to_sheet([
      ['Proclaim Expenses Full Activity Log'],
      ['From', formatReportDate(start)],
      ['To', formatReportDate(end)],
      ['Teams', 'ALL'],
      ['Events', events.length],
    ]);
    summary['!cols'] = [{ wch: 24 }, { wch: 36 }];
    XLSX.utils.book_append_sheet(wb, summary, 'Summary');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filenameBase}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  }

}
