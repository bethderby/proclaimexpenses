import test from 'node:test';
import assert from 'node:assert/strict';
import type { NextRequest } from 'next/server';
import { isAuthorizedCronRequest } from '../lib/cron-auth';

function fakeRequest(authorizationHeader: string | null): NextRequest {
  return {
    headers: { get: (name: string) => (name === 'authorization' ? authorizationHeader : null) },
  } as unknown as NextRequest;
}

test('isAuthorizedCronRequest accepts the exact configured secret', () => {
  process.env.CRON_SECRET = 'super-secret-value';
  assert.equal(isAuthorizedCronRequest(fakeRequest('Bearer super-secret-value')), true);
  delete process.env.CRON_SECRET;
});

test('isAuthorizedCronRequest rejects a missing, wrong, or partially-matching header', () => {
  process.env.CRON_SECRET = 'super-secret-value';
  assert.equal(isAuthorizedCronRequest(fakeRequest(null)), false);
  assert.equal(isAuthorizedCronRequest(fakeRequest('Bearer wrong-value')), false);
  // Same length as the real header but differs only in the last character -
  // this is exactly the case a naive `===` and a timing-safe comparison must
  // both still reject; it's here to guard against a future regression.
  assert.equal(isAuthorizedCronRequest(fakeRequest('Bearer super-secret-valuX')), false);
  // Different length entirely.
  assert.equal(isAuthorizedCronRequest(fakeRequest('Bearer short')), false);
  delete process.env.CRON_SECRET;
});

test('isAuthorizedCronRequest rejects everything when no secret is configured', () => {
  delete process.env.CRON_SECRET;
  assert.equal(isAuthorizedCronRequest(fakeRequest('Bearer anything')), false);
});
