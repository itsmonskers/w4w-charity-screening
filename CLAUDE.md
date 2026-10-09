# CLAUDE.md — W4W Doomsday Charity Screening microsite

Read `DESIGN.md` before any UI change. Section 0 (project overrides) wins over
the rest of that file; the rest is the Waves for Water Philippines design
standard.

## Project
- Next.js App Router + Tailwind v4, TypeScript. Hosted on Netlify (not Vercel).
- Data: all seat/booking data goes through `lib/booking-store.ts`. With the
  Supabase env vars set it uses Supabase; without them it falls back to the
  in-memory mock (`IS_MOCK = true`). Admin data (login, bookings review,
  approve/reject, screenshots, CSV) goes through `lib/admin-store.ts`.
  No other UI file may contain data logic.
- Database: Supabase project `w4w-doomsday-screening`. The schema lives in
  `supabase/schema.sql` (tables seats, event_settings, bookings, tickets,
  admins; functions reserve_seats, approve_booking, reject_booking,
  is_admin). Never change the database from code; schema changes are made
  by Simon in the SQL Editor.
- Never use or ask for the Supabase service_role / secret key in this app.
  Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Protected files — do not change unless the task explicitly says so
- `lib/seat-layout.ts` (exact Cinema 7 layout, verified against the PDF)
- `lib/booking-store.ts`, `lib/event-config.ts`
- `components/stripe-wave.tsx`

## Rules
- Tokens only. No hex outside the `:root` token block in `app/globals.css`,
  except `#fff` and `#d64545`. No Tailwind arbitrary hex.
- Never invent facts. Keep every `[... TBD]` placeholder visible and
  `PRICE_PER_SEAT = null` until real values are supplied.
- This microsite uses the **event theme** in DESIGN.md Section 0 (dark green,
  gold, Cinzel + Hanken Grotesk). Use only the base tokens and the `--ev-*`
  tokens defined there. No other new colors, fonts, divider styles or
  animation libraries. If a task seems to need one, stop and ask.
- Never use Marvel assets: no posters, characters, logos or poster-style
  lettering. All atmosphere (light shafts, particles) is original code.
- All motion must be covered by the single reduced-motion rule at the end of
  `app/globals.css`.
- Keep CSS readable: one rule per block, no duplicate selectors. Edit existing
  rules instead of appending overrides at the end of the file.

## How to work
- Make the smallest change that does the task. Don't refactor unrelated code.
- After every task, run `pnpm build` (or `npm run build`) and fix all errors
  before reporting.
- In your report: list every file changed, confirm protected files are
  untouched, and say what you could not verify (e.g. visual checks).
- Visual checks: the seat map must always render as a grid of seat boxes —
  three blocks with aisles in rows A–P and one continuous block in row Q,
  315 seats total.
