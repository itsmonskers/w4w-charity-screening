-- =============================================================================
-- Migration 003: "booking received" email, sent once per booking
-- Run ONCE in the Supabase SQL Editor, after 002_payment_reference.sql.
-- - bookings gets received_email_at (when the "booking received" email was claimed)
-- - claim_received_email: the website's email route calls this right after a
--   successful booking to get the guest's name, email and seats. It only
--   answers when the reference code AND the payment reference both match a
--   pending booking whose email hasn't been claimed yet, and it marks the
--   booking as claimed in the same step. So it can't be used to look up
--   someone else's booking, or to send the same guest the email twice.
-- Returns no rows (not an error) when nothing matches.
-- =============================================================================

alter table public.bookings
  add column if not exists received_email_at timestamptz;

create or replace function public.claim_received_email(
  p_reference_code text,
  p_payment_ref    text
)
returns table (full_name text, email text, seat_ids text[], amount numeric)
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
  returning b.full_name, b.email, b.seat_ids, b.amount;
$$;

revoke all on function public.claim_received_email(text, text) from public;
grant execute on function public.claim_received_email(text, text) to anon, authenticated;

-- check: should list received_email_at and claim_received_email
select column_name as created from information_schema.columns
where table_schema = 'public' and table_name = 'bookings'
  and column_name = 'received_email_at'
union all
select routine_name from information_schema.routines
where routine_schema = 'public' and routine_name = 'claim_received_email';
