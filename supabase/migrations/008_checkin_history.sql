-- =============================================================================
-- Migration 008: check-in history (read-only)
-- Run ONCE in the Supabase SQL Editor, after 007_check_in.sql.
-- Adds only: checkin_history(). No existing table or function is changed.
-- - Returns every check_in_log row, newest first: when, check_in or undo, the
--   booking (id, reference, guest name), the seats that action changed, and the
--   admin's name (admins.label, or their login email when the label is empty).
-- - No food allergies, phone numbers or guest emails.
-- - Signed-in admins only: anon can't run it, and it refuses anyone who isn't an
--   admin (not_admin), like the check-in functions in 007.
-- =============================================================================

create or replace function public.checkin_history()
returns table (
  id              bigint,
  created_at      timestamptz,
  action          text,
  booking_id      uuid,
  reference_code  text,
  full_name       text,
  seat_ids        text[],
  admin_name      text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception using message = 'not_admin';
  end if;
  return query
    select l.id, l.created_at, l.action, l.booking_id, b.reference_code, b.full_name, l.seat_ids,
           coalesce(nullif(btrim(a.label), ''), u.email::text, 'another admin')
      from public.check_in_log l
      join public.bookings b on b.id = l.booking_id
      left join public.admins a on a.user_id = l.admin_id
      left join auth.users u on u.id = l.admin_id
     order by l.created_at desc, l.id desc;
end;
$$;

-- Permissions: Supabase lets anon and authenticated run new functions by default
-- (see 007), so revoke anon explicitly. Signed-in users only; the admin check is inside.
revoke all on function public.checkin_history() from public, anon;
grant execute on function public.checkin_history() to authenticated;

-- check: the function exists, and anon can't run it
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_run,
       has_function_privilege('authenticated', p.oid, 'execute') as signed_in_can_run
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'checkin_history';
