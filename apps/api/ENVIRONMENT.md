# Environment Configuration

## Required Environment Variables

### Server Configuration
- `NODE_ENV` - Environment: `development`, `test`, or `production`
- `PORT` - Server port (default: 5000)
- `CORS_ORIGINS` - Comma-separated list of allowed CORS origins, or `*` for all

### Supabase Configuration
- `SUPABASE_URL` - Supabase project URL (e.g., `https://your-project.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (backend only, never exposed to frontend)
- `SUPABASE_ANON_KEY` - Anonymous key (for frontend auth operations only)

### Time Zone
- `TZ` - Server timezone (default: `Africa/Dar_es_Salaam`)

## Environment Files

### Development (.env.development)
```bash
NODE_ENV=development
PORT=5000
CORS_ORIGINS=http://localhost:8081,http://localhost:19006
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
TZ=Africa/Dar_es_Salaam
```

### Production (.env.production)
```bash
NODE_ENV=production
PORT=5000
CORS_ORIGINS=https://your-frontend-domain.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
TZ=Africa/Dar_es_Salaam
```

### Test (.env.test)
```bash
NODE_ENV=test
PORT=5001
CORS_ORIGINS=*
SUPABASE_URL=https://test-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=test-service-role-key
SUPABASE_ANON_KEY=test-anon-key
TZ=Africa/Dar_es_Salaam
```

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

## Time Zone Configuration

The application runs in East Africa Time (EAT) - UTC+3:
- Timezone: `Africa/Dar_es_Salaam`
- The expiry job is scheduled to run at 21:05 UTC (00:05 EAT)
- All timestamps in the database are stored in UTC
- Display logic converts to local time for users

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
