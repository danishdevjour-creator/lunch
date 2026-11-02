# Lunch Budget Dashboard

Company lunch budget: members add karo, deposits aur lunch kharcha track karo, balance kam/khatam hone par automatic email, aur members JazzCash ya Meezan Bank se payment kar sakte hain.

## Run

```bash
npm install
cp .env.example .env     # phir .env edit karein
npm start
```

Dashboard: http://localhost:3000 (password = `.env` mein `ADMIN_PASSWORD`). Node.js 22.13+ zaroori hai (built-in SQLite use hota hai, data `data/lunch.db` mein save hota hai).

## Features

- **Members**: add/edit/deactivate. Har member ka deposited, spent, remaining balance aur status (OK / Low / Finished).
- **Record lunch**: date, members select karein, per-person amount ya total bill split. Sab ke balance se kat jata hai. Lunch delete karne par refund.
- **Payments**: cash/manual deposit record karein. Members ki bheji hui payments "Pending" mein aati hain, Approve/Reject karein.
- **Emails** (automatic):
  - Balance "Low balance alert" amount (Settings) tak girne par aik dafa
  - Balance 0 ya kam hone par "balance khatam" email
  - Payment approve hone par receipt
  - Har member ke saath manual "Email" button
  - Har email mein member ka personal payment link hota hai
- **Member payment page** (`/pay.html?m=<token>`, "Pay link" button se copy karein): member apna balance aur history dekhta hai aur pay karta hai:
  - **JazzCash**: online checkout (agar merchant credentials set hain), ya JazzCash number par bhej kar TID enter kare
  - **Meezan Bank**: online gateway (agar credentials set hain), ya account/IBAN par transfer kar ke reference enter kare

## Setup notes

**Email (Gmail):** Google Account mein 2-Step Verification on karein, phir *App passwords* se password banayein aur `SMTP_USER` / `SMTP_PASS` mein daalein. Jab tak SMTP set nahi, emails sirf "Email log" mein `logged` dikhengi.

**JazzCash online:** JazzCash merchant account (https://sandbox.jazzcash.com.pk se sandbox) se Merchant ID, Password, Integrity Salt `.env` mein daalein. Return URL `BASE_URL/api/payments/jazzcash/return` hai, isliye `BASE_URL` public hona chahiye (live server ya ngrok).

**Meezan online:** Meezan Bank se e-commerce payment gateway (IPG) merchant account lena hota hai. Woh username/password aur API URL dete hain, `.env` mein daalein. Return URL `BASE_URL/api/payments/meezan/return` hai.

Online gateways ke bina bhi app poori chalti hai: members manual transfer kar ke reference dete hain aur admin approve karta hai.

Manual JazzCash number aur Meezan account details dashboard ki **Settings** mein daalein.
