# pg_cron Expiry Job Configuration

## Overview

The Alibhai Points system uses `pg_cron` to automatically expire points for customers who haven't made a purchase within the inactivity period (default: 25 days).

## Expiry Job Details

### Function
- **Function Name**: `public.expire_overdue_customers(p_now timestamptz default now())`
- **Purpose**: Checks all active customers and expires points for those who haven't made a purchase within the inactivity period
- **Returns**: Number of customers processed

### Schedule
- **Schedule**: Daily at 21:05 UTC (00:05 East Africa Time)
- **Cron Expression**: `5 21 * * *`

## Installation

### Method 1: pg_cron (Recommended for Supabase)

Run this once in the Supabase SQL editor:

```sql
-- Enable pg_cron extension
create extension if not exists pg_cron;

-- Schedule the expiry job
select cron.schedule(
  'expire-overdue-customers',
  '5 21 * * *',
  'select public.expire_overdue_customers()'
);
```

### Method 2: External Script (Alternative)

The project includes a Node.js script at `apps/api/scripts/run-expiry.ts` that can be:
- Run manually: `npm run expiry`
- Scheduled with cron/systemd/Task Scheduler

## Verification

### Check if pg_cron is installed
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

### Check scheduled jobs
```sql
SELECT * FROM cron.job;
```

Expected output:
```
jobid | schedule | command | nodename | nodeport | database | username | active | jobname
-------|----------|----------|----------|----------|----------|----------|--------|-----------------
1 | 5 21 * * * | select public.expire_overdue_customers() | | | | postgres | postgres | t | expire-overdue-customers
```

### Check job run history
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = 1 
ORDER BY start_time DESC 
LIMIT 10;
```

### Manual Test Run
```sql
-- Run the expiry function manually (without changing data)
SELECT public.expire_overdue_customers();
```

## Time Zone Notes

- **Server Timezone**: `Africa/Dar_es_Salaam` (UTC+3)
- **Job Schedule**: 21:05 UTC = 00:05 EAT (midnight)
- **Why Midnight**: To expire points at the end of the inactivity day
- **All Database Timestamps**: Stored in UTC
- **Display Logic**: Converts to local time for users

## What the Job Does

For each active customer:
1. Checks their last transaction date (or registration date if no transactions)
2. Calculates the deadline: last_transaction + inactivity_days
3. If deadline has passed:
   - Sets customer status to 'inactive'
   - Expires all pending points (points_remaining → points_expired)
   - Cancels any pending redemption requests
   - Writes a customer_status_event record

## Inactivity Period

The inactivity period is configurable via the active point rule:
- Default: 25 days
- Can be changed via PUT /api/admin/rules
- Only affects future inactivity checks
- Current customers with existing deadlines keep their original deadline

## Monitoring

### Check for inactive customers
```sql
SELECT 
  customer_code,
  status,
  last_transaction_at,
  created_at
FROM public.customers
WHERE status = 'inactive'
ORDER BY updated_at DESC;
```

### Check expired points
```sql
SELECT 
  c.customer_code,
  SUM(l.points_expired) as total_expired
FROM public.customers c
JOIN public.point_lots l ON c.id = l.customer_id
WHERE l.status = 'expired'
GROUP BY c.customer_code
ORDER BY total_expired DESC;
```

### Check job performance
```sql
SELECT 
  start_time,
  end_time,
  status,
  message
FROM cron.job_run_details
WHERE jobid = 1
ORDER BY start_time DESC
LIMIT 20;
```

## Troubleshooting

### Job not running
1. Check pg_cron is installed: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
2. Check job is scheduled: `SELECT * FROM cron.job;`
3. Check job is active: The `active` column should be `t`
4. Check recent runs: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;`

### Job failing
1. Check job run details for error messages
2. Check Supabase logs for detailed error information
3. Ensure the function exists: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'expire_overdue_customers';`
4. Test the function manually: `SELECT public.expire_overdue_customers();`

### Points not expiring correctly
1. Check the active point rule's inactivity_days: `SELECT inactivity_days FROM public.point_rules WHERE is_active;`
2. Check customer's last_transaction_at is not NULL
3. Manually run the function for a specific customer by using p_now parameter (for testing only)
