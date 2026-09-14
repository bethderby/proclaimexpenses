import crypto from 'crypto';

const API_BASE = (process.env.WISE_API_BASE_URL || 'https://api.wise.com').replace(/\/$/, '');
const API_VERSION = process.env.WISE_API_VERSION || '2026Q3';

function requireWiseConfig() {
  const token = process.env.WISE_API_TOKEN;
  const profileId = process.env.WISE_PROFILE_ID;
  if (!token || !profileId) throw new Error('Wise is not configured. Add WISE_API_TOKEN and WISE_PROFILE_ID to the environment.');
  return { token, profileId };
}

async function wiseFetch(path: string, init: RequestInit = {}) {
  const { token } = requireWiseConfig();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  headers.set('X-External-Correlation-Id', crypto.randomUUID());
  const response = await fetch(`${API_BASE}/${API_VERSION}${path}`, { ...init, headers, cache: 'no-store' });
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok) {
    const message = body?.message || body?.errors?.[0]?.message || `Wise API error (${response.status}).`;
    throw new Error(message);
  }
  return body;
}

export function isWiseConfigured() {
  return Boolean(process.env.WISE_API_TOKEN && process.env.WISE_PROFILE_ID);
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

export async function createWiseTransfer(input: { targetAccount: number; quoteUuid: string; reference: string }) {
  return wiseFetch('/transfers', {
    method: 'POST',
    body: JSON.stringify({
      targetAccount: input.targetAccount,
      quoteUuid: input.quoteUuid,
      customerTransactionId: crypto.randomUUID(),
      details: { reference: input.reference },
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

export async function addWiseBatchTransfer(batchGroupId: string, input: { targetAccount: number; quoteUuid: string; reference: string }) {
  const { profileId } = requireWiseConfig();
  return wiseFetch(`/profiles/${profileId}/batch-groups/${batchGroupId}/transfers`, {
    method: 'POST',
    body: JSON.stringify({
      targetAccount: input.targetAccount,
      quoteUuid: input.quoteUuid,
      customerTransactionId: crypto.randomUUID(),
      details: { reference: input.reference },
    }),
  });
}

export async function completeWiseBatchGroup(batchGroupId: string, version?: number) {
  const { profileId } = requireWiseConfig();
  return wiseFetch(`/profiles/${profileId}/batch-groups/${batchGroupId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'COMPLETED', ...(version ? { version } : {}) }),
  });
}

export async function getWiseBatchGroup(batchGroupId: string) {
  const { profileId } = requireWiseConfig();
  return wiseFetch(`/profiles/${profileId}/batch-groups/${batchGroupId}`, { method: 'GET' });
}

export async function getWiseTransfer(transferId: number) {
  return wiseFetch(`/transfers/${transferId}`, { method: 'GET' });
}

/**
 * Wise documents API funding from balance, but notes that funding via personal API tokens
 * is not available in most countries, including the UK. Keep this behind an explicit flag
 * so the app never silently attempts a payment your account is not allowed to fund.
 */
export async function fundWiseBatchFromBalance(batchGroupId: string) {
  if (process.env.WISE_ALLOW_API_FUNDING !== 'true') {
    throw new Error('Wise batch has been prepared, but API funding is disabled. Open Wise Business and fund the completed batch from your GBP balance.');
  }
  const { profileId } = requireWiseConfig();
  return wiseFetch(`/profiles/${profileId}/batch-payments/${batchGroupId}/payments`, {
    method: 'POST',
    body: JSON.stringify({ type: 'BALANCE' }),
  });
}
