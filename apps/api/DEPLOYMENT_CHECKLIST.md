# Deployment Checklist - Alibhai Points API

## Pre-Deployment Checklist

### 1. Environment Configuration

- [ ] Create `.env.production` file with production values
- [ ] Set `NODE_ENV=production`
- [ ] Set `PORT` (default: 5000)
- [ ] Configure `CORS_ORIGINS` with your frontend domain(s) - **NOT** `*` in production
- [ ] Set `SUPABASE_URL` to your production Supabase project URL
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` to production service role key
- [ ] Set `SUPABASE_ANON_KEY` to production anon key
- [ ] Set `TZ=Africa/Dar_es_Salaam` (or your preferred timezone)
- [ ] Verify no environment variables are committed to git
- [ ] Verify `.env` is in `.gitignore`

### 2. Supabase Configuration

- [ ] Review and apply `supabase/schema.sql` to production database
- [ ] Verify RLS is enabled on all tables:
  - [ ] `profiles`
  - [ ] `customers`
  - [ ] `point_rules`
  - [ ] `purchases`
  - [ ] `point_lots`
  - [ ] `point_redemptions`
  - [ ] `point_redemption_items`
  - [ ] `customer_status_events`
  - [ ] `admin_audit_logs`
- [ ] Verify table permissions revoked from `anon` and `authenticated`:
  ```sql
  SELECT grantee, table_name, privilege_type 
  FROM information_schema.table_privileges 
  WHERE table_schema = 'public' 
  AND grantee IN ('anon', 'authenticated');
  ```
  Expected: **no results**
- [ ] Verify function execute permissions revoked from `anon` and `authenticated`:
  ```sql
  SELECT proname, proacl 
  FROM pg_proc 
  WHERE pronamespace = 'public'::regnamespace;
  ```
  Expected: Only `service_role` has execute permissions
- [ ] Create at least one admin user in Supabase Auth
- [ ] Create the admin's profile and set role to 'admin':
  ```sql
  INSERT INTO public.profiles (id, full_name, phone, role, is_active)
  VALUES ('admin-uuid', 'Admin Name', '+255712000001', 'admin', true);
  ```
- [ ] Enable Supabase backups:
  - [ ] Daily backups enabled (retention: 7-30 days)
  - [ ] Point-in-time recovery enabled (retention: 7-30 days)
- [ ] Verify `pg_cron` extension is installed:
  ```sql
  SELECT * FROM pg_extension WHERE extname = 'pg_cron';
  ```
- [ ] Schedule the expiry job:
  ```sql
  SELECT cron.schedule(
    'expire-overdue-customers',
    '5 21 * * *',
    'SELECT public.expire_overdue_customers()'
  );
  ```
- [ ] Verify job is scheduled:
  ```sql
  SELECT * FROM cron.job;
  ```
- [ ] Test the expiry function manually:
  ```sql
  SELECT public.expire_overdue_customers();
  ```

### 3. Security Verification

- [ ] Service role key is **ONLY** in backend environment (never in frontend)
- [ ] Frontend only uses anon key for Supabase Auth
- [ ] No API keys or secrets in frontend code
- [ ] No API keys or secrets in git history
- [ ] All admin routes require `authMiddleware` and `requireAdmin`
- [ ] Disabled users cannot authenticate (tested)
- [ ] Non-admin users cannot access admin endpoints (tested)
- [ ] Rate limiting is enabled:
  - [ ] Standard API: 100 requests per 15 minutes
  - [ ] Auth endpoints: 10 attempts per 15 minutes
  - [ ] Admin write: 20 requests per 15 minutes
- [ ] CORS is restricted to allowed origins
- [ ] Helmet is enabled with secure headers
- [ ] Body size limit is set (1MB)
- [ ] Error handling does not leak stack traces
- [ ] Error handling redacts sensitive data (tokens, phone numbers, PINs)

### 4. Dependency Audit

- [ ] Run `npm audit` in `apps/api/`
- [ ] Fix or review any high/critical vulnerabilities
- [ ] Review `package.json` for any unnecessary dependencies
- [ ] Verify all dependencies are using stable versions (published at least 7 days ago)
- [ ] Run `npm audit` in `apps/mobile/` (if deploying mobile together)

**Note on Known Vulnerabilities**:
The project currently has 3 test-only vulnerabilities in `vitest` and `tinypool`:
- `@vitest/mocker` (moderate) - Path Traversal vulnerability
- `tinypool` (critical) - Prototype Pollution

These are **test-only dependencies** and do not affect production runtime. The fix requires upgrading to vitest 5.0.3 which is a breaking change. For production deployment, consider:
1. Accepting these test-only vulnerabilities (risk is minimal as they only affect test execution)
2. Upgrading to vitest 5.0.3 and updating test code (breaking change)
3. Pinning vitest to a newer non-vulnerable version and adjusting tests

### 5. Database Testing

- [ ] Test customer registration flow
- [ ] Test login with PIN
- [ ] Test purchase recording
- [ ] Test point calculation (TZS 50,000 = 50 points)
- [ ] Test redemption request
- [ ] Test redemption approval
- [ ] Test purchase voiding
- [ ] Test customer enable/disable
- [ ] Test PIN reset
- [ ] Test point rules update
- [ ] Test report generation
- [ ] Test audit log retrieval
- [ ] Test dashboard metrics

### 6. Concurrency Testing

- [ ] Test parallel purchase requests with same idempotency key
- [ ] Test parallel redemption requests (should prevent negative balance)
- [ ] Test concurrent read/write operations

### 7. Business Rules Verification

- [ ] Verify TZS 50,000 = 50 points (1,000 TZS per point)
- [ ] Verify 90-day maturity period
- [ ] Verify 25-day inactivity deadline
- [ ] Verify FIFO redemption (oldest points used first)
- [ ] Verify inactive customer reactivation on new purchase
- [ ] Verify purchase voiding when points are unused
- [ ] Verify purchase voiding fails when points are used

### 8. Server Configuration

- [ ] Install Node.js (recommended: LTS version)
- [ ] Install dependencies: `npm install` in `apps/api/`
- [ ] Run TypeScript check: `npm run typecheck`
- [ ] Run tests: `npm test`
- [ ] Configure PM2 or process manager (if not using a platform service)
- [ ] Set up log rotation
- [ ] Configure monitoring/alerting

### 9. Health Check Verification

- [ ] Test health check endpoint: `GET /api/health`
- [ ] Verify response includes: status, timestamp, service, version
- [ ] Set up external health monitoring (e.g., Uptime Robot, Pingdom)

### 10. Graceful Shutdown

- [ ] Verify server handles SIGTERM correctly
- [ ] Verify server handles SIGINT correctly
- [ ] Verify graceful shutdown timeout (10 seconds)
- [ ] Test by sending SIGTERM to running process

### 11. Frontend Integration

- [ ] Update mobile app `EXPO_PUBLIC_API_URL` to production API URL
- [ ] Verify mobile app can authenticate
- [ ] Verify mobile app can fetch customer data
- [ ] Verify mobile app can make purchases
- [ ] Verify mobile app can request redemptions
- [ ] Verify admin screens work with production API
- [ ] Test error handling in mobile app

### 12. Documentation

- [ ] API documentation is available (README.md, openapi.yaml)
- [ ] Environment variables documented (ENVIRONMENT.md)
- [ ] Supabase security documented (SUPABASE_SECURITY.md)
- [ ] pg_cron configuration documented (PG_CRON_CONFIGURATION.md)
- [ ] Deployment checklist is reviewed

### 13. Monitoring and Logging

- [ ] Configure application logging (Pino)
- [ ] Set up log aggregation (e.g., CloudWatch, Papertrail, Loki)
- [ ] Configure error tracking (e.g., Sentry)
- [ ] Set up performance monitoring
- [ ] Set up alerts for:
  - [ ] Server downtime
  - [ ] High error rates
  - [ ] Slow response times
  - [ ] Database connection issues

### 14. Backup and Recovery

- [ ] Verify Supabase daily backups are running
- [ ] Verify point-in-time recovery is enabled
- [ ] Document backup restoration procedure
- [ ] Test backup restoration (in staging)
- [ ] Document disaster recovery plan

### 15. Post-Deployment Verification

- [ ] Run smoke tests on production API
- [ ] Verify health check endpoint
- [ ] Verify customer can register
- [ ] Verify customer can login
- [ ] Verify admin can record purchase
- [ ] Verify customer can request redemption
- [ ] Verify admin can approve redemption
- [ ] Verify dashboard metrics are accurate
- [ ] Verify audit logs are being written
- [ ] Verify pg_cron job runs (check next day)
- [ ] Monitor error logs for first 24 hours
- [ ] Monitor performance metrics for first 24 hours

## Production URLs

- **API URL**: (fill in)
- **Supabase Dashboard**: (fill in)
- **Monitoring Dashboard**: (fill in)
- **Log Aggregation**: (fill in)

## Contact Information

- **Primary Contact**: (fill in)
- **Backup Contact**: (fill in)
- **Supabase Support**: https://supabase.com/support

## Rollback Plan

If deployment fails:

1. Revert to previous code version
2. Restore database from backup (if schema changed)
3. Restart server
4. Verify health check
5. Monitor logs

## Emergency Contacts

- **Database Issues**: Supabase Support
- **Server Issues**: DevOps team
- **Security Issues**: Security team

---

## Deployment Commands

### Manual Deployment

```bash
# SSH into server
ssh user@your-server

