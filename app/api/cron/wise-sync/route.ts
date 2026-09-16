import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isWiseConfigured } from '@/lib/wise';
import { syncWisePaymentRunById } from '@/lib/wise-sync';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isWiseConfigured()) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Wise is not configured.' });
  }

  const runs = await prisma.paymentRun.findMany({
    where: {
      wiseBatchGroupId: { not: null },
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
    },
    select: { id: true, reference: true },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  const results: { reference: string; ok: boolean; error?: string }[] = [];
  for (const run of runs) {
    try {
      await syncWisePaymentRunById(run.id);
      results.push({ reference: run.reference, ok: true });
    } catch (error: any) {
      console.error('Automatic Wise sync failed', run.reference, error);
      results.push({ reference: run.reference, ok: false, error: error?.message || 'Sync failed.' });
    }
  }

  return NextResponse.json({ ok: true, checked: runs.length, results });
}
