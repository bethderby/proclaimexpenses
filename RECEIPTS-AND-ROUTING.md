# Receipts, approvals and routing

## Current workflow

The app now routes **expenses**, not separate funding requests.

- A user chooses a team on the expense form.
- The team determines the approver(s).
- Already-purchased expenses require a receipt before submission.
- Expenses that have not yet been purchased can be submitted without a receipt.
- `NEEDS_ADVANCE` means the approved expense can be placed into a payment run before purchase.
- `WILL_PURCHASE_LATER` means approval does not create a payment; the requester must later mark the expense purchased and upload the receipt.
- Approval and rejection notifications are sent with Resend when configured.

## Receipt reminders

For future purchases, `receiptDueAt` is set to seven days after submission. The daily Vercel Cron endpoint `/api/cron/receipt-reminders` sends a reminder when a receipt is still missing and moves the next reminder out by another seven days.

Advance payments are also reminded after the payment run is marked paid, because the receipt is still required after purchase.

## Private receipt storage

Receipt uploads use private Vercel Blob storage. `/api/receipts/[expenseId]` checks the signed-in user, expense owner, team approver or admin before streaming a receipt.

## Payment details

Bank account name, sort code and account number are encrypted with AES-256-GCM using `BANK_DETAILS_ENCRYPTION_KEY` before being stored. The key must be kept in the deployment secret store and must not be committed.

## Payment runs

The app does not automate Co-op login or collect banking credentials. It creates a payment run from `READY_TO_PAY` expenses, exports payment instructions, and lets an authorised user perform the payment in the charity's Co-op banking service. The user then marks the run paid in Proclaim Expenses.

## Environment

Do not commit `.env` files. Configure the deployment environment with the values from your own private environment. For email notifications/reminders, set `RESEND_API_KEY` and `RESEND_FROM`. Set `CRON_SECRET` for the Vercel cron endpoints and `BANK_DETAILS_ENCRYPTION_KEY` for encrypted bank details.
