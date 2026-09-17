import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWiseWebhookSignature } from '@/lib/wise-webhook';
import { syncWisePaymentRunById } from '@/lib/wise-sync';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // Signature must be checked against the exact raw body - read text(),
  // never req.json() first, or re-serialization will break verification.
  const rawBody = await req.text();
  const signature = req.headers.get('x-signature-sha256');

  if (!verifyWiseWebhookSignature(rawBody, signature)) {
    console.error('Wise webhook: signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Wise sends a test delivery (X-Test-Notification: true) when a
  // subscription is first created, just to confirm the URL is reachable.
  if (req.headers.get('x-test-notification') === 'true') {
    return NextResponse.json({ status: 'ok' });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (event?.event_type !== 'transfers#state-change') {
    // We only subscribe to this event type, but ignore anything unexpected
    // gracefully rather than erroring.
    return NextResponse.json({ status: 'ignored' });
  }

  const transferId = String(event?.data?.resource?.id ?? '');
  if (!transferId) return NextResponse.json({ status: 'ignored' });

  try {
    const expense = await prisma.expense.findFirst({
      where: { wiseTransferId: transferId },
      select: { paymentRunId: true },
    });
    if (expense?.paymentRunId) {
      await syncWisePaymentRunById(expense.paymentRunId);
    }
  } catch (error) {
    // Don't fail the delivery over a transient sync error - the daily cron
    // and the manual "Sync" button on the Payments page remain as
    // fallbacks, so there's no need to make Wise retry this delivery.
    console.error('Wise webhook: sync failed for transfer', transferId, error);
  }

  return NextResponse.json({ status: 'ok' });
}
