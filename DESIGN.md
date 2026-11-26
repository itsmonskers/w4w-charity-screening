# Waves for Water Philippines — Design System

> Project copy: Doomsday Charity Screening seat reservation microsite.

A reusable design standard for W4W web projects: microsites, apps, landing pages
and tools. It's anchored to the **Pilipinas4Water** site, the approved reference
for W4W brand direction (signed off by Carlo Delantar).

**How to use it in a new project**

1. Copy this file into the project root and rename it `DESIGN.md`.
2. Fill in **Section 0 (Project overrides)** for this project. Delete any
   placeholder lines you don't need.
3. Add the starter CSS (Section 12) to your global stylesheet and load the fonts.
4. Tell your AI tools to read it. Claude Code: reference it in `CLAUDE.md`.
   v0: attach it to your first prompt. See the kickoff prompt in Section 13.

**Precedence:** Section 0 wins over everything below it. Everything else is the
shared W4W standard and applies unless Section 0 says otherwise.

Last updated: 2026-11-26. Sources: Pilipinas4Water design standard, FlappyBoard
microsite.

---

## 0. Project overrides (fill in per project)

- **Project:** Movies4Water - Avengers: Doomsday Block Screening — Seat
  Reservation Microsite
- **Purpose:** Get visitors to pick seats for the December 19, 2026 block
  screening, pay via QR, and submit their payment screenshot to reserve.
- **Owner / sign-off:** Simon Tuazon / Carlo Delantar, Patrick Manuel
- **Layout goal:** booking with as little scrolling as possible. On desktop
  the seat map and the booking panel are visible side by side; on mobile
  the flow is map → sticky bar → booking sheet.
- **Reference:** the JCI Marikina Sapatos booking page. Approved by Patrick
  Manuel (Country Director): match its look and feel closely, "with our
  twist". Do NOT copy JCI's logo, wording ("Doomsday is coming…"), diamond
  pattern or exact layout details pixel for pixel; it must read as a W4W
  page, not a JCI clone.
- **No Marvel assets, ever:** no posters or poster crops, no Doctor Doom or
  any character, no recreated stained-glass windows from the poster, no
  Marvel/Avengers logos, no "12.18.26 IS DOOMSDAY" style lettering. The film
  title is plain text. All atmosphere is original, built in code.

### Event theme (overrides base colors and fonts for this microsite only)

This microsite uses a dark cinematic theme in W4W blue on W4W charcoal, with
gold for seat selection (option C, approved 2026-10-13: changed from the
earlier dark green so the page doesn't look like the JCI site; Cinzel is
kept). The event tokens point at base tokens wherever possible. The base W4W
system (Sections 1–14) stays the standard for every other W4W project.
Define these extra tokens on `:root` next to the base tokens:

| Token | Value | Use |
|---|---|---|
| `--ev-bg` | `var(--char)` | Page and header background |
| `--ev-panel` | `var(--char-2)` | Seat map and booking panels |
| `--ev-input` | `var(--char)` | Input fields |
| `--ev-accent` | `var(--blue-light)` | Accent: glows, available seats, screen arc, LIVE, seat counts |
| `--ev-accent-deep` | `color-mix(in srgb, var(--blue) 25%, var(--char-2))` | Available seat fill |
| `--ev-gold` | `#d9a441` | Eyebrows, panel titles, corner brackets, row letters, selected and reserved seats |
| `--ev-text` | `#fff` | Headings and strong text |
| `--ev-muted` | `var(--muted-dark)` | Body text, labels, placeholders |
| `--ev-line` | `color-mix(in srgb, var(--blue-light) 28%, transparent)` | Borders and dividers |

Token mapping: wherever deviations 1–15 below name a base token, use the
event token instead: `--char` → `--ev-bg`, `--char-2` → `--ev-panel`,
`--blue` / `--blue-light` used for glows, the screen arc, the LIVE dot and
accents → `--ev-accent`, `--muted-dark` → `--ev-muted`, `--line-dark` →
`--ev-line`, white headings → `--ev-text`. Corner brackets, eyebrows and
row letters → `--ev-gold`.

**W4W twist (keep these in W4W colors and marks):**
- The official W4W Philippines logo (stacked "W4W" + "PHILIPPINES", white
  and W4W blue) at the top of the title block, with no boxed badge behind
  it (unlike JCI).
- The wave texture (deviation 13) replaces JCI's diamond pattern, tinted
  `--ev-accent` at ≤5%.
- Particles are rising "water-light" droplets (deviation 17).

**Fonts:**
- Display: **Cinzel** 600/700 (Google Fonts, `latin` + `latin-ext`),
  fallback `Georgia, serif`, as `--font-display`. Use for the h1, panel
  titles ("Your seats", "How to pay"), eyebrows, the SCREEN label and
  primary button text, uppercase with `letter-spacing: .12–.3em`.
- Body: Hanken Grotesk stays for body text, labels, inputs and seat
  numbers.
- Oswald is not used on this page. Prices and the ₱ sign are set in Hanken
  (Cinzel may lack the ₱ glyph).

**Seat states in the event theme:**
- Available: `--ev-accent-deep` fill, 1px `--ev-accent` border at 70%,
  `--ev-text` number, blue glow (deviation 11).
- Selected ("Your selection"): solid `--ev-gold` fill, `--ev-bg` number,
  solid `--ev-gold` border, glow
  `0 0 12px color-mix(in srgb, var(--ev-gold) 55%, transparent)`. Seat
  chips in the booking panel use the same gold.
