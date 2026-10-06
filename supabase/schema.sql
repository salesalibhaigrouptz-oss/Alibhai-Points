-- =====================================================================
-- Alibhai Points - database schema v2 (Supabase PostgreSQL)
-- Run in the Supabase SQL editor. Only the trusted backend (service_role)
-- may touch these tables and functions.
-- =====================================================================
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null check (length(trim(full_name)) >= 2),
  phone       text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  role        text not null default 'customer' check (role in ('customer','admin')),
  is_active   boolean not null default true,   -- false = account disabled by admin
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create sequence public.customer_sequence start 1;

create table public.customers (
  id                   uuid primary key default gen_random_uuid(),
  profile_id           uuid not null unique references public.profiles(id) on delete cascade,
  customer_code        text not null unique,
  initials             text not null,
  sequence_number      integer not null unique,
  last_transaction_at  timestamptz,
  status               text not null default 'active' check (status in ('active','inactive')),
  points_balance       integer not null default 0 check (points_balance >= 0),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.point_rules (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  amount_per_point     numeric(12,2) not null check (amount_per_point > 0),
  redemption_wait_days integer not null default 90 check (redemption_wait_days >= 0),
  inactivity_days      integer not null default 25 check (inactivity_days > 0),
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
-- only ONE rule can be active at any time
create unique index one_active_point_rule on public.point_rules (is_active) where is_active;

insert into public.point_rules (name, amount_per_point, redemption_wait_days, inactivity_days)
values ('Default Points Rule', 1000, 90, 25);

create table public.purchases (
  id                     uuid primary key default gen_random_uuid(),
  customer_id            uuid not null references public.customers(id),
  point_rule_id          uuid not null references public.point_rules(id),
  purchase_amount        numeric(14,2) not null check (purchase_amount > 0),
  amount_per_point_used  numeric(12,2) not null,      -- snapshot of the rule used
  points_earned          integer not null check (points_earned >= 0),
  recorded_by            uuid not null references public.profiles(id),
  transaction_reference  text not null unique,
  idempotency_key        text unique,                 -- stops double-tap duplicates
  status                 text not null default 'completed' check (status in ('completed','voided')),
  voided_by              uuid references public.profiles(id),
  voided_at              timestamptz,
  void_reason            text,
  purchased_at           timestamptz not null default now(),
  created_at             timestamptz not null default now()
);

create table public.point_lots (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customers(id),
  purchase_id       uuid not null unique references public.purchases(id),
  points_earned     integer not null check (points_earned > 0),
  points_remaining  integer not null check (points_remaining >= 0),
  points_expired    integer not null default 0 check (points_expired >= 0),
  earned_at         timestamptz not null,
  redeemable_at     timestamptz not null,
  -- 'waiting' vs 'redeemable' is NOT stored: it is worked out from redeemable_at
  status            text not null default 'active'
                    check (status in ('active','fully_redeemed','expired','voided')),
  created_at        timestamptz not null default now(),
  constraint lot_remaining_ok check (points_remaining <= points_earned),
  constraint lot_total_ok     check (points_remaining + points_expired <= points_earned),
  constraint lot_dates_ok     check (redeemable_at >= earned_at)
);

create table public.point_redemptions (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references public.customers(id),
  points_redeemed       integer not null check (points_redeemed > 0),
  redemption_reference  text not null unique,
  source                text not null check (source in ('customer_request','admin_direct')),
  status                text not null default 'pending' check (status in ('pending','completed','cancelled')),
  processed_by          uuid references public.profiles(id),   -- admin who completed it
  completed_at          timestamptz,
  cancelled_by          uuid references public.profiles(id),   -- null = cancelled by system
  cancelled_at          timestamptz,
  cancel_reason         text,
  redeemed_at           timestamptz not null default now(),    -- time of request
  created_at            timestamptz not null default now()
);
-- a customer can have only one open request at a time
create unique index one_pending_redemption_per_customer
  on public.point_redemptions (customer_id) where status = 'pending';

create table public.point_redemption_items (
  id             uuid primary key default gen_random_uuid(),
  redemption_id  uuid not null references public.point_redemptions(id) on delete cascade,
  point_lot_id   uuid not null references public.point_lots(id),
  points_used    integer not null check (points_used > 0),
  created_at     timestamptz not null default now()
);

create table public.customer_status_events (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references public.customers(id) on delete cascade,
  previous_status  text,
  new_status       text not null check (new_status in ('active','inactive')),
  reason           text,
  created_at       timestamptz not null default now()
);

create table public.admin_audit_logs (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null references public.profiles(id),
  action       text not null,
  entity_type  text,
  entity_id    uuid,
  description  text,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. INDEXES (unique columns already have an index)
-- ---------------------------------------------------------------------
create index idx_purchases_customer_date on public.purchases (customer_id, purchased_at desc);
create index idx_purchases_date          on public.purchases (purchased_at);
create index idx_lots_fifo               on public.point_lots (customer_id, status, earned_at);
create index idx_redemptions_customer    on public.point_redemptions (customer_id, redeemed_at desc);
create index idx_redemptions_status      on public.point_redemptions (status, redeemed_at desc);
create index idx_redemption_items_lot    on public.point_redemption_items (point_lot_id);
create index idx_customers_activity      on public.customers (status, last_transaction_at);
create index idx_status_events_customer  on public.customer_status_events (customer_id, created_at);
create index idx_audit_created           on public.admin_audit_logs (created_at desc);

create trigger trg_profiles_updated  before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_customers_updated before update on public.customers
  for each row execute function public.set_updated_at();
create trigger trg_rules_updated     before update on public.point_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. SECURITY: deny everything to the public API keys.
--    The backend uses the service_role key, which bypasses RLS.
-- ---------------------------------------------------------------------
alter table public.profiles                enable row level security;
alter table public.customers               enable row level security;
alter table public.point_rules             enable row level security;
alter table public.purchases               enable row level security;
alter table public.point_lots              enable row level security;
alter table public.point_redemptions       enable row level security;
alter table public.point_redemption_items  enable row level security;
alter table public.customer_status_events  enable row level security;
alter table public.admin_audit_logs        enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. BUSINESS FUNCTIONS (each call is ONE atomic database transaction)
--    Business-rule failures return {"ok":false,"code":"..."}.
--    Bad input / no permission / not found raise an exception.
--    p_now exists only so tests can simulate dates. The backend must
--    NEVER pass p_now from a request; production calls omit it.
-- ---------------------------------------------------------------------
create or replace function public._require_admin(p_admin_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.profiles
                 where id = p_admin_id and role = 'admin' and is_active) then
    raise exception 'NOT_ADMIN';
  end if;
end $$;

-- 4.1 Create customer after OTP: profile + customer + ID (IS01) in one step
create or replace function public.create_customer_profile(
  p_user_id uuid, p_full_name text, p_phone text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_name     text := trim(regexp_replace(coalesce(p_full_name,''), '\s+', ' ', 'g'));
  v_parts    text[];
  v_initials text;
  v_seq      integer;
  v_c        public.customers%rowtype;
begin
  if length(v_name) < 2 then raise exception 'INVALID_NAME'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));   -- same user twice = safe
  select * into v_c from public.customers where profile_id = p_user_id;
  if found then
    return jsonb_build_object('ok', true, 'created', false,
                              'customer_id', v_c.id, 'customer_code', v_c.customer_code);
  end if;
  v_parts    := string_to_array(v_name, ' ');
  v_initials := upper(left(v_parts[1], 1) ||
                case when array_length(v_parts, 1) > 1
                     then left(v_parts[array_length(v_parts, 1)], 1) else '' end);
  v_seq := nextval('public.customer_sequence');
  insert into public.profiles (id, full_name, phone, role)
    values (p_user_id, v_name, p_phone, 'customer')
    on conflict (id) do nothing;
  insert into public.customers (profile_id, customer_code, initials, sequence_number)
    values (p_user_id, v_initials || lpad(v_seq::text, 2, '0'), v_initials, v_seq)
    returning * into v_c;
  insert into public.customer_status_events (customer_id, previous_status, new_status, reason)
    values (v_c.id, null, 'active', 'Registered');
  return jsonb_build_object('ok', true, 'created', true,
                            'customer_id', v_c.id, 'customer_code', v_c.customer_code);
end $$;

-- 4.2 Remove points of a customer when the inactivity deadline has passed
create or replace function public.apply_inactivity_if_due(
  p_customer_id uuid, p_now timestamptz default now())
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_c    public.customers%rowtype;
  v_days integer;
  v_r    record;
begin
  select * into v_c from public.customers where id = p_customer_id for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  if v_c.status <> 'active' then return false; end if;
  select inactivity_days into v_days from public.point_rules where is_active;
  if v_days is null then raise exception 'NO_ACTIVE_RULE'; end if;
  if p_now <= coalesce(v_c.last_transaction_at, v_c.created_at) + make_interval(days => v_days) then
    return false;
  end if;

  update public.customers set status = 'inactive', points_balance = 0 where id = v_c.id;
  insert into public.customer_status_events (customer_id, previous_status, new_status, reason, created_at)
    values (v_c.id, 'active', 'inactive', 'No transaction within ' || v_days || ' days', p_now);
  update public.point_lots
     set points_expired = points_expired + points_remaining, points_remaining = 0, status = 'expired'
   where customer_id = v_c.id and status = 'active' and points_remaining > 0;
  -- an open redemption request dies with the points it was holding
  for v_r in select id from public.point_redemptions
              where customer_id = v_c.id and status = 'pending' loop
    perform public._reverse_redemption(v_r.id, null, 'Customer became inactive', p_now);
  end loop;
  return true;
end $$;

-- 4.3 Give points of a redemption back (or expire them if the customer went inactive)
create or replace function public._reverse_redemption(
  p_redemption_id uuid, p_actor uuid, p_reason text, p_now timestamptz)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_r       public.point_redemptions%rowtype;
  v_c       public.customers%rowtype;
  v_restore boolean;
  v_i       record;
  v_back    integer := 0;
begin
  select * into v_r from public.point_redemptions where id = p_redemption_id for update;
  if not found then raise exception 'REDEMPTION_NOT_FOUND'; end if;
  if v_r.status = 'cancelled' then raise exception 'REDEMPTION_ALREADY_CANCELLED'; end if;
  select * into v_c from public.customers where id = v_r.customer_id;   -- caller holds the lock
  v_restore := v_c.status = 'active'
    and not exists (select 1 from public.customer_status_events e
                    where e.customer_id = v_c.id and e.new_status = 'inactive'
                      and e.created_at > v_r.redeemed_at);
  for v_i in select * from public.point_redemption_items where redemption_id = p_redemption_id loop
    if v_restore then
      update public.point_lots
         set points_remaining = points_remaining + v_i.points_used, status = 'active'
       where id = v_i.point_lot_id and status in ('active','fully_redeemed');
      if found then
        v_back := v_back + v_i.points_used;
      else
        update public.point_lots set points_expired = points_expired + v_i.points_used
         where id = v_i.point_lot_id;
      end if;
    else
      update public.point_lots set points_expired = points_expired + v_i.points_used
       where id = v_i.point_lot_id;
    end if;
  end loop;
  update public.point_redemptions
     set status = 'cancelled', cancelled_by = p_actor, cancelled_at = p_now, cancel_reason = p_reason
   where id = p_redemption_id;
  if v_back > 0 then
    update public.customers set points_balance = points_balance + v_back where id = v_c.id;
  end if;
end $$;

-- 4.4 Admin records a purchase. Points are ALWAYS calculated here.
create or replace function public.record_purchase(
  p_customer_code text, p_amount numeric, p_admin_id uuid,
  p_idempotency_key text default null, p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_c      public.customers%rowtype;
  v_rule   public.point_rules%rowtype;
  v_old    public.purchases%rowtype;
  v_points integer;
  v_pid    uuid;
  v_ref    text;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  perform public._require_admin(p_admin_id);
  select * into v_c from public.customers
   where customer_code = upper(trim(p_customer_code)) for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  if not exists (select 1 from public.profiles where id = v_c.profile_id and is_active) then
    return jsonb_build_object('ok', false, 'code', 'CUSTOMER_DISABLED');
  end if;

  if p_idempotency_key is not null then
    select * into v_old from public.purchases where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('ok', true, 'duplicate', true, 'purchase_id', v_old.id,
        'transaction_reference', v_old.transaction_reference, 'points_earned', v_old.points_earned,
        'points_balance', v_c.points_balance, 'customer_status', v_c.status);
    end if;
  end if;

  select * into v_rule from public.point_rules where is_active;
  if not found then raise exception 'NO_ACTIVE_RULE'; end if;

  -- if the customer is overdue, old points expire BEFORE the new points are added
  perform public.apply_inactivity_if_due(v_c.id, p_now);

  v_points := floor(p_amount / v_rule.amount_per_point);
  v_ref    := 'TXN-' || to_char(p_now, 'YYMMDD') || '-' ||
              upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
  insert into public.purchases (customer_id, point_rule_id, purchase_amount, amount_per_point_used,
                                points_earned, recorded_by, transaction_reference,
                                idempotency_key, purchased_at)
    values (v_c.id, v_rule.id, p_amount, v_rule.amount_per_point, v_points, p_admin_id,
            v_ref, p_idempotency_key, p_now)
    returning id into v_pid;
  if v_points > 0 then
    insert into public.point_lots (customer_id, purchase_id, points_earned, points_remaining,
                                   earned_at, redeemable_at)
      values (v_c.id, v_pid, v_points, v_points, p_now,
              p_now + make_interval(days => v_rule.redemption_wait_days));
  end if;

  select * into v_c from public.customers where id = v_c.id;
  if v_c.status = 'inactive' then
    insert into public.customer_status_events (customer_id, previous_status, new_status, reason, created_at)
      values (v_c.id, 'inactive', 'active', 'New purchase', p_now);
  end if;
  update public.customers
     set last_transaction_at = p_now, status = 'active',
         points_balance = points_balance + v_points
   where id = v_c.id
   returning * into v_c;

  insert into public.admin_audit_logs (admin_id, action, entity_type, entity_id, description, metadata)
    values (p_admin_id, 'PURCHASE_RECORDED', 'purchase', v_pid,
            'Purchase for ' || v_c.customer_code,
            jsonb_build_object('amount', p_amount, 'points', v_points, 'reference', v_ref));
  return jsonb_build_object('ok', true, 'duplicate', false, 'purchase_id', v_pid,
    'transaction_reference', v_ref, 'points_earned', v_points,
    'points_balance', v_c.points_balance, 'customer_status', v_c.status);
end $$;

-- 4.5 Create a redemption.  Customer request: p_admin_id is null  -> status pending.
--     Admin deducting in the office: p_admin_id given             -> status completed.
--     Points are taken from the OLDEST eligible lots first (FIFO) right away,
--     so they cannot be used twice.
create or replace function public.create_redemption(
  p_customer_id uuid, p_points integer, p_admin_id uuid default null,
  p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_c          public.customers%rowtype;
  v_redeemable integer;
  v_id         uuid;
  v_ref        text;
  v_need       integer := p_points;
  v_take       integer;
  v_lot        record;
  v_status     text;
begin
  if p_points is null or p_points <= 0 then raise exception 'INVALID_POINTS'; end if;
  if p_admin_id is not null then perform public._require_admin(p_admin_id); end if;
  select * into v_c from public.customers where id = p_customer_id for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  perform public.apply_inactivity_if_due(p_customer_id, p_now);
  select * into v_c from public.customers where id = p_customer_id;
  if v_c.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'CUSTOMER_INACTIVE');
  end if;
  if exists (select 1 from public.point_redemptions
              where customer_id = p_customer_id and status = 'pending') then
    return jsonb_build_object('ok', false, 'code', 'PENDING_REQUEST_EXISTS');
  end if;
  select coalesce(sum(points_remaining), 0) into v_redeemable from public.point_lots
   where customer_id = p_customer_id and status = 'active' and redeemable_at <= p_now;
  if p_points > v_redeemable then
    return jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_REDEEMABLE_POINTS',
                              'redeemable_points', v_redeemable);
  end if;

  v_status := case when p_admin_id is null then 'pending' else 'completed' end;
  v_ref := 'RDM-' || to_char(p_now, 'YYMMDD') || '-' ||
           upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
  insert into public.point_redemptions (customer_id, points_redeemed, redemption_reference, source,
                                        status, processed_by, completed_at, redeemed_at)
    values (p_customer_id, p_points, v_ref,
            case when p_admin_id is null then 'customer_request' else 'admin_direct' end,
            v_status, p_admin_id,
            case when p_admin_id is null then null else p_now end, p_now)
    returning id into v_id;

  for v_lot in select id, points_remaining from public.point_lots
                where customer_id = p_customer_id and status = 'active'
                  and redeemable_at <= p_now and points_remaining > 0
                order by earned_at, id for update loop
    exit when v_need <= 0;
    v_take := least(v_need, v_lot.points_remaining);
    update public.point_lots
       set points_remaining = points_remaining - v_take,
           status = case when points_remaining - v_take = 0 then 'fully_redeemed' else 'active' end
     where id = v_lot.id;
    insert into public.point_redemption_items (redemption_id, point_lot_id, points_used)
      values (v_id, v_lot.id, v_take);
    v_need := v_need - v_take;
  end loop;
  update public.customers set points_balance = points_balance - p_points where id = p_customer_id;

  if p_admin_id is not null then
    insert into public.admin_audit_logs (admin_id, action, entity_type, entity_id, description, metadata)
      values (p_admin_id, 'REDEMPTION_DIRECT', 'redemption', v_id,
              'Points deducted for ' || v_c.customer_code,
              jsonb_build_object('points', p_points, 'reference', v_ref));
  end if;
  return jsonb_build_object('ok', true, 'redemption_id', v_id, 'reference', v_ref,
                            'status', v_status, 'points', p_points);
end $$;

-- 4.6 Admin confirms a customer's request (points are deducted for good)
create or replace function public.complete_redemption(
  p_redemption_id uuid, p_admin_id uuid, p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cid uuid;
  v_r   public.point_redemptions%rowtype;
begin
  perform public._require_admin(p_admin_id);
  select customer_id into v_cid from public.point_redemptions where id = p_redemption_id;
  if not found then raise exception 'REDEMPTION_NOT_FOUND'; end if;
  perform 1 from public.customers where id = v_cid for update;
  perform public.apply_inactivity_if_due(v_cid, p_now);
  select * into v_r from public.point_redemptions where id = p_redemption_id for update;
  if v_r.status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'REDEMPTION_NOT_PENDING', 'status', v_r.status);
  end if;
  update public.point_redemptions
     set status = 'completed', processed_by = p_admin_id, completed_at = p_now
   where id = p_redemption_id;
  insert into public.admin_audit_logs (admin_id, action, entity_type, entity_id, description, metadata)
    values (p_admin_id, 'REDEMPTION_COMPLETED', 'redemption', p_redemption_id,
            'Redemption ' || v_r.redemption_reference || ' completed',
            jsonb_build_object('points', v_r.points_redeemed));
  return jsonb_build_object('ok', true, 'status', 'completed', 'reference', v_r.redemption_reference);
end $$;

-- 4.7 Admin cancels a redemption (pending or completed) and the points go back safely
create or replace function public.cancel_redemption(
  p_redemption_id uuid, p_admin_id uuid, p_reason text default null,
  p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cid uuid;
  v_r   public.point_redemptions%rowtype;
begin
  perform public._require_admin(p_admin_id);
  select customer_id into v_cid from public.point_redemptions where id = p_redemption_id;
  if not found then raise exception 'REDEMPTION_NOT_FOUND'; end if;
  perform 1 from public.customers where id = v_cid for update;
  perform public.apply_inactivity_if_due(v_cid, p_now);
  select * into v_r from public.point_redemptions where id = p_redemption_id for update;
  if v_r.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'REDEMPTION_ALREADY_CANCELLED');
  end if;
  perform public._reverse_redemption(p_redemption_id, p_admin_id, p_reason, p_now);
  insert into public.admin_audit_logs (admin_id, action, entity_type, entity_id, description, metadata)
    values (p_admin_id, 'REDEMPTION_CANCELLED', 'redemption', p_redemption_id,
            'Redemption ' || v_r.redemption_reference || ' cancelled',
            jsonb_build_object('reason', p_reason, 'was', v_r.status));
  return jsonb_build_object('ok', true, 'status', 'cancelled');
end $$;

-- 4.8 Admin voids a mistaken purchase (only if its points are untouched)
create or replace function public.void_purchase(
  p_purchase_id uuid, p_admin_id uuid, p_reason text,
  p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_p   public.purchases%rowtype;
  v_lot public.point_lots%rowtype;
  v_last timestamptz;
begin
  perform public._require_admin(p_admin_id);
  if coalesce(trim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  select * into v_p from public.purchases where id = p_purchase_id;
  if not found then raise exception 'PURCHASE_NOT_FOUND'; end if;
  perform 1 from public.customers where id = v_p.customer_id for update;
  select * into v_p from public.purchases where id = p_purchase_id for update;
  if v_p.status = 'voided' then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_VOIDED');
  end if;
  select * into v_lot from public.point_lots where purchase_id = p_purchase_id for update;
  if found then
    if v_lot.status <> 'active' or v_lot.points_remaining <> v_lot.points_earned then
      return jsonb_build_object('ok', false, 'code', 'POINTS_ALREADY_USED_OR_EXPIRED');
    end if;
    update public.point_lots set points_remaining = 0, status = 'voided' where id = v_lot.id;
    update public.customers set points_balance = points_balance - v_lot.points_earned
     where id = v_p.customer_id;
  end if;
  update public.purchases
     set status = 'voided', voided_by = p_admin_id, voided_at = p_now, void_reason = p_reason
   where id = p_purchase_id;
  select max(purchased_at) into v_last from public.purchases
   where customer_id = v_p.customer_id and status = 'completed';
  update public.customers set last_transaction_at = v_last where id = v_p.customer_id;
  perform public.apply_inactivity_if_due(v_p.customer_id, p_now);   -- deadline may have moved back
  insert into public.admin_audit_logs (admin_id, action, entity_type, entity_id, description, metadata)
    values (p_admin_id, 'PURCHASE_VOIDED', 'purchase', p_purchase_id,
            'Purchase ' || v_p.transaction_reference || ' voided',
            jsonb_build_object('reason', p_reason, 'amount', v_p.purchase_amount));
  return jsonb_build_object('ok', true, 'status', 'voided');
end $$;

-- 4.9 Change the points rule for FUTURE purchases (old purchases and lots keep their values)
create or replace function public.update_point_rule(
  p_admin_id uuid, p_amount_per_point numeric, p_wait_days integer, p_inactivity_days integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
begin
  perform public._require_admin(p_admin_id);
  update public.point_rules set is_active = false where is_active;
  insert into public.point_rules (name, amount_per_point, redemption_wait_days, inactivity_days)
    values ('Rule ' || to_char(now(), 'YYYY-MM-DD HH24:MI'),
            p_amount_per_point, p_wait_days, p_inactivity_days)
    returning id into v_id;
  insert into public.admin_audit_logs (admin_id, action, entity_type, entity_id, description, metadata)
    values (p_admin_id, 'RULE_CHANGED', 'point_rule', v_id, 'Points rule changed',
            jsonb_build_object('amount_per_point', p_amount_per_point,
                               'wait_days', p_wait_days, 'inactivity_days', p_inactivity_days));
  return jsonb_build_object('ok', true, 'rule_id', v_id);
end $$;

-- 4.10 Everything the customer Home / Points screens need, in one call
create or replace function public.get_points_summary(
  p_customer_id uuid, p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_c        public.customers%rowtype;
  v_days     integer;
  v_redeem   integer;
  v_wait     integer;
  v_next     timestamptz;
  v_pending  integer;
  v_expired  integer;
  v_redeemed integer;
  v_deadline timestamptz;
begin
  perform 1 from public.customers where id = p_customer_id for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  perform public.apply_inactivity_if_due(p_customer_id, p_now);
  select * into v_c from public.customers where id = p_customer_id;
  select inactivity_days into v_days from public.point_rules where is_active;
  select coalesce(sum(points_remaining) filter (where redeemable_at <= p_now), 0),
         coalesce(sum(points_remaining) filter (where redeemable_at >  p_now), 0),
         min(redeemable_at) filter (where redeemable_at > p_now)
    into v_redeem, v_wait, v_next
    from public.point_lots
   where customer_id = p_customer_id and status = 'active' and points_remaining > 0;
  select coalesce(sum(points_redeemed), 0) into v_pending from public.point_redemptions
   where customer_id = p_customer_id and status = 'pending';
  select coalesce(sum(points_redeemed), 0) into v_redeemed from public.point_redemptions
   where customer_id = p_customer_id and status = 'completed';
  select coalesce(sum(points_expired), 0) into v_expired from public.point_lots
   where customer_id = p_customer_id;
  v_deadline := coalesce(v_c.last_transaction_at, v_c.created_at) + make_interval(days => v_days);
  return jsonb_build_object(
    'customer_code', v_c.customer_code, 'status', v_c.status,
    'total_points', v_redeem + v_wait,
    'redeemable_points', v_redeem, 'waiting_points', v_wait,
    'requested_points', v_pending, 'redeemed_points', v_redeemed, 'expired_points', v_expired,
    'next_unlock_at', v_next, 'activity_deadline', v_deadline,
    'days_left', case when v_c.status = 'active'
                      then greatest(0, ceil(extract(epoch from (v_deadline - p_now)) / 86400)::int)
                      else 0 end);
end $$;

-- 4.11 Daily job: expire points of every overdue customer
create or replace function public.expire_overdue_customers(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_days integer;
  v_id   uuid;
  v_n    integer := 0;
begin
  select inactivity_days into v_days from public.point_rules where is_active;
  if v_days is null then return 0; end if;
  for v_id in select id from public.customers
               where status = 'active'
                 and coalesce(last_transaction_at, created_at) + make_interval(days => v_days) < p_now
  loop
    if public.apply_inactivity_if_due(v_id, p_now) then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $$;

-- Schedule it every day at 00:05 East Africa Time (21:05 UTC) with pg_cron:
--   create extension if not exists pg_cron;
--   select cron.schedule('expire-overdue-customers', '5 21 * * *',
--                        'select public.expire_overdue_customers()');

-- ---------------------------------------------------------------------
-- 5. FUNCTION PERMISSIONS: only the backend (service_role) may call them
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant  execute on all functions in schema public to service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. FIRST ADMIN (run once, AFTER creating the admin's phone user in Supabase Auth)
-- ---------------------------------------------------------------------
-- insert into public.profiles (id, full_name, phone, role)
-- values ('<auth-user-uuid>', 'Admin Name', '+255XXXXXXXXX', 'admin');
