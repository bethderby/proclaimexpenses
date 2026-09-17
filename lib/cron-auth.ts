import crypto from 'crypto';
import { NextRequest } from 'next/server';

export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const provided = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;

  // A plain `===` compares byte-by-byte and returns as soon as it finds a
  // mismatch, so how quickly the comparison fails leaks information about
  // how many leading characters were correct. crypto.timingSafeEqual always
  // takes the same time regardless of where the strings diverge. It throws
  // if the two buffers aren't the same length, so that case is handled
  // separately rather than passed through to timingSafeEqual.
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}
