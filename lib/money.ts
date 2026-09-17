/**
 * Parse a form value as pounds with at most two decimal places.
 * We deliberately round at the input boundary so every persisted monetary
 * value represents an exact number of pennies before it is stored in PostgreSQL
 * fixed-point DECIMAL columns.
 */
export function parseMoney(value: unknown, options: { min?: number; allowZero?: boolean } = {}): number {
  const raw = String(value ?? '').trim();
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(raw)) {
    throw new Error('Enter a valid amount using pounds and pence, for example 12.50.');
  }

  const amount = Math.round(Number(raw) * 100) / 100;
  const min = options.min ?? 0.01;
  const allowZero = options.allowZero ?? false;
  if (!Number.isFinite(amount) || (allowZero ? amount < 0 : amount < min)) {
    throw new Error(`Amount must be ${allowZero ? 'at least' : 'greater than'} £${min.toFixed(2)}.`);
  }
  return amount;
}

export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) throw new Error('Invalid monetary amount.');
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
