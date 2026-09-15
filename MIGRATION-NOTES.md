# Migration notes

**Back up the production database before deploying.**

The migration `20260914010000_wise_and_remove_funding_request`:

- removes the example-only `FundingRequest` table and Prisma model;
- removes the old `purchaseMode` field;
- introduces `purchaseStatus` and `paymentTiming`;
- adds approved/actual/advance amounts and advance settlement status;
- adds Wise recipient/transfer/batch identifiers;
- expands payment-run status for Wise preparation and tracking.

Existing expenses are preserved. Old purchase-mode values are mapped as follows:

- `ALREADY_PURCHASED` → `purchaseStatus=ALREADY_PURCHASED`, `paymentTiming=AFTER_PURCHASE`;
- `NEEDS_ADVANCE` → `purchaseStatus=NOT_PURCHASED`, `paymentTiming=ADVANCE`;
- `WILL_PURCHASE_LATER` → `purchaseStatus=NOT_PURCHASED`, `paymentTiming=AFTER_PURCHASE`.

The example-only FundingRequest rows are intentionally deleted as requested.

## Wise environment

```env
WISE_API_TOKEN=...
WISE_PROFILE_ID=...
WISE_API_BASE_URL=https://api.wise.com
WISE_API_VERSION=2026Q3
```

Wise's current documentation says personal API tokens can create recipients, quotes, transfers/batches and track transfers, but API funding is restricted by country. For a UK business account, keep `WISE_ALLOW_API_FUNDING=false` unless Wise explicitly confirms funding-by-API is enabled for the account.
