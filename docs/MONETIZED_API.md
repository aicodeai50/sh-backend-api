# Monetized API Platform

OpenAI-style API with user accounts, API keys, token metering, and Stripe billing.

## Setup

### 1. Supabase

Run `supabase/migrations/001_monetized_api.sql` in the Supabase SQL editor.

Set Railway env vars:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 2. Billing

```env
ENABLE_BILLING=true
SH_COST_PER_TOKEN=0.0001
SH_COST_PER_REQUEST=0.001
SIGNUP_BONUS_BALANCE=10
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 3. Private network (recommended)

```env
PRIVATE_API_ONLY=true
ENABLE_LEGACY_SH_KEY=true
```

In Railway → **sh-backend-api** → Settings → Networking → **remove public domain**.

Your frontend (same Railway project) calls:

```
http://sh-backend-api.railway.internal:8080
```

Health check still works on `/health` for Railway probes.

### 4. Admin access

```env
ADMIN_USER_IDS=uuid-of-admin-user
```

Or set `is_admin=true` on a user in Supabase.

---

## Authentication

| Use case | Header |
|----------|--------|
| Dashboard (keys, billing) | `Authorization: Bearer <JWT from login>` |
| API calls | `Authorization: Bearer sk_live_...` |

---

## Endpoints

### Auth

```bash
# Sign up ($10 bonus by default)
curl -X POST http://sh-backend-api.railway.internal:8080/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret1234","name":"Jane"}'

# Login
curl -X POST http://sh-backend-api.railway.internal:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret1234"}'
```

### API keys

```bash
curl -X POST http://sh-backend-api.railway.internal:8080/api/keys \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name":"My App","rate_limit":120}'

curl http://sh-backend-api.railway.internal:8080/api/keys \
  -H "Authorization: Bearer <JWT>"

curl -X DELETE http://sh-backend-api.railway.internal:8080/api/keys/<key-id> \
  -H "Authorization: Bearer <JWT>"
```

### Generate (billable)

```bash
curl -X POST http://sh-backend-api.railway.internal:8080/api/generate \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Explain quantum computing in one paragraph"}'
```

Response includes `tokens_used`, `cost`, `balance_remaining`.

### Billing

```bash
curl http://sh-backend-api.railway.internal:8080/api/billing/balance \
  -H "Authorization: Bearer <JWT>"

curl "http://sh-backend-api.railway.internal:8080/api/billing/usage?start_date=2026-01-01" \
  -H "Authorization: Bearer <JWT>"

curl -X POST http://sh-backend-api.railway.internal:8080/api/billing/topup \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"amount":50}'
```

With Stripe configured, topup returns `client_secret` for the frontend. Confirm with:

```json
{"amount":50,"stripe_payment_intent_id":"pi_..."}
```

### Admin

```bash
curl http://sh-backend-api.railway.internal:8080/admin/users \
  -H "Authorization: Bearer <ADMIN_JWT>"

curl -X POST http://sh-backend-api.railway.internal:8080/admin/pricing \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"/api/generate","cost_per_token":0.00015,"cost_per_request":0.002}'

curl http://sh-backend-api.railway.internal:8080/admin/revenue \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

### API discovery

```bash
curl http://sh-backend-api.railway.internal:8080/api/docs
```

---

## Database tables (Supabase)

- `users` — accounts, balance, total_spent
- `api_keys` — hashed keys, rate limits
- `api_usage` — per-request token + cost logs
- `billing_transactions` — topups and deductions
- `pricing` — per-endpoint pricing

---

## Legacy routes

Existing `/auth`, `/company`, `/api/v1/*` routes still use `x-sh-api-key: SH_API_KEY` for internal services.

Set `ENABLE_LEGACY_SH_KEY=false` in production once all clients use `sk_live_` keys.
