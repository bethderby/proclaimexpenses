import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isWiseConfigured } from '@/lib/wise';
import { syncWisePaymentRunById } from '@/lib/wise-sync';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
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
    } catch (error: unknown) {
      console.error('Automatic Wise sync failed', run.reference, error);
      results.push({ reference: run.reference, ok: false, error: error instanceof Error ? error.message : 'Sync failed.' });
    }
  }

  return NextResponse.json({ ok: true, checked: runs.length, results });
}
