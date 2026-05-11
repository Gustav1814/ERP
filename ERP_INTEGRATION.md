# New ERP Target Integration Notes

> **This is the ERP-side copy of the integration doc.**
> The canonical source of truth lives in `hb-leads-crm/docs/ERP_INTEGRATION.md`.
> When the contract changes, update the CRM copy first, then mirror here.
>
> **Direction reminder:** `hb-leads-crm` (live source) -> `hb_im` (Sortly SSO bridge) -> `new ERP` (target).
> The **Push to ERP action is initiated only from `hb-leads-crm`**.
> CRM sends users to Sortly SSO bridge first, then Sortly redirects to New ERP with identity + handoff tokens.

See the full document at:

```
C:\xampp\htdocs\hb-leads-crm\docs\ERP_INTEGRATION.md
```

## Quick Links for ERP Developers

- [API Contract](../../hb-leads-crm/docs/ERP_INTEGRATION.md#7-api-contract)
- [Authentication](../../hb-leads-crm/docs/ERP_INTEGRATION.md#8-authentication)
- [Database Schema](../../hb-leads-crm/docs/ERP_INTEGRATION.md#9-database-schema-changes)
- [Signed Handoff Token Spec](../../hb-leads-crm/docs/ERP_INTEGRATION.md#16-signed-handoff-token-spec)
- [Backend Components](../../hb-leads-crm/docs/ERP_INTEGRATION.md#11-backend-components)

## ERP-Side Implementation Checklist

- [ ] New ERP import page route: `GET /account-management/import` (after callback)
- [ ] Add Sortly SSO bridge endpoint: `GET /sso/new-erp/start`
- [ ] Reuse current Sortly session; do not introduce new login flow in Sortly
- [ ] Validate signed handoff token and hydrate prefill data
- [ ] Enforce token rules: signature, `iss/aud/sub`, ttl <= 15m, one-time `jti`
- [ ] Persist/replay-protect `jti` (Redis or `erp_handoff_tokens` table)
- [ ] Build Existing vs New company intake UI on ERP page
- [ ] Support multiple billing addresses per company (office-wise)
- [ ] On import commit, bind selected `billing_address_id` to each order
- [ ] Commit route: `POST /api/v1/crm/import/commit`
- [ ] Migrations: `companies`, `company_addresses`, `erp_orders`, `erp_order_idempotency`
- [ ] Models under `app/Models/Crm/`
- [ ] `app/Http/Requests/Api/Crm/IngestOrderRequest.php`
- [ ] `app/Services/Crm/CrmOrderIngestService.php`
- [ ] `app/Http/Controllers/Api/Crm/OrderIngestController.php`
- [ ] `app/Http/Controllers/Api/Crm/CompanyLookupController.php`
- [ ] `app/Events/ErpOrderCreated.php` (empty listener for now)
- [ ] Route group `v1/crm` in `routes/api.php` with `check.passport.client`
- [ ] `.env` → `CLIENT_ID`, `CLIENT_SECRET`
- [ ] Postman smoke tests for `GET /companies/search` and `POST /orders` (new + existing)
- [ ] Idempotency replay test (same `X-Idempotency-Key` returns 409 + cached response)