- Reserved (pending payment): transparent fill, 1px dashed
  `color-mix(in srgb, var(--ev-gold) 70%, transparent)` border, number in
  the same dimmed gold, no glow. Selected and reserved share the gold hue,
  so they must differ by shape and weight: solid filled + glow (yours)
  vs. hollow dashed outline (someone else's). Never make them look alike.
- Taken: `color-mix(in srgb, var(--ev-muted) 18%, transparent)` fill, "×",
  no glow.
Legend swatches match exactly. Reserved is no longer hatched; the dashed
gold border is its non-color cue.

- **Section rhythm:**
  1. **No header bar** (deviation 19). The page starts with the preview strip,
     then the title block.
  2. Preview notice strip: shown ONLY while `lib/booking-store.ts` is the
     mock (it exports `IS_MOCK = true`); the real backend exports `false`
     and the strip disappears automatically. Style it quietly:
     `--ev-panel`, `--ev-muted` text, 1px `--ev-line` border.
  3. **Title block (dark `--char`), compact, no hero section:** total height
     about 340–380px on desktop (same as JCI, whose map starts ~390px
     down); on mobile the "Pick your seats" button carries people to the
     map. Background: the faint wave texture
     (deviation 13) + the projector beam (deviation 4). Content, top to
     bottom:
     - **W4W logo**, top-left: `/w4w-logo.png` (trimmed transparent PNG,
       542×480), shown at 88px tall on desktop and 64px on mobile (the
       stacked logo's "PHILIPPINES" line is unreadable smaller than that).
       `alt="Waves for Water Philippines"`, no box or card behind it.
       20px gap between the logo and the eyebrow (16px on mobile).
     - `.eyebrow-caps` "Now booking" in `--ev-gold`.
     - `h1` "Movies4Water - Avengers: Doomsday Block Screening" in Cinzel 700 uppercase at
       `clamp(24px, 3vw, 40px)`, `--ev-text` (like JCI's title line). The
       old "Claim a seat. Bring clean water." headline is removed.
     - ONE line of facts in `--ev-muted`: "Sat, Dec 19, 2026 · Doors 3:45 PM
       · Movie 4:00 PM · Cinema 7, Power Plant Mall, Makati · ₱[price] per
       seat · Snacks and refreshments" (the price comes from
       `event_settings`; each fact stays unbroken; wrapping happens only
       between facts). **How the ₱1,000 is split:** Simon approved
       (2026-11-25) using W4W's Movies4Water deck figures, and only these:
       ₱500 of every ticket goes to clean water; a filter + bucket costs
       about ₱3,500, is shared by about 25 people and gives 5–10 years of
       clean water. Simon also approved (2026-11-26, from the same deck)
       one per-seat claim: "Every seat helps bring clean water to 4
       Filipinos", and its multiples (N seats → N × 4 Filipinos) in the
       "What's included" box. Don't state the rest of the split (ticket,
       food), and don't add any other per-ticket "people helped" claim.
     - **Cause line** (our version of JCI's gold tagline slot): "Every seat
       helps bring clean water to 4 Filipinos." in Cinzel, small caps
       style, `--ev-gold`, `letter-spacing: .2em`, ~12px. This is now the
       only place the title block says what the money is for; keep it.
     - **Prize strip** right under it (replaces the earlier gold raffle
       box and its "See the prizes" pill; the old ₱3,500 filter line is
       no longer on the home page). The raffle stays visible but lighter
       than "Pick your seats", which stays the only main button in the
       title block: no gold box, no gold circle, no outlined button.
       - Three round photos (44px, `#fff` background, 2px `--ev-bg`
         border, overlapping by 14px) from the 96×96 thumbnails in
         `public/prizes/` (`*-thumb.jpg`, listed in
         `components/raffle-prizes.ts`). Decorative: empty alt.
       - Next to them, Hanken: bold `--ev-text` "Get a chance to win
         prizes" (14px), "₱9,000 to ₱10,000 worth of giveaways" in
         `--ev-muted` (13px), and a gold text link "See the prizes ›"
         (`--ev-gold`, 14px, 600; no box, no outline; underlined on
         hover).
       - The whole strip is ONE button that opens the prizes panel
         (deviation 22); focus returns to it on close.
       - Laptop (from 700px): a slim pill that hugs its content, 1px
         `--ev-line` border, fill
         `color-mix(in srgb, var(--ev-bg) 85%, transparent)` (reads
         slightly darker against the light shafts); photos, text and link
         in one row (title and value stacked, link beside them).
       - Phone (below 700px): full width, no fill, a 1px `--ev-line`
         line above and below, the link on its own line under the text.
     - Status row: a pill badge "[n] seats available" (number in
       `--ev-accent`) · LIVE indicator · "[n] days to go"
     - Compact steps line: "01 Pick seats · 02 Pay via QR & upload proof ·
       03 Get your confirmation after we verify" (separators never start a
       line).
     No CTA buttons in the title block on desktop (the map is right there).
     On mobile, one `.btn-primary` "Pick your seats" that scrolls to the map.
  4. **Booking zone (dark `--char`), the "cinema zone":**
     - ≥1024px: two columns, `container` width. Left: seat map panel
       (fills remaining width). Right: booking panel, 360–380px wide,
       `position: sticky` below the header,
       `max-height: calc(100vh - header - 32px)`, scrolling internally.
     - <1024px: seat map full width + sticky bottom bar (deviation 3).
       "Continue" opens the booking panel as a full-height bottom sheet
       with a close button (focus trapped, Esc closes, returns focus).
     - No separate "How it works" or "Finish your booking" sections.
  5. **Footer: one slim line**, no mission quote or core belief:
     "© 2026 Waves for Water Philippines · Questions?
     w4wph.movies4water@gmail.com · Privacy Policy" (a `mailto:` link and
     the Privacy Policy PDF, links in
     `--ev-accent`) in
     `--ev-muted`, 12px, above a 1px `--ev-line` rule. It stays because
     people with payment or ticket problems need a way to reach W4W.
