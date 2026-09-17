# Instant Wise payment status updates (webhooks)

Instead of waiting for the daily `/api/cron/wise-sync` job, Wise can now push a
notification the moment a transfer's status actually changes (typically within
seconds). This is handled by:

- `app/api/webhooks/wise/route.ts` - receives the event, verifies it's really
  from Wise, and syncs just that one payment run.
- `lib/wise-webhook.ts` - verifies the `X-Signature-SHA256` header against
  Wise's published public key.

The daily cron job and the manual "Sync" button on the Payments page are left
in place as a fallback in case a webhook delivery is ever missed.

## One-time setup: register the subscription with Wise

This only needs to be run once (or again if you ever change your production
domain). It uses your existing `WISE_API_TOKEN` and `WISE_PROFILE_ID`.

```bash
curl -i -X POST \
  "https://api.wise.com/v3/profiles/${WISE_PROFILE_ID}/subscriptions" \
  -H "Authorization: Bearer ${WISE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Proclaim Expenses - payment status",
    "trigger_on": "transfers#state-change",
    "delivery": {
      "version": "4.0.0",
      "url": "https://YOUR-PRODUCTION-DOMAIN/api/webhooks/wise"
    }
  }'
```

Replace `YOUR-PRODUCTION-DOMAIN` with your real production domain. Deploy the
code in this change **before** running this command - creating the
subscription immediately sends a test notification to confirm the URL is
reachable, and it needs `app/api/webhooks/wise/route.ts` to already be live to
succeed.

A successful response looks like:

```json
{
  "id": "72195556-e5cb-495e-a010-b37a4f2a3043",
  "name": "Proclaim Expenses - payment status",
  "trigger_on": "transfers#state-change",
  "delivery": { "version": "4.0.0", "url": "https://YOUR-PRODUCTION-DOMAIN/api/webhooks/wise" },
  ...
}
```

## Verifying it worked

Run a payment batch through Wise as normal. Once Wise marks the transfer as
sent, the expense should flip to Paid (and the "expense paid" email should
land) within a few seconds, without needing to click Sync or wait for the
daily cron.

## If you ever need to remove or replace the subscription

```bash
curl -i -X DELETE \
  "https://api.wise.com/v3/profiles/${WISE_PROFILE_ID}/subscriptions/<subscription-id>" \
  -H "Authorization: Bearer ${WISE_API_TOKEN}"
```

## Note on the public key

`lib/wise-webhook.ts` has Wise's production public key baked in as a default,
matching the key Wise publishes in their docs. If Wise ever rotates it, set
`WISE_WEBHOOK_PUBLIC_KEY` in your environment to override it without a code
change.
