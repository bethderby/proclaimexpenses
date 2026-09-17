import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { get } from '@vercel/blob';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { expenseId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user;

  const expense = await prisma.expense.findUnique({
    where: { id: params.expenseId },
    include: { team: true },
  });
  if (!expense) return new NextResponse('Receipt not found', { status: 404 });

  const email = (user.email ?? '').toLowerCase();
  const isOwner = expense.userId === user.id;
  const isAdmin = !!user.isAdmin;
  const isTeamApprover = !!email && expense.team.approverEmails.some((approver: string) => approver.toLowerCase() === email);
  if (!isOwner && !isAdmin && !isTeamApprover) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // New receipts are private. The public fallback is intentionally only for
  // legacy receipts uploaded before private Blob storage was enabled.
  if (!expense.receiptUrl) {
    return new NextResponse('No receipt has been uploaded for this expense yet', { status: 404 });
  }
  const receiptUrl = expense.receiptUrl;
  let blob = null;
  try {
    blob = await get(receiptUrl, { access: 'private' });
  } catch {
    // Legacy receipts were uploaded to the old public store. Keep them readable
    // through this authenticated route while new uploads are private.
  }
  if (!blob) {
    try {
      blob = await get(receiptUrl, { access: 'public' });
    } catch {
      blob = null;
    }
  }
  if (!blob) return new NextResponse('Receipt file not found', { status: 404 });

  return new NextResponse(blob.stream, {
    status: 200,
    headers: {
      'Content-Type': blob.blob.contentType || 'application/octet-stream',
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
