# Environment Configuration

## Environment Variables

All variables are read from `process.env` and validated with Zod when the API
starts. Local development may use an ignored `apps/api/.env` file; production
values belong in the Vercel project’s Environment Variables settings.

To run locally, copy `.env.example` to `.env` in `apps/api` and set
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`
(at least 32 characters), and `AUTH_EMAIL_DOMAIN` to values for your Supabase
project.
The backend requires the real Supabase service-role key to perform API
operations; do not put it in the mobile app or commit the local `.env`.
Start it from `apps/api` with `npm run dev`; it listens on port 5000 by default.

Required:
- `SUPABASE_URL` - Supabase project URL.
- `SUPABASE_ANON_KEY` - Supabase publishable/anonymous key used only to verify
  the current PIN through a separate non-persistent Auth client.
- `SUPABASE_SERVICE_ROLE_KEY` - Backend-only service-role key.
- `JWT_SECRET` - Secret of at least 32 characters for API-issued JWTs.
- `AUTH_EMAIL_DOMAIN` - Auth email domain configured for the Supabase project.

Optional:
- `NODE_ENV` - `development`, `test`, or `production` (Vercel: `production`).
- `PORT` - Local server port (default: `5000`; Vercel supplies its own runtime).
- `CORS_ORIGINS` - Comma-separated exact browser origins. Requests with no
  `Origin` header are allowed; other browser origins receive no CORS permission.
- `MIN_APP_VERSION` - Minimum supported mobile app version returned by
  `GET /api/health` (default: `1.0.0`). Set this to require Android users with
  older versions to update from Google Play.

Required in production:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Production rate limits use Upstash Redis so they are shared between serverless
instances. Only local development and tests use the in-memory rate limiter;
tests use non-production placeholder values from `tests/setup.ts`.
No real secret belongs in `.env.example` or source control.

## Security Notes

### NEVER Expose Service Role Keys
- The `SUPABASE_SERVICE_ROLE_KEY` must only be used by the backend
- Never commit service role keys to version control
- Never include them in frontend code
- They bypass RLS and have full database access

### Frontend Keys
- The frontend should only use `SUPABASE_ANON_KEY` for:
  - Supabase Auth operations (OTP, user management)
  - No direct database access (RLS blocks everything)
  - No RPC function calls (execute permissions revoked)

### Environment Variable Loading
The backend uses dotenv to load environment variables from:
1. `.env` (local development, never commit)
2. `.env.development` (development)
3. `.env.production` (production)
4. `.env.test` (testing)

## Expiry Schedule

The daily expiry job runs in Supabase `pg_cron`; the API does not schedule it.
See [PG_CRON_CONFIGURATION.md](./PG_CRON_CONFIGURATION.md).

## Supabase Backups

Enable automated backups in Supabase:
1. Go to Project Settings > Database
2. Enable "Daily backups" (retention: 7-30 days)
3. Enable "Point-in-time recovery" (retention: 7-30 days)
4. Consider enabling "Realtime" if needed

## Database Connection

The backend uses the Supabase Node.js client with service role:
- Connection pooling is handled by Supabase
- The client is configured in `src/config/supabase.ts`
- Connection is established on first use
- No connection string is exposed in code
