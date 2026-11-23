# Email templates for payment verifiers

Movies4Water - Avengers: Doomsday Block Screening

**Easiest way: use the "Copy email text" button in /admin.** When an
automatic email doesn't send, /admin shows a warning ("emails did not send")
with **Copy email text** and **Copy subject** buttons. They copy the exact
automatic email for that guest. This file is the backup, for when that isn't
available (for example, the warning was already dismissed, or a guest says
they got nothing).

The site sends these emails automatically from
**w4wph.movies4water@gmail.com** (booking received, confirmed, not approved).
Use these templates only as a fallback: when /admin says an email
**did not send**, or when a guest says they got nothing (check
spam first). Send them by hand from **w4wph.movies4water@gmail.com**.
Copy a template, replace every
`[BRACKETED]` field with the details from the booking in /admin, and
send it to the guest's email address shown there.

The templates below are the same text as the automatic emails
(`lib/email-templates.ts`). When filling one in:

- Leave out the **Organization**, **Paid by** and **Notes** lines (and
  **Food allergies** in template 3) if the guest left them empty.
- If the seats are in more than one row, put each extra row on its own line
  under the first, indented with 4 spaces.
- If /admin shows the amount as ₱[PRICE TBD], the line is
  `Amount: [PRICE TBD]`.

Rules for every email:

- Put the reference code and status together, exactly like this:
  `W4W-DD-7K2Q · Confirmed`.
- Copy the seats line exactly as /admin shows it, e.g. `Row L · Seats 7, 8, 9`.
- Don't promise QR codes, e-tickets or receipts. None of these are decided yet.
- Don't add any `[... TBD]` text yourself. Only keep it where the automatic
  email already shows it (for example `Amount: [PRICE TBD]`).

---

## 1. Confirmed (send after you confirm a booking)

Send this only after you've confirmed the exact amount arrived in the
UnionBank account and pressed **Confirm and email [first name]** in /admin.

**Subject:** Booking confirmed · [REFERENCE CODE] · Movies4Water

```
Hi [GUEST NAME],

[REFERENCE CODE] · Confirmed

Your payment is verified and your seats for Movies4Water - Avengers: Doomsday Block Screening are confirmed.

Reference: [REFERENCE CODE]
Event: Movies4Water - Avengers: Doomsday Block Screening
When: Saturday, December 19, 2026 · Doors 3:30 PM · Movie 4:00 PM
Where: Cinema 7, Power Plant Mall, Makati
Name: [GUEST NAME]
Email: [GUEST EMAIL]
Mobile / Messenger: [MOBILE / MESSENGER]
Organization: [ORGANIZATION]
Seats: [SEATS, as /admin shows them, e.g. Row L · Seats 7, 8, 9]
Number of seats: [NUMBER OF SEATS, e.g. 3 seats]
Amount: ₱[AMOUNT] ([NUMBER] × ₱[PRICE PER SEAT])
Payment reference: [PAYMENT REFERENCE]
Paid by: [PAID BY]
Payment screenshot: received
Notes: [NOTES]

Please keep your reference code. Thank you for helping bring clean water to Filipino communities.

Questions? Reply to this email or write to w4wph.movies4water@gmail.com with your reference code.

Waves for Water Philippines
w4wph.movies4water@gmail.com
```

---

## 2. Not approved (send after you mark a booking not approved)

Send this after you press **Mark as not approved** in /admin. That frees the
seats straight away, and the email tells the guest they're no longer held.
Don't add the reason or the team note: the guest never sees those.

**Subject:** Booking not approved · [REFERENCE CODE] · Movies4Water

```
Hi [GUEST NAME],

[REFERENCE CODE] · Not approved

We're sorry, but we could not verify the payment for your reservation for Movies4Water - Avengers: Doomsday Block Screening.
The seats below are no longer held for you.

Reference: [REFERENCE CODE]
Event: Movies4Water - Avengers: Doomsday Block Screening
When: Saturday, December 19, 2026 · Doors 3:30 PM · Movie 4:00 PM
Where: Cinema 7, Power Plant Mall, Makati
Name: [GUEST NAME]
Email: [GUEST EMAIL]
Mobile / Messenger: [MOBILE / MESSENGER]
Organization: [ORGANIZATION]
Seats: [SEATS, as /admin shows them, e.g. Row L · Seats 7, 8, 9]
Number of seats: [NUMBER OF SEATS, e.g. 3 seats]
Amount: ₱[AMOUNT] ([NUMBER] × ₱[PRICE PER SEAT])
Payment reference: [PAYMENT REFERENCE]
Paid by: [PAID BY]
Payment screenshot: received
Notes: [NOTES]

Please contact us at w4wph.movies4water@gmail.com with your reference code so we can help.

Waves for Water Philippines
w4wph.movies4water@gmail.com
```

---

## 3. Reservation received (optional)

Guests already see this message on the website after they book, so it isn't
required. Use it only if a guest emails to ask whether their booking went
through and it's still **Waiting for review** in /admin.

**Subject:** Booking received – pending verification · [REFERENCE CODE] · Movies4Water

```
Hi [GUEST NAME],

[REFERENCE CODE] · Pending verification

Thanks for booking! We received your reservation and payment screenshot for Movies4Water - Avengers: Doomsday Block Screening.

Reference: [REFERENCE CODE]
Event: Movies4Water - Avengers: Doomsday Block Screening
When: Saturday, December 19, 2026 · Doors 3:30 PM · Movie 4:00 PM
Where: Cinema 7, Power Plant Mall, Makati
Name: [GUEST NAME]
Email: [GUEST EMAIL]
Mobile / Messenger: [MOBILE / MESSENGER]
Organization: [ORGANIZATION]
Seats: [SEATS, as /admin shows them, e.g. Row L · Seats 7, 8, 9]
Number of seats: [NUMBER OF SEATS, e.g. 3 seats]
Amount: ₱[AMOUNT] ([NUMBER] × ₱[PRICE PER SEAT])
Payment reference: [PAYMENT REFERENCE]
Paid by: [PAID BY]
Payment screenshot: received
Notes: [NOTES]
Food allergies: [FOOD ALLERGIES]

We will check your payment and email you again once it is verified. Please keep your reference code.

Our updates sometimes land in spam. Please check your spam or junk folder, and mark this address as not spam.

Questions? Reply to this email or write to w4wph.movies4water@gmail.com with your reference code.

Waves for Water Philippines
w4wph.movies4water@gmail.com
```

---

## Still to decide before these are final

- **Check-in process:** what guests show at the door (name, reference code,
  or something else). When it's decided, add it to the automatic emails
  (`lib/email-templates.ts`) and to these templates.