- **Deviations from the base system:**
  1. Eyebrows on light sections use
     `color-mix(in srgb, var(--blue) 78%, var(--ink))` to pass WCAG AA.
     (This page has almost no light sections; applies to the header and
     preview strip if used there.)
  2. Seats are too small for the hover lift. They change border and fill
     only, with no `translateY`.
  3. A sticky bottom summary bar on mobile is allowed, because the seat
     map is taller than one screen.
  4. **Signature moments (approved exceptions to the motion rules).** These
     are the only extra motion on the page. All use tokens only and are
     switched off by the universal reduced-motion rule (deviation 9 stays,
     since it isn't motion).
     - **Projector beam (title block):** a soft cone of `--blue` light from
       the top edge, radial/conic gradient at ≤12% opacity, drifting slowly
       (≥12s loop).
  5. - **Seat pop:** on select only, scale 1 → 1.12 → 1 over 220ms ease-out.
       Hovering or focusing a seat turns that row's letters `--blue-light`.
  6. - **Screen glow tracks occupancy:** the screen arc's glow opacity and
       blur scale with the share of seats reserved or taken (0.6s
       transition). The arc itself stays solid `--blue-light` at full
       opacity.
  7. - **Seats-left tick:** the number counts to its new value over 400ms
       when it changes.
  8. - **Reservation card (success view):** replaces the booking panel
       content on success. Styled as a ticket stub, but it is a
       reservation receipt, not a ticket. Top to bottom:
       - **Top stub:** `.eyebrow-caps` "Reservation received" + a pill
         "Pending verification" (`color-mix(in srgb, var(--blue-light) 14%,
         transparent)` fill, `--blue-light` text). Headline "You're in." in
         Oswald 700 uppercase, ~32px.
       - **Event:** "Movies4Water - Avengers: Doomsday Block Screening",
         "Sat, Dec 19, 2026", "Doors 3:45 PM · Movie 4:00 PM", "Cinema 7,
         Power Plant Mall, Makati".
       - **Seats:** grouped by row and sorted ascending, e.g. "Row L ·
         Seats 7, 8, 9" (one line per row), then "3 seats · Total
         ₱[PRICE TBD]".
       - **Perforation:** a dashed `--line-dark` line across the card with
         two semicircle notches centered ON that line at the left and right
         edges, filled with the panel background. Notches must never
         overlap text: keep ≥24px padding inside the card.
       - **Bottom stub:** small label "Reference code", the code in Hanken
         `--ev-accent` (~36px) with "· Pending verification" beside or under
         it, and a copy button that shows "Copied" for 2s; then the
         Pending verification message (see "Booking status wording") with
         the email in white; then
         `.btn-ghost` "Reserve more seats" (white).
       Card: `--char-2`, 1px `--line-dark` border, 14px radius. Enters with
       a 16px slide-up and fade over 400ms. Tokens only.
  9. - **Countdown:** "[n] days to go", computed from December 19, 2026 in
       Asia/Manila time. Updates daily, no ticking seconds. Hidden after
       the date.
  10. **One dark block.** Title block, booking zone and footer are all dark,
      with no light section between them. This breaks the alternation rule
      on purpose to keep booking on one screen. No StripeWave on this page.
  11. **Cinema-zone glow (approved exception, booking zone only).** Glows
      appear ONLY on the seat map panel and booking panel:
      - **Screen arc:** a curved SVG arc (not a flat line), 3px
        `--blue-light` stroke, glow via
        `drop-shadow(0 0 12px color-mix(in srgb, var(--blue-light) 55%, transparent))`,
        with a soft light spill below it fading toward the seats
        (`--blue-light` ≤10% → transparent). Label "SCREEN" as
        `.eyebrow-caps` under the arc.
      - **Seats:** available seats get
        `0 0 6px color-mix(in srgb, var(--blue-light) 14%, transparent)`;
        hover/focus and selected get
        `0 0 12px color-mix(in srgb, var(--blue-light) 45%, transparent)`.
        Reserved and taken seats have no glow.
      - **Corner brackets:** 14px L-shaped corners, 1.5px,
        `color-mix(in srgb, var(--blue-light) 60%, transparent)`, on the
        four corners of the seat map panel and booking panel.
      - **LIVE indicator:** 8px `--blue-light` dot with a slow 2s pulse,
        text "LIVE" in `.eyebrow-caps`. Shows "Connecting…" in
        `--muted-dark` (no pulse) until data loads.
  12. **Dark inputs inside the booking panel.** Background `--char`, 1px
      `--line-dark` border, white text, placeholder `--muted-dark`, labels
      `.eyebrow-caps`-style in `--muted-dark` (11px). Focus: `--blue-light`
      border + `color-mix(in srgb, var(--blue-light) 25%, transparent)` ring.
      Errors stay `#d64545`.
  13. **Wave texture.** The title block background carries the StripeWave
      motif as a static texture: lines at ≤5% opacity, large scale,
      non-interactive, `aria-hidden`. It replaces any other pattern; no
      grids, dots or ornaments. **It must keep its proportions:** never
      stretch it to the container (no `preserveAspectRatio="none"` for the
      texture). Render it at a fixed minimum width of ~1400px, centered
      and cropped (`xMidYMid slice` or an oversized, overflow-hidden
      wrapper), so phones show a crop of the same gentle waves as desktop.
      On ≤700px, lower it to ≤3% opacity.
  14. **Error text on dark panels:** token `--error-on-dark` =
      `color-mix(in srgb, #d64545 70%, #fff)`
      (about 5:1 on `--char-2`), always with a short message, never color
      alone. Defined once in `:root` next to the event tokens. Plain
      `#d64545` stays for
      invalid-field borders and for errors on light surfaces.
  15. **Wider booking zone:** the preview strip, title block, booking zone and
      footer all use `min(1280px, 100% - 48px)` instead of the 1120px
      container, so every edge lines up and the
      seat map gets more width. On desktop, seats are never smaller than
      24px (WCAG target size); if the map doesn't fit beside the panel at
      that size, the map panel scrolls sideways inside itself (same swipe
      wrapper as mobile) rather than shrinking seats. Don't shrink seats to
      fit the viewport height; a short page scroll is acceptable.
  16. **Cinematic light shafts (background).** Original, code-only: 3–5
      soft diagonal/vertical beams of `--ev-accent` (and one faint
      `--ev-gold` warm beam) falling from the top of the page, built from
      blurred linear/conic gradients at ≤10% opacity, plus a dark vignette
      at the edges and a faint haze. Slow shimmer (≥14s). Behind all
      content, `pointer-events: none`, `aria-hidden`. Off under reduced
      motion (static beams stay).
  17. **Particles.** One `<canvas>` behind the content, fixed position.
      Slowly rising "water-light" motes: ~45 on desktop, ~20 on mobile,
      1–3px, mostly `--ev-accent`, ~20% `--blue`, opacity 0.15–0.5,
      gentle sideways drift, fading in and out. Device pixel ratio capped at
      2. Pause when the tab is hidden; render nothing under reduced motion.
      No libraries.
  18. **Primary button (event theme):** keeps the W4W pill shape (twist);
      fill `color-mix(in srgb, var(--ev-accent) 22%, var(--ev-panel))`,
      1px `--ev-accent` border, `--ev-text` Cinzel label, blue glow on
      hover. Disabled: 45% opacity.
  19. **No header.** This page has no header bar; the logo sits in the
      title block instead. The base rule "one header per project" is waived
      for this microsite.
  20. **Input borders (event theme):**
      `color-mix(in srgb, var(--ev-accent) 50%, var(--ev-input))` so input
      boundaries meet the 3:1 non-text contrast minimum. Focus: solid
      `--ev-accent` border + 25% accent ring.
  21. **Event exclusives popup (cinema-ticket card).** Shown only while the
      Corporate Bundle is on (`group_size` and `group_price_per_seat` set in
      `event_settings`), about 2 seconds after the page loads, once per
      visit (`sessionStorage`, in try/catch: it shows again in a new visit
      but not on reloads or when coming back from GCash), never on top of the open
      booking sheet, never on /admin. Native modal `<dialog>`: closes with
      ×, "Pick your seats", Esc and tapping outside; focus stays inside and
      returns on close. Below 700px it is a bottom sheet (slides up,
      rounded top corners, grab handle, page visible above it); from 700px
      a centred card about 460px wide (enters like the reservation card).
      Works from 320px. Tokens only, inline stroke icons (no emoji, no
      Marvel images or logos), no numbered markers.
      - **Ticket:** `--ev-panel`, 1px `--ev-line` border, 16px radius. A
        top and a bottom section separated by a dashed `--ev-line` tear
        line with a round notch cut into each side (CSS mask, so the
        backdrop shows through).
      - **Top:** `.eyebrow-caps` "Event exclusives" with a ticket icon;
        title "One night. One cinema. 315 heroes." (Cinzel, uppercase);
        subtitle "Assemble for water." in `--ev-gold`; a × close button
        (44px) in the top-right corner.
      - **Bottom, in order:** Corporate Bundle box (1px `--ev-gold`
        border, warm dark fill `color-mix(in srgb, var(--ev-gold) 9%,
        var(--ev-panel))`): "Corporate Bundle", "₱9,500 for 10 tickets"
        and a gold "Save ₱500" badge (all from `event_settings`); raffle
        row (gift icon): "**1 ticket = 1 raffle entry.** Win prizes from
        Columbia, The Coffee Bean & Tea Leaf, Nono’s and RAF Forwarding.";
        food row (bottle icon) "Snacks and refreshments included", shown
        (`SHOW_FOOD_LINE = true`; the same switch controls the snacks row
        in the "What's included" box); impact box
        (water-drop icon) "₱500 of every ticket goes straight to clean
        water" with three stats: "~₱3,500" 1 filter + bucket, "~25
        people" share each filter, "5–10 years" of clean water; one
        full-width `.btn-primary` "Pick your seats" (closes the popup). No
        other buttons.
  22. **Prizes panel ("See the prizes").** Opened only by the prize
      strip; never on /admin. Native modal `<dialog>` with the same box,
      entrance and phone bottom sheet as the popup (deviation 21): below
      700px a bottom sheet (rounded top corners, grab handle, page visible
      above); from 700px a centred card about 460px wide. Scrolls inside
      itself when taller than the screen. Closes with ×, "Pick your
      seats", Esc and tapping outside; focus stays inside and returns to
      the prize strip. The popup and the panel never open on
      top of each other (the popup waits while the panel is open). Works
      from 320px. Tokens only; no prices, no sponsor logos.
      - **Card:** `--ev-panel`, 1px `--ev-line` border, 16px radius. Top:
        title "Raffle prizes" (Cinzel, uppercase), line "1 ticket = 1
        raffle entry. Book 10, get 10 entries." in `--ev-muted`, × close
        button (44px) in the top-right corner.
      - **Prizes by sponsor:** a small gold uppercase sponsor heading
        (Hanken, like the Corporate Bundle label), then a rounded list
        (1px `--ev-line` border, 12px radius, `--ev-line` dividers). Each
        row: item name in `--ev-text` and a gold quantity badge ("×1",
        "×275"; `--ev-gold` fill, `--ev-bg` text). The list lives in ONE
        content file, `components/raffle-prizes.ts` (items, quantities,
        photos); change prizes only there.
      - **Rows with a photo** (photos in `public/prizes/`): a small image
        icon before the name and a chevron after the badge (both
        `--ev-muted`); the whole row is a button that opens the photo
        viewer. **Rows without a photo** (vouchers, tumblers, popcorn
        maker) are plain text: not tappable, no icons, names aligned with
        the photo rows.
      - **Photo viewer:** a nested modal `<dialog>` over the panel, full
        screen, `color-mix(in srgb, var(--ev-bg) 94%, transparent)`. The
        photo (unedited file, on a `#fff` card, 12px radius, scaled to
        fit) with the item name as a caption and a 44px × button. Closes
        with ×, Esc or tapping outside; focus returns to the row. Alt text
        is the sponsor + item, e.g. "Columbia Women’s Puffect Jacket".
        Photos are loaded only when their row is tapped, never on page
        load. No animation of its own.
      - Bottom: one full-width `.btn-primary` "Pick your seats" (closes
        the panel). No other buttons.
- **Booking status wording (one code, three statuses).** Every booking has
  ONE reference code (e.g. `W4W-DD-7K2Q`), created at submission and never
  changed. Wherever a guest sees the code, the status is shown right next to
  it, with exactly these words:
  - **Pending verification** (after submitting): "We'll email you at
    [guest's email] once your payment is verified. Keep your reference
    code." Showing the email lets guests spot a typo before they leave.
  - **Confirmed** (after approval, confirmation email): "Your payment is
    verified and your seats are confirmed." Day-of instructions depend on
    the check-in process ([CHECK-IN PROCESS TBD]); don't promise QR
    e-tickets until it's decided.
  - **Not approved** (after rejection, email): says we could not verify the
    payment, that the seats are no longer held, and asks the guest to
    contact w4wph.movies4water@gmail.com with their reference code. The
    reviewer's reason and team note are never sent to the guest; they stay
    in /admin.
  Format: `W4W-DD-7K2Q · Pending verification`. In /admin the three
  statuses are called Waiting for review, Confirmed and Not approved.
- **Booking panel (desktop) / sheet (mobile), one column, top to bottom:**
  1. **Your seats:** chips (removable), count, amount due (₱[PRICE TBD]
     while price is null). Empty: "No seats selected · Tap a glowing seat
     to start".
  2. Full name*, Mobile number or Messenger name*, Email* (hint: "Your
     confirmation is sent here"), Company / organization (optional).
  3. **How to pay** box (`--line-dark` dashed border, 12px radius): short
     line "Scan with GCash, Maya or your bank app, enter the exact amount
     due, then attach the screenshot below.", the UnionBank InstaPay QR
     (`/payment-qr.png`, a static QR Ph code with no amount inside; account
     name "WAVES FOR WATER ORGANIZAT" as encoded) on a white `#fff` card
     with the caption "Account name: Waves for Water Organization, Inc. ·
     UnionBank via InstaPay", `.btn-ghost` "Save QR code" (downloads the
     image), the paying-from-this-phone instructions, and "Before you pay,
     check that your app shows the account name WAVES FOR WATER
     ORGANIZAT…".
  4. Payment screenshot* upload (JPG/PNG/HEIC/WEBP, 10 MB).
  5. Notes (optional, textarea).
  6. Consent (inline checkbox): "I have read the Privacy Policy of Waves
     for Water Philippines and agree to W4W processing my details for this
     booking under the Data Privacy Act of 2012." "Privacy Policy" links to
     `public/policies/privacy-policy.pdf`, opening in a new tab, in
     `--ev-accent`. Then the **"What's included" box** (only while at
     least 1 seat is picked; same spot in the phone sheet and the laptop
     panel): 1px `--ev-gold` border, `--ev-panel` fill, 14px radius, gold
     label "What's included" with a ticket icon, then three rows with the
     popup's inline stroke icons (gift and bottle in `--ev-gold`, water
     drop in `--ev-accent` like the popup), numbers updating live:
     gift "**[N] raffle entries** (1 per seat) for ₱9,000 to ₱10,000 worth
     of giveaways" ("1 raffle entry" for one seat); bottle "**Snacks and
     refreshments**" (same `SHOW_FOOD_LINE` switch as the popup); water
     drop "Your [N] seats help bring clean water to **[N × 4] Filipinos**"
     (one seat: "Your seat helps bring clean water to **4 Filipinos**").
     Then full-width `.btn-primary` "Reserve seats".
  7. On success, the panel content is replaced by the e-ticket card
     (deviation 8) with "Reserve more seats".
  Validation: inline errors under each field on submit (required fields,
  email format, file type and size, consent), never silent failure.
- **Special components:**
  - **Seat map:** Cinema 7, 315 seats, 26-column grid, screen at top,
    numbers run high on the left to 1 on the right, row letters on both
    sides, cross-aisle gap between F and G. Segments `[startColumn, seats]`:
    - Rows A–F: `[1, 22→16] [10, 15→8] [20, 7→1]`
    - Rows G–N: `[4, 15→12] [10, 11→5] [19, 4→1]`
    - Rows O–P: `[1, 21→15] [10, 14→8] [19, 7→1]`
    - Row Q: `[3, 21→1]`
  - **Seat states** (tokens only, never color alone):
    - Available: transparent, `--line-dark` border
    - Selected: `--blue-light` fill, `--char` number
    - Reserved (pending): `--char-2` with a `--blue` 35% diagonal hatch
    - Taken: `--muted-dark` 18% fill with "×"
  - No Marvel logos, posters, stills or character art. The film title is
    text only. Don't copy another organization's site styling.
- **Admin (`/admin`, payment verification).** Built for non-technical
  verifiers on phones and laptops. Event-theme tokens only; no atmosphere
  (no light shafts, particles or glows) and **no motion** of its own (the
  shared button hover is the only movement, and the reduced-motion rule
  turns it off). Styles live in the admin section of `app/globals.css` and
  never change shared guest-page rules.
  - **Layout.** From 1024px: a left sidebar with "MOVIES4WATER"
    (`.eyebrow-caps`, `--ev-gold`) and "ADMIN"; Home; PAYMENTS: Waiting for
    review, Confirmed, Not approved (with counts); TOOLS: Download guest
    list (the approved CSV); at the bottom: View the booking page, "Signed
    in as …", Sign out. The current page is highlighted in `--ev-gold`.
    Below 1024px: a top bar with a "Menu" button that opens the same menu
    as a full-screen modal `<dialog>` with a close (×) button (focus stays
    inside, Esc closes, focus returns). Pages are URL hashes (`#home`,
    `#check`, `#waiting`, `#confirmed`, `#not-approved`) so the phone's
    Back button works.
  - **Home cards.** One large card with a gold border: badge NEEDS
    ATTENTION, the number waiting, "The oldest has been waiting …" and
    "Start checking"; or ALL CLEAR when nothing is waiting. Two small
    cards: DONE (confirmed) and FOR YOUR INFO (not approved). A collapsed
    "See the numbers" (seats still free, seats on hold, money confirmed).
  - **Guided check.** One waiting booking at a time, oldest first, with
    "Booking 1 of N" and a gold progress bar. The queue is a snapshot: new
    bookings join the end, and the booking on screen is never swapped out.
    Shows the guest's name, a large payment screenshot, the "Open the
    UnionBank app and look for this payment:" box (amount, reference in
    `--ev-gold` with Copy, payer name) and "Did you find this payment?"
    with "Yes, I found it" / "No, something's wrong", plus Skip and a
    collapsed "More details". After each decision it moves to the next
    booking; at the end, an "All done!" summary.
  - **Confirm and not-approved steps.** Confirm: "Great! Confirm [name]'s
    [N] seats?" with the amount, reference and seats. Not approved: one
    required reason (I can't find the payment / The amount is different /
    The receipt looks wrong / Something else) and an optional team note
    the guest never sees, saved as "Reason: …. Note: …" (500 characters
    max). Both say the action can't be undone, show "Saving… don't close
    this page" and disable their buttons while saving. The full waiting
    list (`#waiting`) uses the same steps; there is no other way to
    approve or reject.
  - **Screenshot viewer.** The payment screenshot opens full screen inside
    the dashboard (modal `<dialog>`, Zoom in / Fit to screen, Close or Esc,
    focus returns). HEIC/HEIF files get a download button instead.
  - **Phone bottom bar.** Below 1024px the answer and step buttons stick to
    the bottom of the screen (`position: sticky`, the same approach as the
    guest page's bottom bar, with safe-area padding), so nothing is hidden
    behind them. In phone landscape the bar is one row.
  - **Status badges with words** (pill, never color alone): Waiting in
    `--ev-gold`; Confirmed in `--ev-accent` (blue) with a check icon; Not
    approved in `--ev-muted` (grey). No green.
  - **Buttons.** Admin buttons use Hanken Grotesk in normal case (admin
    only; the guest page keeps Cinzel, deviation 18). Every tap target is
    at least 44px tall (the answer and step buttons 52px); inputs stay
    16px.
  - **Focus.** An admin-only 2px `--ev-accent` focus ring
    (`:focus-visible`) so keyboard focus shows on the dark panels.
- **Build status:**
  - **Built:** Supabase backend (`supabase/schema.sql` plus
    `supabase/migrations/`) behind `lib/booking-store.ts`, live seat updates,
    booking with payment screenshot and payment reference number, the
    `/admin` verification page (see "Admin" above; CSV export as "Download
    guest list") behind `lib/admin-api.ts`, which passes every call to the
    unchanged `lib/admin-store.ts` and holds the localhost-only test mode
    (`NEXT_PUBLIC_ADMIN_MOCK`), the UnionBank payment QR, the Privacy Policy
    PDF, the link preview, and automatic confirmation emails (Task 9: booking
    received, confirmed, not approved) sent via Gmail SMTP from
    w4wph.movies4water@gmail.com through `app/api/booking-email`. If an
    automatic email fails, /admin shows a warning (kept until dismissed) with
    "Copy email text" and "Copy subject", which copy the exact automatic
    email to send by hand; `docs/email-templates.md` is the backup.
  - **Not built yet:** check-in at the door is undecided
    ([CHECK-IN PROCESS TBD]).
- **Link preview (Open Graph):** `app/opengraph-image.tsx` generates a
  1200×630 image at build time: the W4W Philippines logo centered on
  `--char`, then "Movies4Water", "Avengers: Doomsday Block Screening" and the
  date and venue in `--muted-dark`. No Marvel imagery. Exception to "no hex
  outside `:root`": the image generator can't read CSS variables, so that
  file mirrors `--char` and `--muted-dark` as literals (keep them in sync).
  Same for `themeColor` in `app/layout.tsx` (`--char`).
- **Hosting:** Netlify. No Vercel-specific packages or services.

---

## 1. Principles

- **Clean water first.** This is a nonprofit, not a product launch. Designs
  are calm, confident and trustworthy, never flashy.
- **One primary action per section.** Every section should make its next step
  obvious.
- **Reuse, don't reinvent.** Use the tokens, classes and components below
  before creating anything new.
- **Tokens, not hex.** Every color comes from a CSS variable.

## 2. Color tokens

Define these on `:root` in the global stylesheet.

| Token | Value | Use |
|---|---|---|
| `--char` | `#161b20` | Dark section background |
| `--char-2` | `#1e252c` | Cards and panels on a dark section |
| `--paper` | `#eef1f2` | Light section background; page default |
| `--blue` | `#4f93b8` | Primary accent: buttons, eyebrows, active states, key numbers |
| `--blue-light` | `#7cc0e0` | Accent text on dark (highlighted words, stats, links) |
| `--ink` | `#14222f` | Headings on light |
| `--muted` | `#5d6b76` | Body text on light |
| `--muted-dark` | `#a9b5bf` | Body text on dark |
| `--line` | `#d9e0e4` | Borders and dividers on light |
| `--line-dark` | `rgba(79,147,184,.45)` | Borders and dividers on dark |

### Pairing rules

Each surface has its own text and border tokens. Don't mix them.

- **On `--paper` or white:** headings `--ink`, body `--muted`, borders
  `--line`, accent `--blue`.
- **On `--char` or `--char-2`:** headings `#fff`, body `--muted-dark`, borders
  `--line-dark`, accent text and links `--blue-light`. `--blue` is fine for
  eyebrows and icons on `--char`, but use `--blue-light` for small text on
  `--char-2` cards.

### Derived colors

- **Tints** come from `color-mix()`, never new hex:
  `color-mix(in srgb, var(--blue) 6–14%, #fff)` for chips, badges, selected
  rows and info panels.
- **Shadows on light:** `color-mix(in srgb, var(--ink) 6–20%, transparent)`.
- **Shadows on dark or over photos:** `rgba(0,0,0,.2–.3)`.
- **Allowed literals:** white `#fff` (text on dark, cards, inputs) and form
  error red `#d64545` (validation errors only).

### Contrast (known gaps and the recommended fix)

- White text on `--blue` is about 3.4:1, which fails WCAG AA for small button
  labels. **Recommended fix** (used on FlappyBoard): give `.btn-primary` the
  fill `color-mix(in srgb, var(--blue) 78%, var(--ink))`, with hover returning
  to `--blue`.
- `--blue` text on `--paper` is about 3:1, which fails AA for small eyebrows.
  If accessibility review matters for the project, darken eyebrows on light
  sections the same way.
- Both are palette decisions. If a project changes them, note it in Section 0.

## 3. Typography

| Role | Font | Weights | Fallback |
|---|---|---|---|
| Display | Oswald | 500, 600, 700 | `"Arial Narrow", sans-serif` |
| Body | Hanken Grotesk | 400, 500, 600, 700 | `Arial, Helvetica, sans-serif` |

- Load both through `next/font/google` (or the Google Fonts link for non-Next
  projects), with the `latin` and `latin-ext` subsets. `latin-ext` is needed
  for the peso sign ₱.
- Headlines use `.display`: Oswald 700, uppercase, tight leading (`.95`), no
  negative letter-spacing.
- Eyebrows use `.eyebrow-caps`: small, bold, widely spaced caps in `--blue`.
- Body copy is 13–16px with a line height of 1.4–1.6, in `--muted` on light or
  `--muted-dark` on dark. Never full `--ink` for paragraphs.
- Size with `clamp()`, not fixed breakpoint overrides.
- No script, handwritten, italic-serif or decorative fonts.
- Never use Oswald for body copy or Hanken for section headlines.

## 4. Shared classes

| Class | What it is |
|---|---|
| `.display` | Oswald 700, uppercase, `line-height:.95`, `font-size:clamp(38px, 5.2vw, 72px)` |
| `.eyebrow-caps` | Hanken 700, 12px, uppercase, `letter-spacing:.22em`, `--blue` |
| `.btn-primary` | Pill button, blue fill, white text (see contrast fix above) |
| `.btn-ghost` | Pill button, transparent, 1px `currentColor` border |
| `.eyebrow-icon` | Add to `.eyebrow-caps` for a leading icon (flex row, 8px gap) |
| `.stripe-wave` | Default sizing for `StripeWave` (full width, `clamp(56px, 8vw, 104px)` tall) |

## 5. Buttons

- Pill-shaped (`border-radius:999px`), Hanken 700, 13px, `padding:13px 24px`.
- **`.btn-primary`** is the main action in a section. Use at most one per
  group.
- **`.btn-ghost`** is for secondary actions. Its border and text follow
  `currentColor`, so set `color` for the surface: white on dark, `--ink` on
  light.
- A plain text link is fine as a third, lowest-priority action.

## 6. Shape and spacing

- **Radius:** pill (`999px`) for buttons, tabs, chips, badges and tags. Cards
  and panels are `11–16px`. Keep radii consistent within a card family.
- **Container:** `min(1120px, 100% - 48px)`, centered.
- **Sections:** `.section { padding:68px 0 }`, tightening on mobile. No
  one-off section padding.
- **Cards on light:** white, 1px `--line` border. **Cards on dark:**
  `--char-2`, 1px `--line-dark` border.
- **Inputs:** white, 1px `--line` border, with a `--blue` border and a 20%
  `--blue` focus ring when focused.
- **One header and one footer component** per project, reused on every page.

## 7. Section rhythm

- Pages alternate full-bleed dark (`--char`) and light (`--paper`) sections.
  Photo sections count as dark.
- A **`StripeWave`** marks each seam going *into* a dark section. Seams going
  from dark to light are flat color cuts.
- Don't stack two sections of the same surface without a reason. If you must,
  separate them with spacing, not a divider.
- **Header:** white bar, 1px `--line` bottom border, nav links in Hanken 500
  13px `--ink` (turning `--blue` on hover), and one `.btn-primary` for the
  site's main action.
- **Footer:** `--char` background, Hanken 700 white headings, `--muted-dark`
  links that turn white on hover, and a `--line-dark` divider above the base
  row.
- **Dark hero option:** `--char` with a slow, faint `--blue` radial wash, a
  white `.display` headline and `--muted-dark` intro text.

## 8. StripeWave (signature divider)

A full-width band of **6 parallel white sine lines** (3px stroke, even gaps)
on a solid background. It's the only divider style.

- Props: `bg` (band background, default `var(--char)`), `top` (fills above
  the first line with the previous section's color, so it flows into the
  curve), `className`.
- Static SVG: `preserveAspectRatio="none"`, `aria-hidden`, no animation.
- Strokes use `vector-effect: non-scaling-stroke`, so lines stay 3px at any
  width.
- **Reuse the existing component** (`components/stripe-wave.tsx`) from the
  Pilipinas4Water or FlappyBoard repo. Don't rebuild it from scratch.

## 9. Motion

- **Hover:** `transform .22s ease, box-shadow .22s ease` (plus
  `background-color`), a subtle lift of `translateY(-2px)` to `-4px` with a
  soft shadow. Nothing more aggressive.
- **Scroll reveal:** one shared `.reveal` / `.reveal.is-visible` pattern.
- **Ambient motion** is slow and low-opacity (glows, washes, gentle pulses).
- **Reduced motion:** one universal rule at the end of the global stylesheet
  sets `animation:none` and `transition:none` everywhere and shows reveal
  content immediately. Don't add per-component lists.
- **Exceptions:** if a project's core feature *is* an animation, document it
  in Section 0, keep everything else restrained, and make it respect
  `prefers-reduced-motion`.

## 10. Copy and content rules

- **Never invent facts:** no prices, stats, partner names, dates,
  testimonials or claims. Use a visible placeholder like `[PRICE TBD]` or
  `[CONTACT EMAIL TBD]` until the real value is confirmed.
- **Organization name:** "Waves for Water Philippines" in full on first use;
  "W4W" is fine afterwards.
- **Mission, when quoted, exactly:** "To get clean water to every single
  person who needs it."
- **Core belief, when quoted, exactly:** "Access to clean water is a
  fundamental human right."
- **Tone:** warm, direct, not corporate. Filipino audience first.
- **Never copy text from reference images or AI mockups.** Their text is often
  garbled or invented.
- **Check partner and event names** for spelling before they go live (e.g.
  Purveyr, not "Purveyor").

## 11. What NOT to do

- Don't add colors outside the 10 tokens without recording it in Section 0.
  No gold, teal or warm cream. Those were retired on purpose.
- Don't hardcode hex in components or use Tailwind arbitrary hex values
  (`text-[#…]`). Use `text-[var(--token)]`.
- Don't use script, handwritten or italic-serif accent fonts.
- Don't use curved fills, torn edges or zigzag dividers. `StripeWave` is the
  only divider.
- Don't put small `--blue` text on `--char-2` cards.
- Don't create a second radius scale, shadow style or transition timing for
  one component.
- Don't build inline copies of the header or footer.

## 12. Starter CSS

Paste into the global stylesheet (e.g. `app/globals.css`), after any
framework imports.

```css
:root {
  --char: #161b20;
  --char-2: #1e252c;
  --paper: #eef1f2;
  --blue: #4f93b8;
  --blue-light: #7cc0e0;
  --ink: #14222f;
  --muted: #5d6b76;
  --muted-dark: #a9b5bf;
  --line: #d9e0e4;
  --line-dark: rgba(79, 147, 184, .45);
}

body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-body), Arial, Helvetica, sans-serif;
}

h1, h2, h3, .font-heading {
  font-family: var(--font-display), "Arial Narrow", sans-serif;
}

.container { width: min(1120px, 100% - 48px); margin-inline: auto; }
.section { padding: 68px 0; }
@media (max-width: 640px) { .section { padding: 48px 0; } }

.display {
  font-family: var(--font-display), "Arial Narrow", sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  line-height: .95;
  font-size: clamp(38px, 5.2vw, 72px);
}

.eyebrow-caps {
  font-family: var(--font-body), Arial, sans-serif;
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .22em;
  color: var(--blue);
}
.eyebrow-icon { display: inline-flex; align-items: center; gap: 8px; }

.btn-primary, .btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 999px;
  font-family: var(--font-body), Arial, sans-serif;
  font-weight: 700;
  font-size: 13px;
  padding: 13px 24px;
  cursor: pointer;
  transition: transform .22s ease, box-shadow .22s ease, background-color .22s ease;
}
.btn-primary {
  background: color-mix(in srgb, var(--blue) 78%, var(--ink));
  color: #fff;
  border: 0;
}
.btn-primary:hover { background: var(--blue); }
.btn-ghost {
  background: transparent;
  color: inherit;
  border: 1px solid currentColor;
}
.btn-primary:hover, .btn-ghost:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px color-mix(in srgb, var(--ink) 14%, transparent);
}

.stripe-wave { display: block; width: 100%; height: clamp(56px, 8vw, 104px); }

/* Keep this last */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
  .reveal { opacity: 1 !important; transform: none !important; }
}
```

Fonts in a Next.js `app/layout.tsx`:

```tsx
import { Oswald, Hanken_Grotesk } from "next/font/google"

const display = Oswald({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
})
const body = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
})

// <html lang="en" className={`${display.variable} ${body.variable}`}>
```

## 13. Kickoff prompt

Paste this as the first message in a new Claude Code session or v0 chat,
with this file attached or in the repo:

```
Read DESIGN.md before doing anything. Section 0 has this project's overrides
and wins over the rest; the rest is the Waves for Water Philippines design
standard. Follow its tokens, fonts, buttons, section rhythm and copy rules.
Never hardcode hex, never invent facts (use [PLACEHOLDER TBD] instead), and
never add a color, font or divider style that isn't in the file. If a task
seems to need a deviation, ask me first and I'll add it to Section 0.
Reply in 3 lines confirming the project purpose, the section rhythm, and any
deviations. Don't build anything yet.
```

## 14. New project checklist

- [ ] Section 0 filled in and placeholders removed
- [ ] Starter CSS added and fonts loaded
- [ ] Header and footer built once and reused
- [ ] StripeWave copied from an existing W4W repo
- [ ] No hardcoded hex (search the codebase for `#`)
- [ ] All placeholder copy (`TBD`) replaced or flagged before launch
- [ ] Tested on a phone and with reduced motion on
- [ ] Preview link sent to approvers for sign-off
