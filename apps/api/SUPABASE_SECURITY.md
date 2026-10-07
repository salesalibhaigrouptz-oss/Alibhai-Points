# Supabase Security Verification

## Row Level Security (RLS)

All tables have RLS enabled:
- `public.profiles`
- `public.customers`
- `public.point_rules`
- `public.purchases`
- `public.point_lots`
- `public.point_redemptions`
- `public.point_redemption_items`
- `public.customer_status_events`
- `public.admin_audit_logs`

## Table Permissions

All table permissions are revoked from `anon` and `authenticated` roles:
```sql
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
```

This means:
- The public `anon` key cannot read any table
- The `authenticated` key cannot read any table
- Only the `service_role` key (backend only) can access tables

## Function Permissions

All function execute permissions are revoked from public, anon, and authenticated:
```sql
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
```

This means:
- Public API keys cannot call any RPC function
- Only the `service_role` key (backend only) can execute functions
- All business logic functions require `service_role`

## Security Model

The backend uses the `service_role` key which:
- Bypasses RLS (intentionally, as the backend is trusted)
- Can execute all RPC functions
- Can read/write all tables
- Is never exposed to the frontend

The frontend uses the `anon` and `authenticated` keys which:
- Cannot read any table (RLS blocks everything)
- Cannot execute any function (execute permissions revoked)
- Can only be used for Supabase Auth operations (OTP, user management)

## Verification Commands

To verify the security setup in Supabase SQL Editor:

```sql
-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check table permissions for anon and authenticated
SELECT grantee, table_name, privilege_type 
FROM information_schema.table_privileges 
WHERE table_schema = 'public' 
AND grantee IN ('anon', 'authenticated');

-- Check function execute permissions
SELECT proname, pronamespace, proowner, proacl 
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace;
```

Expected results:
- All tables should have `rowsecurity = true`
- No table permissions for `anon` or `authenticated`
- No execute permissions for `anon` or `authenticated` on functions
