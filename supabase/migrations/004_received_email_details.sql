-- =============================================================================
-- Migration 004: full booking details in the "booking received" email
-- Run ONCE in the Supabase SQL Editor, after 003_booking_emails.sql.
-- - claim_received_email now also returns everything the guest entered
--   (contact, organization, notes, payer name, payment reference), plus the
--   seat count and the price per seat at booking time, so the email can show
--   the same details as /admin. review_note is NOT returned.
-- - Same rules as 003: reference code AND payment reference must match a
--   pending booking whose email hasn't been claimed yet; claimed once.
-- The return columns change, so the function is dropped and recreated
-- (in one transaction, so it's never missing while the site is live).
-- =============================================================================

begin;

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
  payer_name     text
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
            b.payment_ref, b.payer_name;
$$;

revoke all on function public.claim_received_email(text, text) from public;
grant execute on function public.claim_received_email(text, text) to anon, authenticated;

commit;

-- check: should list the 11 return columns of claim_received_email
select p.name as returns
from pg_proc f
cross join lateral unnest(f.proargnames, f.proargmodes::text[]) as p(name, mode)
where f.proname = 'claim_received_email'
  and f.pronamespace = 'public'::regnamespace
  and p.mode = 't';
