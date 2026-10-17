# Vercel Deployment - Alibhai Points API

## Vercel Project Settings

Create a Vercel project from this repository with:

| Setting | Value |
| --- | --- |
| Framework Preset | Express |
| Root Directory | `apps/api` |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | Leave blank (the Express app is deployed as a Function) |
| Function region | `cpt1` (Cape Town; selected as the nearest Vercel region for an East African Supabase deployment) |
| Function max duration | 30 seconds |

Both `src/index.ts` and `src/app.ts` export the Express app as a default export.
Vercel may detect `src/app.ts` as the Express entry point, so both entry files
have the 30-second function limit configured. Vercel's Express integration
routes requests to the app, so no rewrite is needed. `src/server.ts` is only
for local `app.listen()` development. The project region is set in
`vercel.json`; if the Supabase project is hosted outside Africa, change
`regions` there to the closest Vercel region to that actual project.

## Environment Variables

Add these in **Vercel > Project > Settings > Environment Variables** for
Production (and Preview if previews should use a separate backend):

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (backend only) |
| `JWT_SECRET` | A private random value of at least 32 characters |
| `AUTH_EMAIL_DOMAIN` | Auth email domain used by this project |
| `CORS_ORIGINS` | Comma-separated exact browser origins; can be empty when only mobile clients are used |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

Set real values only in Vercel's dashboard or an ignored local `.env` file.
Do not commit credentials, add the service-role key to the mobile app, or use
`SUPABASE_ANON_KEY` in this backend. `PORT` is only needed locally. The API
allows requests without an `Origin` header; browsers are allowed only when
their exact origin appears in `CORS_ORIGINS`.

The production rate limiter requires both Upstash variables and shares rate
limits across serverless instances. In-memory limiting is only used in local
development. The daily expiry schedule belongs in Supabase `pg_cron`, not in
Vercel or an API process; see [PG_CRON_CONFIGURATION.md](./PG_CRON_CONFIGURATION.md).

## Account deletion requests

The existing `public.account_deletion_requests` table is used to record
customer requests for manual office handling. It must contain `customer_id`,
`reason`, `status` (`pending`, `done` or `rejected`), `created_at`,
`handled_by` and `handled_at`, plus its request identifier. The API also writes
review actions to the existing `admin_audit_logs` table. No account or
transaction data is deleted automatically, and this feature does not modify
other tables.

The API scopes customer request reads to the authenticated customer's record,
and admin routes check the persisted admin role. Restrict direct table access
with Supabase RLS and never expose the service-role key to the mobile app.

## Build and Test Before Deploy

From the repository root:

```powershell
npm run api:build
npm run api:test
```

## Live Smoke Tests

Replace the URL with the Vercel production domain. Run these in PowerShell:

```powershell
$base = "https://<your-api-project>.vercel.app"

# Public health endpoint: expect HTTP 200 with status and version.
curl.exe -i "$base/api/health"

# Protected customer profile without a token: expect HTTP 401.
curl.exe -i "$base/api/me"

# Sign in as a customer, then copy `data.token` from the JSON response.
curl.exe -i -X POST "$base/api/auth/login" `
  -H "Content-Type: application/json" `
  --data-raw '{"phone":"<customer-phone>","pin":"<customer-pin>"}'

# A valid customer token must be rejected from an admin endpoint: expect HTTP 403.
$customerToken = "<paste-data.token-here>"
curl.exe -i "$base/api/admin/dashboard" `
  -H "Authorization: Bearer $customerToken"
```

The last check requires a valid customer login and an active customer profile.
