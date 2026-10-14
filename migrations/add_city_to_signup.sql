-- Migration: Add city parameter to create_customer_profile function
-- This updates the registration function to accept and store the city field

CREATE OR REPLACE FUNCTION public.create_customer_profile(
  p_user_id uuid, p_full_name text, p_phone text, p_city text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_name     text := trim(regexp_replace(coalesce(p_full_name,''), '\s+', ' ', 'g'));
  v_city     text := trim(coalesce(p_city, ''));
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
  insert into public.customers (profile_id, customer_code, initials, sequence_number, city)
    values (p_user_id, v_initials || lpad(v_seq::text, 2, '0'), v_initials, v_seq, nullif(v_city, ''))
    returning * into v_c;
  insert into public.customer_status_events (customer_id, previous_status, new_status, reason)
    values (v_c.id, null, 'active', 'Registered');
  return jsonb_build_object('ok', true, 'created', true,
                            'customer_id', v_c.id, 'customer_code', v_c.customer_code);
end $$;
