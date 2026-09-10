# Receipts and approval routing changes

## What changed

- Receipt uploads now use Vercel Blob `access: 'private'`.
- JPG, PNG, WebP, HEIC/HEIF and PDF receipts are accepted, up to 10 MB.
- Uploads return a short-lived preview URL; the database stores the private Blob URL.
- `/api/receipts/[expenseId]` checks the signed-in user before streaming a receipt.
- Receipt access is allowed for the expense owner, an admin, or the configured approver for that expense's team.
- Legacy public receipts are still served through the authenticated route for compatibility.
- Request routing is based only on the selected team's `approverEmail`.
- Team membership is not required for submitting requests or approving them.
- The same person can be the approver for multiple teams.
- When Resend is configured, submitting a request sends a notification to that team's approver.
- Admin Portal now creates/edits the approver email directly on each team.
- Linking an approved request to an expense is now server-validated against the current user and team.

## Vercel Blob requirement

The Blob store used for new receipts must be a **Private** Blob store. Vercel Private Blob is now generally available. If the existing store was created as a public store, create/connect a private store for receipts rather than changing the application back to public access.

The project uses the Vercel Blob SDK already present in `package-lock.json`. New Vercel deployments can use OIDC authentication automatically when the private store is connected to the project.

## Environment

Do not commit `.env` files. Configure the deployment environment with the values from your own private environment. For request notifications, set:

- `RESEND_API_KEY`
- `RESEND_FROM` (a verified Resend sender)

Database/auth variables remain as documented in `.env.example`.

## Verification

`npx tsc --noEmit` passes on the patched source. A full `next build` could not be completed in the patching environment because the environment could not reach `registry.npmjs.org` to download Next.js's native SWC binary; this is an environment/network limitation, not a TypeScript error in the patched source.
