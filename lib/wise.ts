import crypto from 'crypto';

const API_BASE = (process.env.WISE_API_BASE_URL || 'https://api.wise.com').replace(/\/$/, '');
const API_VERSION = process.env.WISE_API_VERSION || '2026Q3';

function requireWiseConfig() {
  const token = process.env.WISE_API_TOKEN;
  const profileId = process.env.WISE_PROFILE_ID;
  if (!token || !profileId) throw new Error('Wise is not configured. Add WISE_API_TOKEN and WISE_PROFILE_ID to the environment.');
  return { token, profileId };
}

function extractWiseErrorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  if (typeof record.message === 'string') return record.message;
  const errors = record.errors;
  if (Array.isArray(errors) && errors.length > 0 && errors[0] && typeof errors[0] === 'object') {
    const firstError = errors[0] as Record<string, unknown>;
    if (typeof firstError.message === 'string') return firstError.message;
  }
  return undefined;
}

// Wise's various endpoints (batch groups, transfers, quotes, recipients) each
// return a differently-shaped payload, and we don't maintain a full schema
// for Wise's API here - callers narrow the fields they need at the point of
// use. `any` is deliberate and contained to this one return, rather than
// scattered across every call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function wiseFetch(path: string, init: RequestInit = {}): Promise<any> {
  const { token } = requireWiseConfig();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  headers.set('X-External-Correlation-Id', crypto.randomUUID());
  headers.set('Accept-Minor-Version', '1');
  const response = await fetch(`${API_BASE}/${API_VERSION}${path}`, { ...init, headers, cache: 'no-store' });
  const text = await response.text();
  let body: unknown = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok) {
    const message = extractWiseErrorMessage(body) || `Wise API error (${response.status}).`;
    throw new Error(message);
  }
  return body;
}

export function isWiseConfigured() {
  return Boolean(process.env.WISE_API_TOKEN && process.env.WISE_PROFILE_ID);
}

/**
 * UK GBP bank-transfer references are limited to 18 characters. Keep these
 * references deliberately conservative: alphanumeric only, which also avoids
 * corridor-specific punctuation problems.
 */
export function validateWiseReference(reference: string) {
  if (!reference || reference.length > 18) {
    throw new Error(`Wise payment reference must be 18 characters or fewer (got ${reference.length}).`);
  }
  if (!/^[A-Za-z0-9]+$/.test(reference)) {
    throw new Error('Wise payment reference must contain letters and numbers only.');
  }
  return reference;
}

export async function createWiseRecipient(input: { name: string; sortCode: string; accountNumber: string }) {
  const { profileId } = requireWiseConfig();
  return wiseFetch('/accounts?refund=false', {
    method: 'POST',
    body: JSON.stringify({
      currency: 'GBP',
      type: 'sort_code',
      profile: Number(profileId),
      ownedByCustomer: false,
      accountHolderName: input.name,
      details: { legalType: 'PRIVATE', sortCode: input.sortCode, accountNumber: input.accountNumber },
    }),
  });
}

export async function createWiseQuote(targetAccount: number, amount: number) {
  const { profileId } = requireWiseConfig();
  return wiseFetch(`/profiles/${profileId}/quotes`, {
    method: 'POST',
    body: JSON.stringify({
      sourceCurrency: 'GBP', targetCurrency: 'GBP', sourceAmount: amount, targetAmount: null,
      targetAccount,
      payOut: 'BANK_TRANSFER', preferredPayIn: 'BALANCE',
      paymentMetadata: { transferNature: 'PAYING_BILLS' },
    }),
  });
}

export type WiseTransferDetails = {
  reference: string;
  transferPurpose?: string;
  sourceOfFunds?: string;
};

export function getWiseTransferDetails(reference: string): WiseTransferDetails {
  validateWiseReference(reference);
  return {
    reference,
    // These can be overridden with the exact Wise enum required by your profile.
    transferPurpose: process.env.WISE_TRANSFER_PURPOSE || 'verification.transfers.purpose.pay.bills',
    sourceOfFunds: process.env.WISE_SOURCE_OF_FUNDS || 'verification.source.of.funds.other',
  };
}

export async function getWiseTransferRequirements(input: { targetAccount: number; quoteUuid: string; details: WiseTransferDetails }) {
  const details = getWiseTransferDetails(input.details.reference);
  return wiseFetch('/transfer-requirements', {
    method: 'POST',
    body: JSON.stringify({
      targetAccount: input.targetAccount,
      quoteUuid: input.quoteUuid,
      details,
    }),
  });
}

export async function createWiseTransfer(input: { targetAccount: number; quoteUuid: string; details: WiseTransferDetails; customerTransactionId?: string }) {
  const details = getWiseTransferDetails(input.details.reference);
  return wiseFetch('/transfers', {
    method: 'POST',
    body: JSON.stringify({
      targetAccount: input.targetAccount,
      quoteUuid: input.quoteUuid,
      customerTransactionId: input.customerTransactionId || crypto.randomUUID(),
      details,
    }),
  });
}

export async function createWiseBatchGroup(name: string) {
  const { profileId } = requireWiseConfig();
  return wiseFetch(`/profiles/${profileId}/batch-groups`, {
    method: 'POST',
    body: JSON.stringify({ sourceCurrency: 'GBP', name }),
  });
}

export async function addWiseBatchTransfer(batchGroupId: string, input: { targetAccount: number; quoteUuid: string; details: WiseTransferDetails; customerTransactionId?: string }) {
  const { profileId } = requireWiseConfig();
  const details = getWiseTransferDetails(input.details.reference);
  return wiseFetch(`/profiles/${profileId}/batch-groups/${batchGroupId}/transfers`, {
    method: 'POST',
    body: JSON.stringify({
      targetAccount: input.targetAccount,
      quoteUuid: input.quoteUuid,
      customerTransactionId: input.customerTransactionId || crypto.randomUUID(),
      details,
    }),
  });
}

export async function completeWiseBatchGroup(batchGroupId: string, version: number) {
  const { profileId } = requireWiseConfig();
  return wiseFetch(`/profiles/${profileId}/batch-groups/${batchGroupId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'COMPLETED', version }),
  });
}

export async function cancelWiseBatchGroup(batchGroupId: string, version: number) {
  const { profileId } = requireWiseConfig();
  return wiseFetch(`/profiles/${profileId}/batch-groups/${batchGroupId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'CANCELLED', version }),
  });
}

export async function getWiseBatchGroup(batchGroupId: string) {
  const { profileId } = requireWiseConfig();
  return wiseFetch(`/profiles/${profileId}/batch-groups/${batchGroupId}`, { method: 'GET' });
}

export async function getWiseTransfer(transferId: string | number) {
  return wiseFetch(`/transfers/${transferId}`, { method: 'GET' });
}

export async function cancelWiseTransfer(transferId: string | number) {
  return wiseFetch(`/transfers/${transferId}/cancel`, { method: 'PUT' });
}
