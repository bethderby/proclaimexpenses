# Production database migrations on Vercel

Vercel builds run `prisma migrate deploy` automatically as part of every deployment (`vercel-build`: `prisma generate && prisma migrate deploy && next build`).

This means new Prisma migrations are applied to the production database at deploy time — no manual step required before pushing.

## Known risk: advisory-lock timeouts

`prisma migrate deploy` takes a PostgreSQL advisory lock while it checks/applies migrations. If two builds run concurrently against the same production database (e.g. a second push goes out while the first build is still running, or a preview build points at the same DB), the second one can hang waiting for the lock and fail the build.

Mitigations if this starts happening again:
- Avoid pushing multiple commits in quick succession while a build is in flight — let one deploy finish before starting the next.
- Don't point preview/branch deployments at the production DATABASE_URL.
- If lock timeouts recur, consider re-splitting migrate deploy out of the build (see git history around commit 21a854c for the previous manual-step approach) and applying migrations via a separate CI step or manual command instead.

## Manual migration command (fallback)

If you ever need to apply migrations by hand instead of relying on the build step:

```bash
npx prisma migrate deploy
```

Make sure DATABASE_URL is set to Production before running this (e.g. `vercel env pull .env.production.local --environment=production`), since `vercel env pull` defaults to Development if you don't pass `--environment=production`.
