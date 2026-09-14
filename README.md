# Proclaim Expenses

A Next.js + Prisma expense management app for Proclaim Jesus.

## Unified expense workflow

There is one workflow: **Expenses**.

A requester answers two simple questions:

1. **Have you already bought this?**
   - Yes — receipt required now.
   - No — choose whether an advance is needed.
2. **Do you need the money before you can buy it?**
   - Yes — an advance is paid after approval.
   - No — the requester buys it personally and is reimbursed after the receipt is uploaded.

For advances, the requester later enters the actual receipt amount. The app calculates whether money is due back to the charity or whether an additional reimbursement is required.

## Wise payment workflow

The app uses the Wise Business API to prepare GBP payout batches. Wise's current API supports creating authenticated quotes, recipients, transfers and batch groups for business accounts. Wise documents the workflow as quote → recipient → transfer → funding, and batch groups can contain up to 1,000 transfers. See the official Wise documentation for current capabilities. 

**Important UK API limitation:** Wise currently says personal API tokens can create recipients, quotes, transfers/batches and track status, but funding API access is not available in most countries. The UK is not among the countries listed as having personal-token funding support. Therefore this version prepares and completes the Wise batch through the API, then the authorised user funds the completed batch from the charity's Wise GBP balance in Wise Business. The app then syncs Wise transfer statuses. 

This keeps the main Co-op balance separate from the payment float in Wise.

## Setup

1. Install dependencies with `npm install`.
2. Set the existing application environment variables in `.env.local`.
3. Set:

```env
WISE_API_TOKEN=your_wise_business_api_token
WISE_PROFILE_ID=your_wise_business_profile_id
WISE_API_BASE_URL=https://api.wise.com
WISE_API_VERSION=2026Q3
# Leave false for UK personal-token accounts unless Wise has enabled balance funding for your account.
WISE_ALLOW_API_FUNDING=false
```

4. Set `BANK_DETAILS_ENCRYPTION_KEY` before users save bank details. Generate a 32-byte key as 64 hex characters:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

5. Run:

```bash
npx prisma migrate deploy
npx prisma generate
npm run build
```

## Migration

The new migration removes the example-only `FundingRequest` table/model and converts the application to the unified Expense workflow. Back up the production database before deploying.

## Bank details

Users save a UK account name, six-digit sort code and eight-digit account number. These are encrypted at rest with AES-256-GCM and only decrypted server-side when a payment is prepared.

## Wise API security

Keep the Wise API token server-side only. Never expose it in client components or `NEXT_PUBLIC_*` environment variables. Rotate the token if it is ever exposed.

## Receipt reminders

Vercel Cron calls `/api/cron/receipt-reminders` daily. Configure `CRON_SECRET` and Resend if email reminders are required.
