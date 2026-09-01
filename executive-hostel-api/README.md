# Executive Hostel API

Backend for the Executive Hostel Management System (Soroti University).
Reference: `executive-hostel-design-docs.md` (schema, RBAC matrix, API spec, security architecture).

## What's built (Phase 1 — Auth & Profiles, Phase 3-4 — Rooms & Allocation)

### Rooms & Allocation
- `GET /api/v1/rooms/available` — public, vacant rooms only, no occupant data (docs Section 35).
- `GET /api/v1/rooms` — admin/landlady, full grid with `section`/`type`/`status` filters and occupant names.
- `GET /api/v1/rooms/:id` — admin/landlady, full detail + recent assignment history.
- `POST /api/v1/rooms/:id/assign` — the core allocation transaction (`src/services/room-allocation.service.ts`). Enforces one-room-one-student atomically: checks the room is vacant, checks the student has no active room, then updates both sides and writes a `RoomAssignment` row, all inside one `prisma.$transaction` so a race between two simultaneous assign requests can't double-book a room.
- `POST /api/v1/rooms/:id/checkin` — records physical arrival, sets student status to `active`.
- `POST /api/v1/rooms/:id/checkout` — releases the room (back to `vacant`), closes the `RoomAssignment`, preserves history (nothing is deleted).
- `PATCH /api/v1/rooms/:id/status` — admin-only status changes (e.g. into `under_maintenance`); deliberately blocks setting `occupied` directly (must go through `/assign`) and blocks changing status while a room has an active occupant.

**Note on `Prisma.TransactionClient` typing:** this sandbox couldn't reach `binaries.prisma.sh` to run `prisma generate`, so the type-check above ran against Prisma's un-generated stub client. A local type alias for `RoomStatus` is included in `room-allocation.service.ts` so the project compiles either way — once you run `npm install && npx prisma generate` against your real `DATABASE_URL`, Prisma will generate full types matching `schema.prisma` and you can delete that local alias in favor of `Prisma.RoomStatus` if you'd like (optional — both work identically).


- Full Prisma schema for the entire system (all Phase 1–13 tables), so later phases are additive migrations, not rewrites.
- `POST /api/v1/auth/register` — student self-registration (argon2id password hashing).
- `POST /api/v1/auth/login` — returns short-lived access token + rotating refresh token.
- `POST /api/v1/auth/refresh` — rotates refresh tokens.
- `POST /api/v1/auth/logout` — revokes a refresh token.
- `GET /api/v1/me` / `PATCH /api/v1/me/profile` — student profile, with locked fields enforced server-side (room, fees, payment status, etc. are NOT editable here — see docs Section 27).
- RBAC middleware (`requireRole`, `requirePermission`, `requireSelfOrRole`) ready for every future route.
- Audit logging wired into register/login/profile-update as the pattern to follow for every future mutation.
- Rate limiting on auth endpoints, Helmet, CORS allowlist, centralized error handler.

## Setup

1. **Install Node.js 20+** if you don't have it.
2. **Get a Postgres database.** Fastest options to start: [Neon](https://neon.tech) or [Supabase](https://supabase.com) (both have free tiers and give you a `DATABASE_URL` immediately). For production, any managed Postgres works.
3. ```bash
   npm install
   cp .env.example .env
   ```
   Edit `.env`:
   - Paste your `DATABASE_URL`.
   - Generate two separate secrets: `openssl rand -hex 32` (run it twice) for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
4. ```bash
   npm run prisma:migrate   # creates all tables from schema.prisma
   npm run seed              # creates the 2 sections, 72 rooms, 2 room types, default fees
   npm run dev                # starts the API on http://localhost:4000
   ```
5. Sanity check: `curl http://localhost:4000/health` → `{"status":"ok"}`

## Try it

```bash
# Register a student
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Namono Sarah","registrationNumber":"SU/BSC/2023/0142","email":"sarah@example.com","password":"correcthorsebattery"}'

# Log in
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"sarah@example.com","password":"correcthorsebattery"}'
# -> { accessToken, refreshToken, role }

# Get own profile
curl http://localhost:4000/api/v1/me -H "Authorization: Bearer <accessToken>"
```

To create the first **administrator** account, don't expose a public "become admin" endpoint — the cleanest approach for now is running one `prisma.user.update({ where: { id }, data: { role: "administrator" } })` via `npm run prisma:studio` or a one-off script, after registering normally as a student. A proper `/admin/users` management endpoint is Phase 2 work.

### Students (Phase 2)
- `GET /api/v1/students` — admin/landlady. Filters: `q` (name/reg number/phone), `section`, `roomType`, `status`, `year`, `course`, `semesterId`, `paymentStatus` (`fully_paid`/`partially_paid`/`outstanding`/`no_active_accommodation`), plus pagination (`page`, `pageSize` — default 100, comfortably covering the hostel's full 72-room capacity in one page for the frontend's table view). Each row includes a computed `payment` summary (fee/paid/balance/status) via `getStudentBalanceSummary()`, which is what powers the admin table's Fee/Paid/Balance columns without a separate request per student. `paymentStatus` is filtered in-memory after fetching (it's computed, not a stored column) — fine at this hostel's scale, but see the code comment in `students.routes.ts` for the trade-off if you ever run a much larger property.
- `GET /api/v1/students/:id` — admin/landlady, or the student viewing their own record (via `requireSelfOrRole`).
- `PATCH /api/v1/students/:id` — admin-only, and deliberately limited to the fields docs Section 27 allows admins to edit directly (name, course, year, status, contact info). Room, fees, and payment status are excluded on purpose — those change only through `/rooms/:id/assign`, `/rooms/:id/checkout`, and the payment-verification endpoints, each of which writes its own audit trail.

