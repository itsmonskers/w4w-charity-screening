-- =============================================================================
-- Migration 005: optional food allergies, one per booking
-- Run ONCE in the Supabase SQL Editor, after 004_received_email_details.sql.
-- Run it BEFORE deploying the matching site code: p_food_allergies has a
-- default, so the site that is live now keeps working in between. The other
-- way round, every booking fails until this is run.
-- - bookings gets food_allergies (null when the guest left it empty), max 200
--   characters. Trimmed of spaces, tabs and line breaks before saving.
-- - reserve_seats gets a 10th input, p_food_allergies (last, default null).
--   Too long -> missing_details with detail too_long, like the other fields.
-- - claim_received_email also returns food_allergies, so the "booking
--   received" email can show it. The approved / rejected emails don't.
-- Both functions are dropped and recreated (in one transaction, so they're
-- never missing while the site is live).
-- =============================================================================

begin;

alter table public.bookings
  add column food_allergies text,
  add constraint bookings_food_allergies_length
    check (food_allergies is null or char_length(food_allergies) between 1 and 200);

-- The old version has 9 inputs; replace it with the 10-input version.
drop function if exists public.reserve_seats(text[], text, text, text, text, text, text, text, text);

create function public.reserve_seats(
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

  v_amount := case when v_settings.price_per_seat is null then null
                   else v_settings.price_per_seat * cardinality(v_seats) end;

  begin
    insert into public.bookings (
      reference_code, full_name, contact, email, organization, notes,
      seat_ids, seat_count, price_per_seat, amount, screenshot_path,
      payment_ref, payer_name, food_allergies)
    values (
      v_code, btrim(p_full_name), btrim(p_contact), lower(btrim(p_email)),
      nullif(btrim(p_organization), ''), nullif(btrim(p_notes), ''),
      v_seats, cardinality(v_seats), v_settings.price_per_seat, v_amount,
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

drop function if exists public.claim_received_email(text, text);

create function public.claim_received_email(
  p_reference_code text,
  p_payment_ref    text
)
returns table (
  full_name      text,
  contact        text,
  email          text,
  organization   text,
  notes          text,
  seat_ids       text[],
  seat_count     int,
  price_per_seat numeric,
  amount         numeric,
  payment_ref    text,
  payer_name     text,
  food_allergies text
)
language sql
volatile
security definer
set search_path = public
as $$
  -- one UPDATE, so two calls at the same moment can't both claim it
  update public.bookings b
     set received_email_at = now()
   where b.reference_code = upper(btrim(coalesce(p_reference_code, '')))
     -- same normalizing as reserve_seats: uppercase, no spaces
     and b.payment_ref = upper(regexp_replace(coalesce(p_payment_ref, ''), '\s', '', 'g'))
     and b.status = 'pending'
     and b.received_email_at is null
  returning b.full_name, b.contact, b.email, b.organization, b.notes,
            b.seat_ids, b.seat_count, b.price_per_seat, b.amount,
            b.payment_ref, b.payer_name, b.food_allergies;
$$;

revoke all on function public.claim_received_email(text, text) from public;
grant execute on function public.claim_received_email(text, text) to anon, authenticated;

commit;

-- check: should list food_allergies, reserve_seats with 10 inputs and
-- claim_received_email with 12 return columns
select column_name::text as result from information_schema.columns
where table_schema = 'public' and table_name = 'bookings' and column_name = 'food_allergies'
union all
select 'reserve_seats inputs: ' || pronargs from pg_proc
where proname = 'reserve_seats' and pronamespace = 'public'::regnamespace
union all
select 'claim_received_email returns: ' || count(*)
from pg_proc f
cross join lateral unnest(f.proargmodes::text[]) as m(mode)
where f.proname = 'claim_received_email'
  and f.pronamespace = 'public'::regnamespace
  and m.mode = 't';
