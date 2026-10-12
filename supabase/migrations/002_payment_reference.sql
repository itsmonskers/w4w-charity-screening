-- =============================================================================
-- Migration 002: payment reference number + name on paying account
-- Run ONCE in the Supabase SQL Editor, after w4w-screening-schema.sql.
-- - bookings gets payment_ref (required for new bookings) and payer_name
-- - the same payment reference can't be used for two bookings
-- - reserve_seats gets two new inputs: p_payment_ref, p_payer_name
-- New error messages from reserve_seats:
--   invalid_payment_ref  (missing, too short/long, or odd characters)
--   payment_ref_used     (another booking already used this reference)
-- =============================================================================

alter table public.bookings
  add column payment_ref text,
  add column payer_name  text;

-- References are stored normalized (uppercase, no spaces), so
-- "1234 567 890 123" and "1234567890123" count as the same payment.
create unique index bookings_payment_ref_unique
  on public.bookings (payment_ref)
  where payment_ref is not null;

-- The old version has 7 inputs; replace it with the 9-input version.
drop function if exists public.reserve_seats(text[], text, text, text, text, text, text);

create or replace function public.reserve_seats(
  p_seat_ids        text[],
  p_full_name       text,
  p_contact         text,
  p_email           text,
  p_organization    text,
  p_notes           text,
  p_screenshot_path text,
  p_payment_ref     text,
  p_payer_name      text
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

  if length(p_full_name) > 120 or length(p_contact) > 120 or length(p_email) > 200
     or length(coalesce(p_organization, '')) > 200 or length(coalesce(p_notes, '')) > 1000
     or length(coalesce(p_payer_name, '')) > 120 then
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
      payment_ref, payer_name)
    values (
      v_code, btrim(p_full_name), btrim(p_contact), lower(btrim(p_email)),
      nullif(btrim(p_organization), ''), nullif(btrim(p_notes), ''),
      v_seats, cardinality(v_seats), v_settings.price_per_seat, v_amount,
      p_screenshot_path, v_ref, nullif(btrim(p_payer_name), ''))
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

revoke all on function public.reserve_seats(text[], text, text, text, text, text, text, text, text) from public;
grant execute on function public.reserve_seats(text[], text, text, text, text, text, text, text, text) to anon, authenticated;

-- check: should list payment_ref and payer_name
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'bookings'
  and column_name in ('payment_ref', 'payer_name');