### Staff accounts & permissions (Phase 2)
- `GET/POST /api/v1/admin/users` — list/create administrator, landlady, and chairperson accounts. Restricted to the landlady, or an administrator explicitly holding `manage_users` — administrators can't grant themselves or each other new staff accounts by default (docs Section 45).
- `PATCH /api/v1/admin/users/:id/permissions` — grant/revoke granular permission keys (`verify_payments`, `manage_fees`, `manage_users`, `manage_settings`, etc.) on a `UserPermission` row. This is what lets you give the chairperson announcements-only access while giving one admin payment-verification rights without fee-editing rights.
- `PATCH /api/v1/admin/users/:id/deactivate` — disable an account without deleting it (a user can't deactivate themselves).

### Fees (Phase 5)
- `GET /api/v1/fees/current` — public. Current effective amount per room type (needed by the public accommodation pages and application form).
- `GET /api/v1/fees/history` — admin/landlady. Full versioned history.
- `POST /api/v1/fees` — admin (with `manage_fees` permission) or landlady. **Always creates a new row**, never updates an old one — so a payment made last semester keeps referencing the fee that was actually in effect then, even after prices change (docs Section 55).

## Permission keys used so far
Grant these via `PATCH /admin/users/:id/permissions` as your team's roles need them:
- `manage_users` — provision/deactivate staff accounts, grant permissions
- `manage_fees` — create new accommodation fee rows
- `verify_payments` — will gate the payment-verification endpoints in Phase 7 (not built yet)
- `manage_settings` — will gate bank/contact/settings endpoints in Phase 13 (not built yet)

The landlady role bypasses all permission checks implicitly — it's the one role that's always "everything," matching docs Section 44.

## File storage (Backblaze B2, free tier)

Payment evidence uploads go straight from the student's browser to a private bucket via a presigned POST — the file bytes never pass through this API server. Set up:

1. Sign up at [backblaze.com/b2](https://www.backblaze.com/cloud-storage) — free tier is 10GB storage + 1GB/day download, no card required.
2. Create a bucket and set it to **Private** (not public) — this is non-negotiable, it's where payment screenshots live.
3. Create an Application Key scoped to just that bucket.
4. Copy the endpoint/region shown on the bucket page into `.env` (see `.env.example` — the values look like `https://s3.us-west-004.backblazeb2.com` / `us-west-004`).

Because the code talks to B2 through its S3-compatible API (`src/lib/storage.ts`), switching to DigitalOcean Spaces or AWS S3 later is just different `.env` values — no code changes. If B2's free tier ever gets tight (very unlikely at 72 rooms' worth of payment screenshots), putting Cloudflare in front of the bucket makes B2→Cloudflare egress free/unlimited under their Bandwidth Alliance.

## Email delivery (Resend, free tier)

Password resets and application-approval credentials are sent by email when the account has one on file.

1. Sign up at [resend.com](https://resend.com) — free tier is 100 emails/day / 3,000/month, no card required.
2. Verify a sending domain (or use their shared onboarding domain while testing).
3. Create an API key, put it in `.env` as `RESEND_API_KEY`, and set `EMAIL_FROM` to your verified sender.

If `RESEND_API_KEY` is left blank, emails are logged to the server console instead of sent — fine for local dev, **not acceptable for production**.

## SMS delivery (Africa's Talking, free sandbox)

For accounts with no email on file (phone is the only required contact field on the application form, so this is the more common case), the same two flows fall back to SMS.

1. Sign up at [africastalking.com](https://africastalking.com) — the sandbox environment is free and good enough to test the full flow before you need a paid production account.
2. Create an app, get your API key, set `AT_API_KEY` and `AT_USERNAME` in `.env`.

Phone numbers are normalized to E.164 (`+256...`) automatically — students commonly enter local format (`07XXXXXXXX`); see `src/lib/sms.ts` and its test suite (`tests/phone-normalization.test.ts`).

If `AT_API_KEY` is blank, SMS is logged to the console instead of sent — same fallback behavior as email.

**Delivery priority for both flows:** email first if available, then SMS, and the API only ever returns a plaintext password/token in its response if *neither* provider is actually configured — that's the local-dev fallback, not something that should happen in production once both are set up.

## Payments (Phase 6 & 7)



Implements the full workflow from docs Section 12–21:

- `POST /api/v1/payments/evidence-upload-url` — student calls this first; returns a presigned POST `{ url, fields }` for direct upload to the bucket. Enforces file type (`image/*` or `application/pdf`) and an 8MB size cap (`S3_MAX_UPLOAD_BYTES`) **at the bucket policy level**, not just in application code — a request that doesn't match gets rejected by B2 itself.
- `POST /api/v1/payments` — student submits the payment record referencing the uploaded evidence key(s). Always created as `status: pending`; `previousBalance` is snapshotted but the student's verified balance is untouched until an admin acts. Notifies every landlady/permissioned-admin.
- `GET /api/v1/payments/me/summary` — the exact breakdown from docs Section 21: fee, verified paid, pending amount, outstanding balance, status label (`fully_paid`/`partially_paid`/`outstanding`).
- `GET /api/v1/payments/me` — student's own payment history.
- `GET /api/v1/payments` — admin/landlady queue, filters: `status`, `section`, `dateFrom`, `dateTo`, pagination.
- `GET /api/v1/payments/:id` — owning student or admin/landlady; evidence files are resolved to short-lived (2 min) signed URLs generated fresh per request, never stored or cached.
- `POST /api/v1/payments/:id/verify` — requires the `verify_payments` permission (or landlady). Runs in a transaction: recomputes the student's verified total and remaining balance, snapshots the fee that applied, writes the audit log, notifies the student. Refuses to run on anything but a `pending`/`clarification_requested` payment — **a verified payment can never be re-verified or silently changed** (docs Section 47); corrections go through the separate `PaymentCorrection` model (not yet wired to an endpoint — add one only if you actually need it, since it should be rare and heavily logged).
- `POST /api/v1/payments/:id/reject` — requires a `reason` string; refuses on an already-verified payment.
- `POST /api/v1/payments/:id/request-clarification` — requires a `message`; sets `clarification_requested`, which the student can still act on (resubmit) unlike a hard rejection.

## Try the full payment flow

```bash
# 1. Student requests an upload slot
curl -X POST http://localhost:4000/api/v1/payments/evidence-upload-url \
  -H "Authorization: Bearer <studentAccessToken>" -H "Content-Type: application/json" \
  -d '{"fileType":"image"}'
# -> { key, url, fields, allowedContentTypes, maxBytes }

# 2. Student's browser POSTs the actual file straight to B2 using `url` + `fields` (multipart/form-data, file field must be named "file", added last)
#    This step happens client-side - see the presigned POST docs for AWS S3 (B2 uses the same protocol) for the exact form shape.

# 3. Student submits the payment referencing that key
curl -X POST http://localhost:4000/api/v1/payments \
  -H "Authorization: Bearer <studentAccessToken>" -H "Content-Type: application/json" \
  -d '{"amount":300000,"paymentMethod":"bank","paymentDate":"2026-08-25T00:00:00.000Z","transactionReference":"FT26082512345","evidence":[{"key":"<key from step 1>","fileType":"image"}]}'

# 4. Admin (with verify_payments permission) reviews the queue
curl http://localhost:4000/api/v1/payments?status=pending -H "Authorization: Bearer <adminAccessToken>"

# 5. Admin approves it
curl -X POST http://localhost:4000/api/v1/payments/<paymentId>/verify -H "Authorization: Bearer <adminAccessToken>"

# 6. Student checks their updated balance
curl http://localhost:4000/api/v1/payments/me/summary -H "Authorization: Bearer <studentAccessToken>"
```

## Applications (Phase 9)

- `POST /api/v1/applications` — public, rate-limited (5/hour per connection — it's an easy spam target). Creates an `Application` row, `status: submitted`.
- `GET /api/v1/applications` — admin/landlady, filters: `status`, `section` (by `preferredSectionId`), `roomType`, pagination.
- `GET /api/v1/applications/:id` — admin/landlady detail.
- `POST /api/v1/applications/:id/approve` — the interesting one. Provisions a real `User` + `Student` account in a transaction (checks for a colliding registration number/email/phone first), marks the application `approved`, and **emails or SMSes the login credentials directly to the applicant** (see Email/SMS delivery sections above) rather than returning them in the response. Returns `{ studentId, userId, deliveryMethod, message }` — `deliveryMethod` is `"email"`, `"sms"`, or `"manual"` (the last only if neither provider is configured, in which case `temporaryPassword` is also included as a local-dev fallback). That `studentId` plugs directly into the already-built `POST /rooms/:id/assign`.
- `POST /api/v1/applications/:id/decision` — `under_review` / `rejected` / `waitlisted` / `cancelled`. Refuses to touch an already-`approved` application (it has a live student account by then; changing its status here wouldn't undo that).

## Verified against a real database

Rather than trust the type-checker alone, we stood up a real local PostgreSQL 16 and confirmed:
- The full SQL schema (`docs/executive-hostel-design-docs.md` Section 4) applies with zero errors — this caught and fixed two real ordering bugs (`students.semester_id` referenced `semesters` before it existed; the `rooms`↔`students` circular FK wasn't handled). `schema.prisma` itself didn't have this problem — Prisma's migration engine resolves circular references automatically; only the hand-written SQL needed the fix.
- **The one-room-one-student constraint is enforced by Postgres itself**, not just application code — directly tested by trying to double-book a room and trying to give one student two rooms; both were rejected with real unique-constraint violations.
- The payment balance math matches the docs' worked example exactly, including that pending payments never affect the balance and overpayment never goes negative.

What wasn't verified end-to-end: an actual live HTTP request through the running app. This sandbox couldn't reach `binaries.prisma.sh`, which the Prisma CLI needs for `generate`/`migrate` on every version tested — that's an environment limitation here, not a defect in the project. Run `npm install && npx prisma migrate dev && npm run seed && npm run dev` on your own machine to complete that step.

## What's built now (summary)

Phases 1–13 are complete: auth (with account lockout + password reset), profiles, rooms & allocation, fees, payment submission & verification, student dashboard, applications (with automatic email/SMS credential delivery), announcements, maintenance, reports, settings/contacts/guidelines, audit log, and notifications.

## What's genuinely left

- **Phase 14/15/16 process work** — the code-level pieces (rate limiting, lockout, Docker, tests) are done; what's left is genuinely operational: getting a real domain + HTTPS in front of the deployed API, setting up automated Postgres backups on your hosting provider, and a first real-device (not just viewport-width) mobile pass on the frontend.
- **Admin visibility into account lockouts** — if a student's account locks after 5 failed logins, there's no admin screen to see or clear it early; it self-clears after 15 minutes.

## Real-world business rules (added from the hostel's actual Rules & Regulations + operator input)

**If you already have a database running**, this round of changes needs a migration:
```bash
npx prisma migrate dev --name semester_types_terms_acceptance
```
This adds the `semester_type` enum, `semesters.type`, `students.terms_accepted_at`, and `applications.terms_accepted_at` — all additive, nothing destructive, verified against a real Postgres instance before being handed to you.

### Registration number format
10 digits, first 2 = year of entry (e.g. `2301600084` = entered 2023). Enforced with a shared regex (`src/lib/validation.ts`) on both self-registration (`POST /auth/register`) and the public application form (`POST /applications`, when a registration number is provided — it's optional there since a prospective applicant may not have one assigned yet).

### Semester-scoped fees and balances — a real correctness fix, not just a feature
This closes an actual bug: previously, a student's balance summed **every verified payment they'd ever made** against whatever fee happened to be current. That's wrong the moment a student has more than one semester of history — a student who fully paid Semester 1 would show as "fully paid" for Semester 2 too, having paid nothing toward it.

Now:
- `Semester` has a `type`: `regular` or `recess` (a year has 2 regular semesters + 1 recess, per the hostel's actual calendar — recess commonly costs less).
- `Student.semesterId` is the student's **current enrollment**, set by an admin via `POST /students/:id/enroll` (Students page → click a student → Semester Enrollment). This is the missing "enroll students into a new semester" workflow that was flagged as absent.
- `getCurrentFeeForStudent()` looks up a fee scoped to (room type + current semester) first, falling back to the room type's semester-agnostic default if no semester-specific fee has been configured. **The 500k/650k defaults you configured remain exactly that — the fallback default** — nothing is invented for recess pricing; an admin sets a lower recess fee explicitly via `POST /fees` (Settings → Accommodation Fees) when ready.
- `getStudentBalanceSummary()`, `verifyPayment()`, and `correctPayment()` all now scope to `Payment.semesterId` (stamped on each payment at submission time from the student's *current* enrollment), not the student's lifetime payment history. Verified against real data — see the git history / conversation for the exact before/after query proof.
- Backward compatible: a student not yet enrolled in any semester (`semesterId: null`, true for anyone before an admin runs the enrollment step) falls back to the original lifetime-cumulative behavior, so nothing breaks for students created before this feature existed.

New endpoints: `GET/POST /academic-years`, `GET/POST /semesters` (`src/routes/academic.routes.ts`), `POST /students/:id/enroll` (`src/routes/students.routes.ts`).

### Payment/bank info is no longer public
`GET /settings/public` is gone. In its place, `GET /settings/payment-info` requires authentication and — for students — an assigned room (`currentRoomId` set). Staff can always see it for reference. This was flagged directly: exposing bank account details on an unauthenticated endpoint is exactly the kind of thing a scammer could scrape to stand up a lookalike "how to pay" page using your real account details. The frontend's public `/payment-info` page and nav links are removed entirely; `SubmitPayment.tsx` (already authenticated) is the only place this now renders.

### Terms acceptance (digital "Undertaking by the Resident")
The uploaded PDF's undertaking form has a digital equivalent: `Application.termsAcceptedAt` / `Student.termsAcceptedAt`, set when the required `termsAccepted` checkbox is submitted on the public Apply form (and copied over to the `Student` record at approval). Also required on the self-registration endpoint for API consistency, though that path isn't exposed in the frontend UI (Applications is the actual front door).

### Boys' hostel
No hard schema enforcement (no gender field is collected) — this is reflected as copy on the public Home and Apply pages ("boys' hostel for male students of Soroti University"), which is the appropriate level of enforcement for something that's a facility-level fact, not a data validation rule.

### Real hostel guidelines seeded
`prisma/seed.ts` now seeds all 15 rule categories transcribed from the hostel's actual uploaded Rules & Regulations PDF (previously the Guidelines table was empty, per docs Section 41's "don't invent rules, provide an editor for the real ones" — these ARE the real ones now). The source PDF was scanned/OCR'd with some page-rotation artifacts; the transcription was cleaned up for readability but is worth a spot-check against the original before relying on it for a disciplinary decision.

### Removed number-input spinners
Money fields (payment amount) now use a numeric text input instead of `type="number"`, and a global CSS rule (`theme.css`) hides the increment/decrement spinner buttons on any remaining native number inputs project-wide.

## Automated backups (GitHub Actions → Backblaze B2)

`.github/workflows/backup.yml` runs `pg_dump` every night and uploads a gzipped dump to a dedicated B2 bucket, deleting anything older than 30 days.

**Setup:**
1. Create a **second, separate** B2 bucket (e.g. `executive-hostel-backups`) — don't reuse the payment-evidence bucket. Backups need delete permission for pruning; evidence doesn't, so keeping them apart limits what a leaked backup credential could do.
2. Create a B2 Application Key scoped to just that bucket.
3. In your GitHub repo → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `DATABASE_URL` | Your production connection string (same one Render uses) |
| `BACKUP_S3_ENDPOINT` | e.g. `https://s3.us-west-004.backblazeb2.com` |
| `BACKUP_S3_BUCKET` | `executive-hostel-backups` |
| `BACKUP_S3_ACCESS_KEY_ID` | From the backup bucket's Application Key |
| `BACKUP_S3_SECRET_ACCESS_KEY` | From the backup bucket's Application Key |

4. Push this to GitHub — the workflow starts running on its schedule automatically. You can also trigger it manually anytime from the **Actions** tab (useful right before a risky change, like a migration).

**To restore from a backup:**
```bash
# Download the dump from B2 (via the bucket's web UI, or aws-cli), then:
gunzip -c executive-hostel-2026-08-31_02-00-00.sql.gz | psql "<target DATABASE_URL>"
```
Restore into a **fresh, empty database** — running this against a database that already has data will conflict on primary keys. If you're restoring to recover from a real incident, provision a new Neon database first, restore into that, then point `DATABASE_URL` at it.

This workflow was YAML-validated and its date-pruning logic tested directly in this sandbox before being handed to you — not just written and assumed correct.

## Payment corrections (docs Section 47)

`POST /api/v1/payments/:id/correct` — the only way to change a **verified** payment's amount. Requires `verify_payments` permission (same trust boundary as approving payments). Body: `{ reason, newAmount }`.

Every correction:
1. Writes a `PaymentCorrection` row (previous amount, new amount, reason, who, when) — the original `Payment` row's history is never deleted, just its `amount` field updated.
2. Recomputes that payment's balance snapshot using the same calculation as verification.
3. Writes an `AuditLog` entry.
4. Notifies the student, in-app and via email/SMS.

Restricted to `verified` payments only — `pending`/`rejected` ones don't need this machinery, since nothing's been counted toward the balance yet. There's no generic `PATCH /payments/:id` by design; this is the sole path for changing a number that's already been counted as real money received.

## Notification delivery (email/SMS) — now covers routine events too

Beyond password reset and application approval, these now also send real email/SMS (not just an in-app `Notification` row), using the same `notifyByEmailOrSms()` helper in `src/services/notify.service.ts`:
- Payment verified / rejected / clarification requested (`src/services/payment.service.ts`)
- Maintenance request status changed (`src/routes/maintenance.routes.ts`)
- Targeted announcements (section/room/year) with `important` or `urgent` priority (`src/routes/announcements.routes.ts`)

Deliberately **not** sent by email/SMS: `"all"`-audience announcements (could be dozens of students per notice — would burn through the Resend/Africa's Talking free tiers fast) and `normal`-priority targeted announcements. Both still create in-app notifications, visible on `/notifications`. If you outgrow the free tiers or want "all" announcements delivered too, that's a one-line change in `announcements.routes.ts` plus upgrading the provider plan.

All three integration points send **after** their database transaction commits, never inside it — an email provider hiccup should never be able to fail a payment verification.

## Try the room allocation flow

```bash
# As an admin (after promoting your account - see above), list vacant rooms
curl http://localhost:4000/api/v1/rooms?status=vacant \
  -H "Authorization: Bearer <adminAccessToken>"

# Assign a room to a student
curl -X POST http://localhost:4000/api/v1/rooms/<roomId>/assign \
  -H "Authorization: Bearer <adminAccessToken>" -H "Content-Type: application/json" \
  -d '{"studentId":"<studentId>"}'

# Try assigning the same room to a second student -> should fail with ROOM_NOT_VACANT
# Try assigning a second room to the same student -> should fail with STUDENT_ALREADY_ASSIGNED
```

## Try staff provisioning and fees

```bash
# As the landlady, create an administrator with payment-verification rights
curl -X POST http://localhost:4000/api/v1/admin/users \
  -H "Authorization: Bearer <landladyAccessToken>" -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"correcthorsebattery","role":"administrator","permissions":["verify_payments"]}'

# Check current fees (public)
curl http://localhost:4000/api/v1/fees/current

# Introduce a fee change effective at the start of next semester
curl -X POST http://localhost:4000/api/v1/fees \
  -H "Authorization: Bearer <landladyAccessToken>" -H "Content-Type: application/json" \
  -d '{"roomTypeId":"<roomTypeId>","amount":700000,"effectiveDate":"2027-01-06T00:00:00.000Z"}'
```

Every new route should follow the pattern in `me.routes.ts`: Zod validation → ownership/permission check via the middleware in `src/middleware/` → `recordAudit(...)` on any mutation.
