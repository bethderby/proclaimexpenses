# Proclaim Expenses — open Wise batch patch

These files change the Wise payment flow so that an approved payable expense is added immediately to one shared open Wise batch. The batch remains NEW in Wise until an authorised user explicitly closes it from the Payments page.

Files changed:
- app/actions.ts
- lib/wise-sync.ts
- app/dashboard/payments/PaymentRunActions.tsx
- app/dashboard/payments/page.tsx
- components/PaymentRunFilter.tsx
- prisma/schema.prisma
- prisma/migrations/20260917000000_open_wise_batch/migration.sql
- prisma/migrations/20260917010000_one_open_wise_batch/migration.sql

Deployment:
1. Back up the production database.
2. Replace the corresponding files in the project.
3. Run `npx prisma migrate deploy`.
4. Run `npx prisma generate`.
5. Run the project's normal build/deploy command.

The local environment used for this patch could not run Prisma generate because the Prisma engine download was unavailable from the environment. The changed TypeScript/TSX files were syntax-parsed successfully, but the generated Prisma client should be regenerated during deployment.
