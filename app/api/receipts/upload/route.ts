import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { issueSignedToken, presignUrl, put } from '@vercel/blob';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

function safeExtension(name: string, contentType: string) {
  const raw = name.includes('.') ? name.split('.').pop()?.toLowerCase() : '';
  if (raw && /^[a-z0-9]{1,8}$/.test(raw)) return `.${raw}`;
  if (contentType === 'application/pdf') return '.pdf';
  if (contentType === 'image/png') return '.png';
  if (contentType === 'image/webp') return '.webp';
  return '.jpg';
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Upload a JPG, PNG, WebP, HEIC, HEIF, or PDF receipt.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Receipt is too large (max 4MB).' }, { status: 400 });
    }

    const pathname = `receipts/${Date.now()}-${crypto.randomUUID()}${safeExtension(file.name, file.type)}`;
    const blob = await put(pathname, file, {
      access: 'private',
      contentType: file.type,
    });

    // Give the upload form a short-lived browser URL for its preview. The stored
    // database value remains the private Blob URL, not this temporary URL.
    const signedToken = await issueSignedToken({
      pathname: blob.pathname,
      operations: ['get'],
      validUntil: Date.now() + 10 * 60 * 1000,
    });
    const { presignedUrl } = await presignUrl(signedToken, {
      pathname: blob.pathname,
      operation: 'get',
      access: 'private',
      validUntil: Date.now() + 10 * 60 * 1000,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      previewUrl: presignedUrl,
      contentType: file.type,
      filename: file.name,
    }, { status: 201 });
  } catch (error) {
    console.error('Receipt upload failed', error);
    return NextResponse.json({ error: 'Receipt upload failed. Please try again.' }, { status: 500 });
  }
}
