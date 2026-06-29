# Railway private networking setup for sh-backend-api

## 1. Remove public domain

Railway Dashboard → **sh-backend-prod** → **sh-backend-api** → **Settings** → **Networking**

- Delete/remove the public domain (`*.up.railway.app`)
- Keep private DNS: `sh-backend-api.railway.internal:8080`

## 2. Set environment variables

```powershell
railway variable set PRIVATE_API_ONLY=true --service sh-backend-api
railway variable set SUPABASE_URL=https://YOUR_PROJECT.supabase.co --service sh-backend-api
railway variable set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY --service sh-backend-api
railway variable set ENABLE_BILLING=true --service sh-backend-api
```

## 3. Frontend (same Railway project)

Point your frontend service at the private URL:

```env
BACKEND_URL=http://sh-backend-api.railway.internal:8080
```

## 4. Run Supabase migration

Open Supabase SQL editor and run:

`supabase/migrations/001_monetized_api.sql`

## 5. Redeploy

```powershell
railway up --detach
```

## 6. Verify (from another Railway service or locally with VPN)

```bash
curl http://sh-backend-api.railway.internal:8080/health
curl http://sh-backend-api.railway.internal:8080/api/docs
```

Public URL should return `403` when `PRIVATE_API_ONLY=true`.
