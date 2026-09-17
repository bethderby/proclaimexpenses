# Production hardening changes

This pass tightens the application without forcing a risky production database rewrite.

## Changes made

- Removed the obsolete duplicate top-level `actions.ts`; `app/actions.ts` is the canonical server-action module.
- Added NextAuth session type augmentation for `id`, `isAdmin`, and `isApprover`, removing session-level `any` casts.
- Added centralised monetary input parsing with strict two-decimal validation and penny rounding.
- Added tests for monetary parsing/rounding (`npm test`).
- Changed cron authentication to **fail closed**: missing `CRON_SECRET` is now unauthorized, rather than disabling authentication.
- Replaced several broad `any` error catches with `unknown`.
- Replaced the `StatusPill` icon `any` with the library's `LucideIcon` type.

## Money storage note

The existing PostgreSQL schema still uses `DOUBLE PRECISION` for historical monetary columns. This release therefore normalises all newly entered monetary values to two decimal places at the application boundary instead of silently changing the production schema.

A future database migration can convert monetary columns to `DECIMAL(12,2)` after a backup and data audit. That should be deployed as a dedicated migration rather than mixed into an application-hardening release.

## Payment safety

The existing Wise workflow already uses a database lease, a database-level single-open-batch index, conditional expense reservation, deterministic Wise transaction IDs, and recovery reconciliation. Those mechanisms were retained rather than replaced with a less-tested payment implementation.

Before enabling real payments, run the test suite and verify the Wise sandbox/webhook configuration in a staging environment.
