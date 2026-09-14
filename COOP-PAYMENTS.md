# Co-op → Wise payment architecture

The application no longer needs to log into Co-op or initiate employee payments directly from the main Co-op account.

## Recommended flow

```text
Co-op charity account
        │
        │ authorised transfer / payment float
        ▼
Wise Business GBP balance
        │
        │ Wise API prepares batch
        ▼
Proclaim Expenses → Wise batch
        │
        │ authorised user funds completed batch in Wise
        ▼
UK employee bank accounts
```

The Co-op account remains the main treasury account. Wise is used as the controlled operational payment account.

## Why this is safer

The application never needs access to the charity's main Co-op online-banking credentials. You can keep only a limited operational balance in Wise and replenish it from Co-op when required.

## Current Wise API limitation

Wise's current SMB payout documentation says a personal API token can prepare transfers and batches and track their status, but funding transfers via API is not supported for most countries. The UK is not listed among the countries with personal-token funding support.

Therefore the app:

1. creates recipients;
2. creates GBP quotes;
3. creates Wise batch transfers;
4. completes the batch;
5. stores the Wise batch/transfer IDs;
6. asks the authorised user to fund the completed batch in Wise Business;
7. lets the user sync the resulting Wise statuses.

If Wise enables balance-funding API access for this account later, set `WISE_ALLOW_API_FUNDING=true` only after confirming that capability with Wise.

The Wise API token must remain server-side.
