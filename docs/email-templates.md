# Email templates for payment verifiers

Movies4Water - Avengers: Doomsday Block Screening

The site now sends these emails automatically from
**w4wph.movies4water@gmail.com** (booking received, confirmed, not approved).
Use these templates only as a fallback: when /admin says **"Email not sent"**
after you approve or reject, or when a guest says they got nothing (check
spam first). Send them by hand from **w4wph.movies4water@gmail.com**.
Copy a template, replace every
`[BRACKETED]` field with the details from the booking card in /admin, and
send it to the guest's email address on the card.

Rules for every email:

- Put the reference code and status together, exactly like this:
  `W4W-DD-7K2Q · Confirmed`.
- Copy the seats line exactly as /admin shows it, e.g. `Row L · Seats 7, 8, 9`.
- Don't promise QR codes, e-tickets or receipts. None of these are decided yet.
- Leave any `[... TBD]` text out of the email until the team confirms it.
  Don't guess.

---

## 1. Confirmed (send after you press Approve)

Send this only after you've confirmed the exact amount arrived in the
UnionBank account and pressed **Approve** in /admin.

**Subject:** Reservation confirmed · [REFERENCE CODE] · Movies4Water

```
Hi [GUEST NAME],

[REFERENCE CODE] · Confirmed

Your payment is verified and your seats are confirmed.

Movies4Water - Avengers: Doomsday Block Screening
Sat, Dec 19, 2026 · Doors 3:30 PM · Movie 4:00 PM
Cinema 7, Power Plant Mall, Makati
Includes food and refreshments

Your seats: [SEATS LINE, e.g. Row L · Seats 7, 8, 9]
Amount received: ₱[AMOUNT]

[CHECK-IN PROCESS TBD: what guests bring or show at the door]

Please keep your reference code. Thank you for helping bring clean water to
Filipino communities.

Waves for Water Philippines
w4wph.movies4water@gmail.com
```

---

## 2. Not approved (send after you press Reject)

Send this after you press **Reject** in /admin. Rejecting frees the seats
straight away, so tell the guest they're no longer held. Write a short, kind
reason. Use the same reason you typed in the Reject dialog.

Example reasons:

- "We couldn't find a payment matching your reference number
  [PAYMENT REF] in our account."
- "The amount we received (₱[RECEIVED]) doesn't match the amount due for
  your seats (₱[AMOUNT DUE])."
- "The payment screenshot couldn't be matched to a payment in our account."

**Subject:** About your reservation · [REFERENCE CODE] · Movies4Water

```
Hi [GUEST NAME],

[REFERENCE CODE] · Not approved

We're sorry, but we couldn't confirm your reservation for
Movies4Water - Avengers: Doomsday Block Screening.

Reason: [REASON]

The seats you picked ([SEATS LINE]) are no longer held for you. If you'd
still like to come, you're welcome to book again on the website while seats
are available.

[IF A PAYMENT WAS RECEIVED: REFUND STEPS TBD; confirm with Patrick before
sending]

Questions? Just reply to this email or write to
w4wph.movies4water@gmail.com.

Waves for Water Philippines
```

---

## 3. Reservation received (optional)

Guests already see this message on the website after they book, so it isn't
required. Use it only if a guest emails to ask whether their booking went
through and it's still **Pending** in /admin.

**Subject:** We received your reservation · [REFERENCE CODE] · Movies4Water

```
Hi [GUEST NAME],

[REFERENCE CODE] · Pending verification

Thanks for booking! We received your reservation and payment screenshot for
Movies4Water - Avengers: Doomsday Block Screening.

Your seats: [SEATS LINE]
Amount due: ₱[AMOUNT]

We'll email you at [GUEST EMAIL] once your payment is verified. Keep your
reference code.

Waves for Water Philippines
w4wph.movies4water@gmail.com
```

---

## Still to decide before these are final

- **Check-in process:** what guests show at the door (name, reference code,
  or something else). It fills `[CHECK-IN PROCESS TBD]` in template 1.
- **Refunds for rejected bookings where money did arrive:** the current
  Refund Policy doesn't cover this case. It fills the refund line in
  template 2.