# Navigate to app directory
cd /path/to/alibhai-points/apps/api

# Pull latest code
git pull origin main

# Install dependencies
npm ci --production

# Run typecheck
npm run typecheck

# Restart application (with PM2)
pm2 restart alibhai-points-api

# Check logs
pm2 logs alibhai-points-api

# Check status
pm2 status
```

### Using a Platform Service (e.g., Railway, Render, Heroku)

1. Connect repository to platform
2. Configure environment variables in platform dashboard
3. Deploy
4. Verify health check
5. Monitor logs

---

## Common Issues and Solutions

### Issue: Database connection refused
**Solution**: Verify Supabase URL and service role key are correct

### Issue: 401 Unauthorized errors
**Solution**: Verify token is being sent correctly in Authorization header

### Issue: CORS errors
**Solution**: Verify CORS_ORIGINS includes your frontend domain

### Issue: Rate limiting errors in production
**Solution**: Adjust rate limits in `middleware/rateLimit.ts` or whitelist production IPs

### Issue: pg_cron job not running
**Solution**: Verify pg_cron extension is installed and job is scheduled

### Issue: Points not expiring
**Solution**: Verify inactivity_days in point_rules and check job run history

---

## Security Best Practices

1. **Never commit secrets** - Always use environment variables
2. **Rotate keys regularly** - Change service role keys periodically
3. **Monitor access logs** - Review who is accessing the API
4. **Keep dependencies updated** - Run `npm audit` regularly
5. **Use HTTPS** - Always use TLS in production
6. **Implement rate limiting** - Prevent abuse and DDoS
7. **Validate all inputs** - Use strict Zod schemas
8. **Log and monitor** - Set up comprehensive logging and alerting
9. **Backup regularly** - Ensure data can be restored
10. **Test before deploying** - Run all tests in staging first
