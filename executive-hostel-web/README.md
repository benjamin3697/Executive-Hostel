# Executive Hostel — Frontend

React + TypeScript + Vite, talking to the real API in `executive-hostel-api`. No mock data anywhere — every page calls the real backend.

## Setup
```bash
npm install
npm run dev
```
Runs on http://localhost:5173, proxying `/api/*` to `http://localhost:4000` (see `vite.config.ts`).
Make sure the backend is running first — see its own README for setup (Postgres, migrations, seed data, email/SMS provider keys).

For production, set `VITE_API_BASE_URL` to your deployed API's URL before `npm run build`.

## Real hostel photos

`public/images/hostel-exterior.jpg` and `hostel-walkway.jpg` are real photos of Executive Hostel (cropped to remove phone-gallery UI chrome, auto-contrast applied). Used as the homepage hero background, a compound gallery image on the homepage, and a header image on the Apply page. Replace these two files directly if you get better/official photos later — same filenames, same usage sites.

## Pages built

**Public (no login):**
- Home ("boys' hostel for male students of Soroti University"), Available Rooms (real vacancy + current fee data), Apply for Accommodation (10-digit registration number validation, required Rules & Regulations acceptance checkbox), Contact, Guidelines (now seeded with the hostel's real 15-category rules — see backend README)

**Auth:**
- Login (with account-lockout messages surfaced from the backend), Forgot Password, Reset Password

**Student:**
- Dashboard, Submit Payment (full evidence-upload flow via presigned POST — file never touches our server; bank/payment details shown here require login + an assigned room, no longer public), Payment History, Profile, Maintenance (submit + view own), Announcements, Notifications (with unread badge in the nav bar)

**Administrator / Landlady:**
- Room Management — grid with filters, a real student picker to **assign** a vacant room, and **check-in/check-out** actions
- Students — a real spreadsheet-style table (name, registration number, room, course, year, semester, fee, paid, balance, payment status, residency status), filterable by any of section/room type/status/year/course/semester/payment status simultaneously, with a one-click **Export CSV**. Click any row for that student's full detail (contact info, full payment history, whether they've agreed to the Rules & Regulations) with **Semester Enrollment** (assign them into a regular or recess semester — this is what drives which fee and which payments count toward their current balance) and a **Correct** action on any verified payment
- Applications — review, **Approve** (provisions the account and emails/SMSes login credentials automatically), Reject/Waitlist/Under Review
- Payment Verification — Approve/Reject/Request Clarification against the real queue
- Announcements — publish with real **section/room/year audience targeting** (not just "all residents")
- Maintenance — manage status (submitted → in progress → resolved → closed)
- Reports — occupancy, financial, "who hasn't paid" with a working CSV export link
- Settings — payment/bank info (shown to authenticated staff only), contacts, guidelines editor, **Academic Calendar** (create academic years and semesters, marked regular or recess), **Accommodation Fees** (create semester-specific or default fees per room type)
- Audit Log — filterable history of every payment verification, room change, and permission change, with who/when/before/after

Verified before every handoff: full TypeScript compile, a production build, and the dev server actually serving every route — checked for real each round, not assumed.

## Account credential delivery

When an admin approves an application or a student requests a password reset, the backend delivers credentials automatically:
1. **Email** (via Resend) if the account has an email on file.
2. **SMS** (via Africa's Talking, with Ugandan phone number normalization) if not.
3. Only if *neither* provider is configured does the API return the plaintext password/token in the response, as a local-dev fallback — `AdminApplications.tsx` shows it in that case only, with the exact reason from the backend.

See the backend README for provider setup (both have workable free tiers).

## What's still not built
- **Mobile device testing** — layouts use responsive CSS grid (`auto-fit`/`auto-fill`) throughout and have been checked via viewport-width HTTP smoke tests, but not on an actual phone. Worth a real pass before go-live.
- **Payment-submitted notifications for admins are in-app only** — students get real email/SMS on payment verified/rejected/clarification/corrected, but admins are only notified in-app when a student submits a payment, since they already have the dashboard/bell for that.
- **Rate-limit / lockout visibility for admins** — if a student's account gets locked (5 failed logins), there's currently no admin screen to see or manually clear that; it self-clears after 15 minutes.
- **Semester auto-rollover** — enrolling students into a new semester is currently a one-by-one admin action per student (Students page → Semester Enrollment). At scale (72 rooms, every semester changeover) a bulk "enroll all active residents into X" action would save real time — worth building once the one-by-one flow has been used for a semester or two and the exact bulk workflow you want is clear.

