# Proclaim Expenses

A Next.js + Prisma expenses and budgeting app.

## What's changed

- Mobile-first dashboard layout with a responsive bottom navigation.
- Refreshed visual system: cards, spacing, typography, status badges and cleaner forms.
- Removed the category field from requests/expenses and exports.
- Rebuilt the expense log for mobile readability.
- Receipt uploads use Vercel Blob instead of the ephemeral Vercel filesystem, with private storage, short-lived preview URLs, image/PDF support, and authenticated receipt viewing.
- Reports can be generated for any date range and can include all teams in one PDF.
- The scheduled report is now one combined all-team PDF rather than one PDF per team.
- Added an admin "Send now" report action.
- Renamed "Teams (admin)" to "Admin Portal".
- Admin Portal can create/delete teams, configure one approver email per team, and grant/remove database admin access. The same approver can be assigned to multiple teams; requesters do not need team membership.

## Environment

Copy `.env.example` to your deployment environment. Do not commit real secrets.

For Resend you need:

- `RESEND_API_KEY`
- `RESEND_FROM` set to a verified sender/domain (or `onboarding@resend.dev` for testing)
- `REPORT_RECIPIENTS` or `ADMIN_EMAILS` containing the report recipient(s)

For receipts, connect a Vercel Blob store. Current Vercel Blob supports OIDC for new stores, so no long-lived Blob token is required for those stores; older stores may provide `BLOB_READ_WRITE_TOKEN`.

## Database migration

Run:

```bash
npx prisma migrate deploy
npx prisma generate
```

The new migration adds `TeamMember` roles, adds `User.isAdmin`, makes the legacy `Team.approverEmail` optional, and removes category columns.

## Email behaviour

The monthly cron runs on the first day of each month and sends one combined report for the previous month. You can also choose a custom range on Export and use **Send now** as an admin.

Adding a Resend API key by itself does not send an email; the app must call Resend, and the `from` address must be accepted by Resend.

## Request routing

Requests are routed solely by the selected team. Each team has an `approverEmail`; the requester does not need to be a member of that team. The same person may be the approver for multiple teams. When Resend is configured, submitting a request also sends a notification to that team approver.
