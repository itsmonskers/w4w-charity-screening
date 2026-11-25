-- =============================================================================
-- Migration 006: Corporate Bundle (a lower price per seat for exactly N seats)
-- Run ONCE in the Supabase SQL Editor, after 005_food_allergies.sql.
-- Run it BEFORE deploying the matching site code: the new site reads the two
-- new columns, so until this is run it can't load the event settings and the
-- Reserve button stays off. The site that is live now keeps working after
-- this is run (it doesn't read the new columns).
-- - event_settings gets group_size and group_price_per_seat. Both start EMPTY,
--   so the bundle is OFF and nothing changes until they are filled in (see the
--   switch-on lines at the bottom; this migration does not run them).
--   Both empty, or both filled: group_size between 2 and max_seats, and
--   group_price_per_seat above 0 and below price_per_seat.
-- - reserve_seats: a booking of exactly group_size seats is charged
--   group_price_per_seat for each seat. bookings.price_per_seat stores the
--   price actually charged per seat, so the emails show e.g.
--   "₱9,500 (10 × ₱950)". Every other count is charged price_per_seat as
--   before. Same 10 inputs as 005, so it is replaced in place (no drop) and
--   its grants stay; they are restated below anyway.
-- =============================================================================

begin;

alter table public.event_settings
  add column group_size int,
  add column group_price_per_seat numeric(10,2),
  add constraint event_settings_group_bundle check (
    (group_size is null and group_price_per_seat is null)
    or (group_size between 2 and max_seats
        and price_per_seat is not null
        and group_price_per_seat > 0
        and group_price_per_seat < price_per_seat));

create or replace function public.reserve_seats(
  p_seat_ids        text[],
  p_full_name       text,
  p_contact         text,
  p_email           text,
  p_organization    text,
  p_notes           text,
  p_screenshot_path text,
  p_payment_ref     text,
  p_payer_name      text,
  p_food_allergies  text default null
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
  v_price      numeric;
  v_amount     numeric;
  v_ref        text;
  v_allergies  text;
  i            int;
begin
  select * into v_settings from public.event_settings where id = 1;
  if not v_settings.bookings_open then
    raise exception using message = 'bookings_closed';
  end if;

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

  -- food allergies: spaces, tabs and line breaks trimmed; empty means none (null)
  v_allergies := nullif(btrim(coalesce(p_food_allergies, ''), E' \t\r\n'), '');

  if length(p_full_name) > 120 or length(p_contact) > 120 or length(p_email) > 200
     or length(coalesce(p_organization, '')) > 200 or length(coalesce(p_notes, '')) > 1000
     or length(coalesce(p_payer_name, '')) > 120
     or char_length(coalesce(v_allergies, '')) > 200 then
    raise exception using message = 'missing_details', detail = 'too_long';
  end if;

  -- payment reference: letters, digits and dashes; spaces removed; 6–40 chars
  v_ref := upper(regexp_replace(coalesce(p_payment_ref, ''), '\s', '', 'g'));
  if v_ref !~ '^[A-Z0-9-]{6,40}$' then
    raise exception using message = 'invalid_payment_ref';
  end if;
  if exists (select 1 from public.bookings b where b.payment_ref = v_ref) then
    raise exception using message = 'payment_ref_used';
  end if;

  if p_screenshot_path is null
     or p_screenshot_path not like 'pending/%'
     or not exists (
       select 1 from storage.objects
       where bucket_id = 'payment-screenshots' and name = p_screenshot_path)
     or exists (
       select 1 from public.bookings where screenshot_path = p_screenshot_path) then
    raise exception using message = 'missing_screenshot';
  end if;

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

  loop
    v_code := 'W4W-DD-';
    for i in 1..4 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.bookings b where b.reference_code = v_code);
  end loop;

  -- Corporate Bundle: exactly group_size seats are charged group_price_per_seat each
  v_price := case when v_settings.group_size is not null
                       and v_settings.group_price_per_seat is not null
                       and cardinality(v_seats) = v_settings.group_size
                  then v_settings.group_price_per_seat
                  else v_settings.price_per_seat end;
  v_amount := case when v_price is null then null
                   else v_price * cardinality(v_seats) end;

  begin
    insert into public.bookings (
      reference_code, full_name, contact, email, organization, notes,
      seat_ids, seat_count, price_per_seat, amount, screenshot_path,
      payment_ref, payer_name, food_allergies)
    values (
      v_code, btrim(p_full_name), btrim(p_contact), lower(btrim(p_email)),
      nullif(btrim(p_organization), ''), nullif(btrim(p_notes), ''),
      v_seats, cardinality(v_seats), v_price, v_amount,
      p_screenshot_path, v_ref, nullif(btrim(p_payer_name), ''), v_allergies)
    returning id into v_booking_id;
  exception when unique_violation then
    -- two people submitted the same reference at the same moment
    raise exception using message = 'payment_ref_used';
  end;

  update public.seats
     set status = 'reserved', updated_at = now()
   where id = any (v_seats);

  return query select v_code, v_seats, v_amount;
end;
$$;

revoke all on function public.reserve_seats(text[], text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.reserve_seats(text[], text, text, text, text, text, text, text, text, text) to anon, authenticated;

commit;

-- check: should list group_size, group_price_per_seat (both empty) and
-- reserve_seats with 10 inputs
select 'group_size: ' || coalesce(group_size::text, 'empty')
       || ' · group_price_per_seat: ' || coalesce(group_price_per_seat::text, 'empty') as result
from public.event_settings where id = 1
union all
select 'reserve_seats inputs: ' || pronargs from pg_proc
where proname = 'reserve_seats' and pronamespace = 'public'::regnamespace;

-- -----------------------------------------------------------------------------
-- Switch the Corporate Bundle ON (NOT run by this migration; run it by hand
-- only when approved): 10 seats for ₱950 each = ₱9,500.
--   update public.event_settings
--      set group_size = 10, group_price_per_seat = 950, updated_at = now()
--    where id = 1;
-- Switch it OFF again:
--   update public.event_settings
--      set group_size = null, group_price_per_seat = null, updated_at = now()
--    where id = 1;
-- -----------------------------------------------------------------------------
