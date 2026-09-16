import crypto from 'crypto';

// Wise's published production public key for verifying the X-Signature-SHA256
// header on webhook deliveries. Source: https://docs.wise.com/guides/developer/webhooks/event-handling
// Override with WISE_WEBHOOK_PUBLIC_KEY if Wise rotates this key, or to point
// at the sandbox public key while testing against api.sandbox.transferwise.tech.
const DEFAULT_WISE_WEBHOOK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvO8vXV+JksBzZAY6GhSO
XdoTCfhXaaiZ+qAbtaDBiu2AGkGVpmEygFmWP4Li9m5+Ni85BhVvZOodM9epgW3F
bA5Q1SexvAF1PPjX4JpMstak/QhAgl1qMSqEevL8cmUeTgcMuVWCJmlge9h7B1CS
D4rtlimGZozG39rUBDg6Qt2K+P4wBfLblL0k4C4YUdLnpGYEDIth+i8XsRpFlogx
CAFyH9+knYsDbR43UJ9shtc42Ybd40Afihj8KnYKXzchyQ42aC8aZ/h5hyZ28yVy
Oj3Vos0VdBIs/gAyJ/4yyQFCXYte64I7ssrlbGRaco4nKF3HmaNhxwyKyJafz19e
HwIDAQAB
-----END PUBLIC KEY-----`;

/**
 * Verifies a Wise webhook delivery's X-Signature-SHA256 header against the
 * exact raw request body. The signature is an RSA-SHA256 signature of the
 * unparsed body bytes, Base64 encoded - it will not match if the body is
 * re-serialized after JSON.parse, so callers must pass the raw text.
 */
export function verifyWiseWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const publicKey = process.env.WISE_WEBHOOK_PUBLIC_KEY || DEFAULT_WISE_WEBHOOK_PUBLIC_KEY;
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(rawBody, 'utf8');
    verifier.end();
    return verifier.verify(publicKey, signatureHeader, 'base64');
  } catch (error) {
    console.error('Wise webhook signature verification error', error);
    return false;
  }
}
