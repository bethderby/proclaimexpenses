# Production database migrations on Vercel

Vercel builds no longer run `prisma migrate deploy` as part of every deployment. This avoids production builds being blocked by PostgreSQL advisory-lock timeouts.

Before deploying code that contains a new Prisma migration, run the migration against the production database once:

```bash
npx prisma migrate deploy
```

After the migration has been applied, deploy normally:

```bash
git add .
git commit -m "..."
git push
```

The application build itself only runs `prisma generate` and `next build`.
