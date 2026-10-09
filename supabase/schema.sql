-- =============================================================================
-- W4W Doomsday Charity Screening: database setup
-- Run ONCE in the Supabase SQL Editor of the w4w-doomsday-screening project.
-- Creates: seats (315), event settings, bookings, tickets, admins,
-- the booking/approval functions, security rules, screenshot storage and
-- live seat updates.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- Every seat in Cinema 7. Public can read; only the functions below change it.
create table public.seats (
  id           text primary key,                 -- e.g. 'A-22'
  row_label    text not null,
  seat_number  int  not null,
  status       text not null default 'available'
               check (status in ('available', 'reserved', 'taken')),
  updated_at   timestamptz not null default now(),
  unique (row_label, seat_number)
);

-- One row of event settings. Change these in the Table Editor, no redeploy.
create table public.event_settings (
  id              int primary key default 1 check (id = 1),
  price_per_seat  numeric(10,2) check (price_per_seat is null or price_per_seat > 0),
  max_seats       int not null default 10 check (max_seats between 1 and 50),
  bookings_open   boolean not null default true,
  updated_at      timestamptz not null default now()
);
insert into public.event_settings (id) values (1);

-- Bookings. Never readable by the public; admins only.
create table public.bookings (
  id               uuid primary key default gen_random_uuid(),
  reference_code   text not null unique,
  full_name        text not null,
  contact          text not null,
  email            text not null,
  organization     text,
  notes            text,
  seat_ids         text[] not null,
  seat_count       int not null,
  price_per_seat   numeric(10,2),        -- price at the moment of booking
  amount           numeric(10,2),        -- null while the price is not set
  screenshot_path  text not null unique, -- path in the payment-screenshots bucket
  status           text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected')),
  review_note      text,
  reviewed_by      uuid,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index bookings_status_idx on public.bookings (status, created_at);

-- One ticket per seat, created when a booking is approved.
-- The token goes into the e-ticket QR; check-in marks checked_in_at.
create table public.tickets (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references public.bookings (id) on delete cascade,
  seat_id        text not null references public.seats (id),
  token          text not null unique default replace(gen_random_uuid()::text, '-', ''),
  checked_in_at  timestamptz,
  checked_in_by  uuid,
  created_at     timestamptz not null default now()
);
-- A seat can only ever have one live ticket.
create unique index tickets_one_per_seat on public.tickets (seat_id);

-- Who counts as an admin (payment verifiers, door staff).
create table public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  label       text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Seed the 315 seats (must match lib/seat-layout.ts)
--    A–F: 22 seats, G–N: 15 seats, O–Q: 21 seats
-- ---------------------------------------------------------------------------
insert into public.seats (id, row_label, seat_number)
select r || '-' || n, r, n
from (
  select unnest(array['A','B','C','D','E','F']) as r, 22 as seats
  union all
  select unnest(array['G','H','I','J','K','L','M','N']), 15
  union all
  select unnest(array['O','P','Q']), 21
) rows_def
cross join lateral generate_series(1, rows_def.seats) as n;

-- ---------------------------------------------------------------------------
-- 3. Helper: is the current logged-in user an admin?
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- 4. reserve_seats: the public booking action (all-or-nothing)
--    Errors the website should handle (error.message):
--      bookings_closed, invalid_seat_count, invalid_seats, missing_details,
--      invalid_email, missing_screenshot, seats_unavailable
--    For seats_unavailable, error.details lists the taken seat ids, comma-separated.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_seats(
  p_seat_ids        text[],
  p_full_name       text,
  p_contact         text,
  p_email           text,
  p_organization    text,
  p_notes           text,
  p_screenshot_path text
)
returns table (reference_code text, seat_ids text[], amount numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings   public.event_settings;
  v_seats      text[];
  v_found      int;
  v_unavail    text[];
  v_code       text;
  v_alphabet   constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_booking_id uuid;
  v_amount     numeric;
  i            int;
begin
  select * into v_settings from public.event_settings where id = 1;
  if not v_settings.bookings_open then
    raise exception using message = 'bookings_closed';
  end if;

  -- de-duplicate and sort the requested seats
  select coalesce(array_agg(distinct s order by s), '{}')
    into v_seats
    from unnest(p_seat_ids) as s;

  if cardinality(v_seats) < 1 or cardinality(v_seats) > v_settings.max_seats then
    raise exception using message = 'invalid_seat_count';
  end if;

  if coalesce(btrim(p_full_name), '') = ''
     or coalesce(btrim(p_contact), '') = ''
     or coalesce(btrim(p_email), '') = '' then
    raise exception using message = 'missing_details';
  end if;

  if btrim(p_email) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception using message = 'invalid_email';
  end if;

  if length(p_full_name) > 120 or length(p_contact) > 120 or length(p_email) > 200
     or length(coalesce(p_organization, '')) > 200 or length(coalesce(p_notes, '')) > 1000 then
    raise exception using message = 'missing_details', detail = 'too_long';
  end if;

  -- the screenshot must really have been uploaded, to the pending/ folder,
  -- and not already used by another booking
  if p_screenshot_path is null
     or p_screenshot_path not like 'pending/%'
     or not exists (
       select 1 from storage.objects
       where bucket_id = 'payment-screenshots' and name = p_screenshot_path)
     or exists (
       select 1 from public.bookings where screenshot_path = p_screenshot_path) then
    raise exception using message = 'missing_screenshot';
  end if;

  -- lock the requested seats so two people can't book them at the same time
  perform 1 from public.seats where id = any (v_seats) for update;

  select count(*) into v_found from public.seats where id = any (v_seats);
  if v_found <> cardinality(v_seats) then
    raise exception using message = 'invalid_seats';
  end if;

  select coalesce(array_agg(id order by id), '{}') into v_unavail
    from public.seats
   where id = any (v_seats) and status <> 'available';
  if cardinality(v_unavail) > 0 then
    raise exception using message = 'seats_unavailable',
                          detail  = array_to_string(v_unavail, ',');
  end if;

  -- unique reference code like W4W-DD-7K2Q
  loop
    v_code := 'W4W-DD-';
    for i in 1..4 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.bookings b where b.reference_code = v_code);
  end loop;

  v_amount := case when v_settings.price_per_seat is null then null
                   else v_settings.price_per_seat * cardinality(v_seats) end;

  insert into public.bookings (
    reference_code, full_name, contact, email, organization, notes,
    seat_ids, seat_count, price_per_seat, amount, screenshot_path)
  values (
    v_code, btrim(p_full_name), btrim(p_contact), lower(btrim(p_email)),
    nullif(btrim(p_organization), ''), nullif(btrim(p_notes), ''),
    v_seats, cardinality(v_seats), v_settings.price_per_seat, v_amount,
    p_screenshot_path)
  returning id into v_booking_id;

  update public.seats
     set status = 'reserved', updated_at = now()
   where id = any (v_seats);

  return query select v_code, v_seats, v_amount;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Admin actions: approve (seats -> taken, tickets created) or reject
--    (seats -> available again). Both only work on pending bookings.
-- ---------------------------------------------------------------------------
create or replace function public.approve_booking(p_booking_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  if not public.is_admin() then
    raise exception using message = 'not_admin';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception using message = 'booking_not_found';
  end if;
  if v_booking.status <> 'pending' then
    raise exception using message = 'booking_not_pending';
  end if;

  update public.seats
     set status = 'taken', updated_at = now()
   where id = any (v_booking.seat_ids);

  insert into public.tickets (booking_id, seat_id)
  select v_booking.id, s from unnest(v_booking.seat_ids) as s;

  update public.bookings
     set status = 'approved', review_note = p_note,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = v_booking.id;
end;
$$;

create or replace function public.reject_booking(p_booking_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  if not public.is_admin() then
    raise exception using message = 'not_admin';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception using message = 'booking_not_found';
  end if;
  if v_booking.status <> 'pending' then
    raise exception using message = 'booking_not_pending';
  end if;

  update public.seats
     set status = 'available', updated_at = now()
   where id = any (v_booking.seat_ids) and status = 'reserved';

  update public.bookings
     set status = 'rejected', review_note = p_note,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = v_booking.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Security: Row Level Security + explicit permissions
--    (the project was created with "automatically expose new tables" OFF,
--     so nothing is reachable unless granted here)
-- ---------------------------------------------------------------------------
alter table public.seats          enable row level security;
alter table public.event_settings enable row level security;
alter table public.bookings       enable row level security;
alter table public.tickets        enable row level security;
alter table public.admins         enable row level security;

-- public read-only: seats and event settings
grant select on public.seats, public.event_settings to anon, authenticated;
create policy "seats are public"    on public.seats          for select using (true);
create policy "settings are public" on public.event_settings for select using (true);

-- admins only: bookings and tickets (read). Changes go through the functions.
grant select on public.bookings, public.tickets to authenticated;
create policy "admins read bookings" on public.bookings for select to authenticated using (public.is_admin());
create policy "admins read tickets"  on public.tickets  for select to authenticated using (public.is_admin());

-- functions: Postgres lets everyone run new functions by default; lock that down
revoke all on function public.reserve_seats(text[], text, text, text, text, text, text) from public;
revoke all on function public.approve_booking(uuid, text) from public;
revoke all on function public.reject_booking(uuid, text) from public;
revoke all on function public.is_admin() from public;

grant execute on function public.reserve_seats(text[], text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.approve_booking(uuid, text) to authenticated;
grant execute on function public.reject_booking(uuid, text)  to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Screenshot storage: private bucket, images only, 10 MB max
--    Visitors may only upload into pending/; only admins can view.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-screenshots', 'payment-screenshots', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
);

create policy "visitors upload payment screenshots"
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'payment-screenshots'
    and (storage.foldername(name))[1] = 'pending'
  );

create policy "admins view payment screenshots"
  on storage.objects for select to authenticated
  using (bucket_id = 'payment-screenshots' and public.is_admin());

-- ---------------------------------------------------------------------------
-- 8. Live seat updates for every visitor
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.seats;

-- ---------------------------------------------------------------------------
-- 9. Check: should show 315 total, 132 / 120 / 63 per section
-- ---------------------------------------------------------------------------
select
  count(*)                                                    as total_seats,
  count(*) filter (where row_label in ('A','B','C','D','E','F'))          as rows_a_to_f,
  count(*) filter (where row_label in ('G','H','I','J','K','L','M','N'))  as rows_g_to_n,
  count(*) filter (where row_label in ('O','P','Q'))                      as rows_o_to_q
from public.seats;
