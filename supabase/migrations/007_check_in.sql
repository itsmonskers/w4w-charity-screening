-- =============================================================================
-- Migration 007: event-day check-in
-- Run ONCE in the Supabase SQL Editor, after 006_corporate_bundle.sql.
-- Adds only: reserve_seats, approve_booking, reject_booking and claim_received_email
-- are NOT changed.
-- - bookings.checkin_token: the secret inside each booking's check-in QR (64 random
--   hex characters). Every booking, old and new, gets one automatically.
-- - bookings.checkin_email_at: when the check-in QR email was claimed (sent once).
-- - check_in_log: every check-in and undo (which seats, which admin, when).
-- - Seats are checked in on the existing tickets rows (checked_in_at / checked_in_by),
--   which approve_booking already creates, one per seat.
-- - tickets.token is NOT used: the QR carries bookings.checkin_token (one QR per booking).
-- =============================================================================

-- 1. New booking columns (existing rows each get their own random token)
alter table public.bookings
  add column checkin_token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  add column checkin_email_at timestamptz;

comment on column public.tickets.token is
  'Not used. The check-in QR carries bookings.checkin_token (one QR per booking, migration 007).';

-- 2. Check-in log: written only by the functions below; admins can read it
create table public.check_in_log (
  id          bigint generated always as identity primary key,
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  seat_ids    text[] not null,
  action      text not null check (action in ('check_in', 'undo')),
  admin_id    uuid not null,
  created_at  timestamptz not null default now()
);
alter table public.check_in_log enable row level security;
grant select on public.check_in_log to authenticated;
create policy "admins read check-in log" on public.check_in_log
  for select to authenticated using (public.is_admin());

-- 3. Internal: one booking's check-in details (seats with time and admin name).
--    Not callable from the website; the functions below use it.
create or replace function public.checkin_details(p_booking_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'booking_id', b.id,
    'reference_code', b.reference_code,
    'full_name', b.full_name,
    'status', b.status,
    'food_allergies', b.food_allergies,
    'seat_ids', to_jsonb(b.seat_ids),
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object(
               'seat_id', t.seat_id,
               'checked_in_at', t.checked_in_at,
               'checked_in_by', case when t.checked_in_by is null then null
                 else coalesce(nullif(btrim(a.label), ''), u.email, 'another admin') end))
        from public.tickets t
        left join public.admins a on a.user_id = t.checked_in_by
        left join auth.users u on u.id = t.checked_in_by
       where t.booking_id = b.id), '[]'::jsonb))
  from public.bookings b
  where b.id = p_booking_id and public.is_admin();
$$;

