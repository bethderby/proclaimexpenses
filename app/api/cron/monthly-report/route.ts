import { NextRequest, NextResponse } from 'next/server';
import { sendCombinedReport } from '@/lib/report';
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  try { const result = await sendCombinedReport(start, end); return NextResponse.json({ ok: true, ...result }); }
  catch (e: any) { return NextResponse.json({ error: e?.message || 'Could not send report.' }, { status: 500 }); }
}
