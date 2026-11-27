# Email templates for payment verifiers

Movies4Water - Avengers: Doomsday Block Screening

**Easiest way: use the "Copy email text" button in /admin.** When an
automatic email doesn't send, /admin shows a warning ("emails did not send")
with **Copy email text** and **Copy subject** buttons. They copy the exact
automatic email for that guest. This file is the backup, for when that isn't
available (for example, the warning was already dismissed, or a guest says
they got nothing).

The site sends these emails automatically from
**w4wph.movies4water@gmail.com** (booking received, confirmed, not approved,
and the one-time "Your check-in QR code" email).
Use these templates only as a fallback: when /admin says an email
**did not send**, or when a guest says they got nothing (check
spam first). Send them by hand from **w4wph.movies4water@gmail.com**.
Copy a template, replace every
`[BRACKETED]` field with the details from the booking in /admin, and
send it to the guest's email address shown there. For the confirmed, not
approved and check-in QR emails (templates 1, 2 and 4), put
**jenna@wavesforwater.org** in **Cc**, like the automatic emails. Not for the
booking received email (template 3): it contains food allergies.

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
  `W4W-DD-7K2Q · Confirmed` (templates 2 and 3; the confirmed email, template
  1, and the check-in QR email, template 4, have no status line).
- Copy the seats line exactly as /admin shows it, e.g. `Row L · Seats 7, 8, 9`.
- **Check-in QR code:** the confirmed email (template 1) and template 4 carry the
  guest's check-in QR code as an image. A hand-sent email can't make it: in
  /admin, use **Download QR code** on the warning and attach the image to your
  email. Never make a QR code yourself or send someone else's. The automatic
  emails also have an "Open your QR code" link; hand-sent emails don't (the
  templates below leave it out on purpose).
- **Acknowledgment Receipt (AR):** if you have the guest's AR, attach it to the
  confirmed email and use the "QR code and Acknowledgment Receipt" sentence in
  template 1; without an AR, use the "QR code" sentence. /admin never keeps the
  AR file: if you picked one when confirming and the email didn't send, attach
  that same file from your phone or computer. (Hand-sent emails always have the
  QR attached, so the automatic email's "AR only" sentence isn't needed here.)
- Don't promise e-tickets. They aren't decided.
- Don't add any `[... TBD]` text yourself. Only keep it where the automatic
  email already shows it (for example `Amount: [PRICE TBD]`).

---

## 1. Confirmed (send after you confirm a booking)

Send this only after you've confirmed the exact amount arrived in the
UnionBank account and pressed **Confirm and email [first name]** in /admin.

**Subject:** Booking confirmed · [REFERENCE CODE] · Movies4Water

```
Hi [GUEST NAME]!

Thank you for purchasing a ticket to Movies4Water! Your payment has been confirmed. 🎬💙

[ONE OF THESE TWO SENTENCES:
 With the AR attached: Attached to this email are your entry QR code and Acknowledgment Receipt. Kindly save your QR code and present it upon entry to the cinema for your block screening.
 QR code only: Attached to this email is your entry QR code. Kindly save your QR code and present it upon entry to the cinema for your block screening.]

YOUR CHECK-IN QR CODE
(QR code attached)
Reference code: [REFERENCE CODE]
Seats: [SEATS, as /admin shows them, e.g. Row L · Seats 7, 8, 9]
Show this at the cinema entrance. Can't open it? Just tell our staff your reference code.

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

Should you have any questions or concerns, feel free to contact:

Jenna Escueta
📞 +63 993 502 1347
✉️ jenna@wavesforwater.org

Thank you for supporting Movies4Water and helping bring clean water to communities!

See you at the screening!
Waves For Water Philippines
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

Waves For Water Philippines
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

Waves For Water Philippines
w4wph.movies4water@gmail.com
```

---

## 4. Your check-in QR code (one-time, for bookings confirmed before the QR)

Guests confirmed before the QR code was added to the confirmed email get this
once, from **Tools → Send check-in QR codes** in /admin. Send it by hand only if
/admin says it did not send. Attach the image from **Download QR code**.

**Subject:** Your check-in QR code · [REFERENCE CODE] · Movies4Water

```
Hi [GUEST NAME],

Here's your QR code for check-in on December 19.

YOUR CHECK-IN QR CODE
(QR code attached)
Reference code: [REFERENCE CODE]
Seats: [SEATS, as /admin shows them, e.g. Row L · Seats 7, 8, 9]
Show this at the cinema entrance. Can't open it? Just tell our staff your reference code.

Should you have any questions or concerns, feel free to contact:

Jenna Escueta
📞 +63 993 502 1347
✉️ jenna@wavesforwater.org

Thank you for supporting Movies4Water and helping bring clean water to communities!

See you at the screening!
Waves For Water Philippines
```