-- 4. Look up a scanned QR token (null = "Not a valid ticket"), or a booking from search
create or replace function public.checkin_lookup(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception using message = 'not_admin';
  end if;
  select id into v_id from public.bookings
   where checkin_token = lower(btrim(coalesce(p_token, '')));
  if v_id is null then
    return null;
  end if;
  return public.checkin_details(v_id);
end;
$$;

create or replace function public.checkin_booking(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception using message = 'not_admin';
  end if;
  return public.checkin_details(p_booking_id);
end;
$$;

-- 5. Check in seats: one step, only seats not yet checked in, so two phones at once
--    can't both check in the same seat. Errors: not_admin, booking_not_found,
--    booking_not_confirmed, invalid_seats. Returns the seats this call checked in
--    ("changed") plus the booking's details (seats checked in earlier show when and by whom).
create or replace function public.check_in_seats(p_booking_id uuid, p_seat_ids text[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_done    text[];
begin
  if not public.is_admin() then
    raise exception using message = 'not_admin';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception using message = 'booking_not_found';
  end if;
  if v_booking.status <> 'approved' then
    raise exception using message = 'booking_not_confirmed';
  end if;
  if coalesce(cardinality(p_seat_ids), 0) = 0 or not (p_seat_ids <@ v_booking.seat_ids) then
    raise exception using message = 'invalid_seats';
  end if;

  with done as (
    update public.tickets
       set checked_in_at = now(), checked_in_by = auth.uid()
     where booking_id = v_booking.id
       and seat_id = any (p_seat_ids)
       and checked_in_at is null
    returning seat_id
  )
  select coalesce(array_agg(seat_id), '{}') into v_done from done;

  if cardinality(v_done) > 0 then
    insert into public.check_in_log (booking_id, seat_ids, action, admin_id)
    values (v_booking.id, v_done, 'check_in', auth.uid());
  end if;

  return jsonb_build_object('changed', to_jsonb(v_done), 'booking', public.checkin_details(v_booking.id));
end;
$$;

-- 6. Undo a check-in made by mistake (same checks; only seats that are checked in)
create or replace function public.undo_check_in(p_booking_id uuid, p_seat_ids text[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_done    text[];
begin
  if not public.is_admin() then
    raise exception using message = 'not_admin';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception using message = 'booking_not_found';
  end if;
  if coalesce(cardinality(p_seat_ids), 0) = 0 or not (p_seat_ids <@ v_booking.seat_ids) then
    raise exception using message = 'invalid_seats';
  end if;

  with done as (
    update public.tickets
       set checked_in_at = null, checked_in_by = null
     where booking_id = v_booking.id
       and seat_id = any (p_seat_ids)
       and checked_in_at is not null
    returning seat_id
  )
  select coalesce(array_agg(seat_id), '{}') into v_done from done;

  if cardinality(v_done) > 0 then
    insert into public.check_in_log (booking_id, seat_ids, action, admin_id)
    values (v_booking.id, v_done, 'undo', auth.uid());
  end if;

  return jsonb_build_object('changed', to_jsonb(v_done), 'booking', public.checkin_details(v_booking.id));
end;
$$;

-- 7. Check-in QR email, sent once per booking (same idea as claim_received_email).
--    claim: one UPDATE marks it and returns true only if the booking is confirmed and
--    not yet sent. release: removes the mark when the email failed, so it can be retried.
create or replace function public.claim_checkin_email(p_booking_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  with claimed as (
    update public.bookings
       set checkin_email_at = now()
     where id = p_booking_id
       and status = 'approved'
       and checkin_email_at is null
       and public.is_admin()
    returning 1
  )
  select exists (select 1 from claimed);
$$;

create or replace function public.release_checkin_email(p_booking_id uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.bookings
     set checkin_email_at = null
   where id = p_booking_id and public.is_admin();
$$;

-- 8. Permissions. Supabase lets anon and authenticated run new functions by default
--    (checked in the live database), so revoke anon explicitly. The helper is for nobody;
--    the rest are for signed-in users, and each one checks is_admin itself.
revoke all on function public.checkin_details(uuid) from public, anon, authenticated;
revoke all on function public.checkin_lookup(text) from public, anon;
revoke all on function public.checkin_booking(uuid) from public, anon;
revoke all on function public.check_in_seats(uuid, text[]) from public, anon;
revoke all on function public.undo_check_in(uuid, text[]) from public, anon;
revoke all on function public.claim_checkin_email(uuid) from public, anon;
revoke all on function public.release_checkin_email(uuid) from public, anon;

grant execute on function public.checkin_lookup(text) to authenticated;
grant execute on function public.checkin_booking(uuid) to authenticated;
grant execute on function public.check_in_seats(uuid, text[]) to authenticated;
grant execute on function public.undo_check_in(uuid, text[]) to authenticated;
grant execute on function public.claim_checkin_email(uuid) to authenticated;
grant execute on function public.release_checkin_email(uuid) to authenticated;

-- check: every booking has a token, no QR emails sent yet, the 7 new functions exist,
-- and anon can't run any of them
select count(*) as bookings,
       count(*) filter (where checkin_token is not null) as with_token,
       count(*) filter (where checkin_email_at is not null) as qr_emails_sent
from public.bookings;
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_run,
       has_function_privilege('authenticated', p.oid, 'execute') as signed_in_can_run
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('checkin_details', 'checkin_lookup', 'checkin_booking', 'check_in_seats',
                    'undo_check_in', 'claim_checkin_email', 'release_checkin_email')
order by 1;
