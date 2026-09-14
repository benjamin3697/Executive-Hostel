# Executive Hostel Hosting, Costs, and Operations

**Audience:** hostel owners, administrators, and developers  
**Prepared:** 14 September 2026  
**Currency:** USD, with indicative UGX conversion at `USD 1 = UGX 3,700`

## 1. Recommendation

Use the following low-cost production arrangement:

| Part | Provider | Plan | Estimated cost |
|---|---|---|---:|
| Frontend | Vercel | Hobby | `$0/month` |
| API | Render | Starter web service | `$7/month` |
| PostgreSQL database | Neon | Free initially | `$0/month` |
| Private payment evidence and maintenance files | Backblaze B2 | Free allowance initially | `$0/month` initially |
| Transactional email | Resend | Free | `$0/month` |
| Domain | Namecheap or Cloudflare Registrar | `.com` | about `$11-$18/year` |
| SMS | Africa's Talking | Pay as used | Variable |

### Expected budget

**Initial production minimum:**

- Hosting services: approximately **`$7/month`**
- Domain registration in year one: approximately **`$11.28-$14.98`**, depending on promotion and taxes
- First-year total before taxes and SMS: approximately **`$95.28-$98.98`**
- Indicative UGX: approximately **UGX 352,536-366,226**

**Renewal budget from year two:**

- Hosting: approximately **`$84/year`**
- `.com` renewal: budget approximately **`$18.48/year`** at Namecheap's listed standard rate, or the registry/ICANN cost at Cloudflare Registrar
- Total before taxes and SMS: approximately **`$102.48/year`**
- Indicative UGX: approximately **UGX 379,176/year**

These figures are estimates, not an invoice. Providers can change prices, taxes may apply, and the card issuer may use a different exchange rate.

## 2. Why this plan fits this platform

The repository contains:

- A static React/Vite frontend in `executive-hostel-web`.
- A Node.js/Express API in `executive-hostel-api`.
- A Prisma PostgreSQL schema for users, students, rooms, applications, payments, audit logs, and notifications.
- Private S3-compatible storage for payment evidence and maintenance photos.
- Optional email through Resend and optional SMS through Africa's Talking.

The frontend does not need a continuously running server. The API does. Paying for the Render Starter API avoids the free-service sleep behavior that can make logins and payment submissions appear broken after inactivity.

## 3. Important free-tier limitations

Free tiers are useful for testing, but owners should understand these limits:

- **Render Free web service:** suitable for demos, but it can sleep and has limited resources. Do not promise an always-available production service on this tier.
- **Neon Free:** permanent free plan, but currently limited to `0.5 GB` storage, `100 CU-hours/project/month`, and `5 GB` public network transfer. When a limit is reached, compute suspends until the next billing month.
- **Backblaze B2:** keep the evidence bucket private. The current project documentation assumes the free allowance is enough for a small hostel. Monitor stored data and downloads; move to paid usage if the allowance is exceeded.
- **Resend Free:** up to `3,000 emails/month`, with a `100 emails/day` limit. This is normally enough for password resets and application approval messages.
- **Vercel Hobby:** free hosting is intended for personal/non-commercial use according to Vercel's current pricing terms. For an institution's commercial production use, use an approved plan or move the static frontend to another provider whose terms fit the institution.
- **SMS:** Africa's Talking sandbox is for testing. Production SMS is charged by destination, carrier, and message segments. Budget it separately rather than hiding it inside hosting costs.

## 4. Two operating modes

### A. Demonstration mode: lowest possible cash cost

Use free frontend hosting, Render Free API, Neon Free, Backblaze B2 free allowance, and Resend Free.

- Estimated hosting cost: **`$0/month`**
- Domain: approximately **`$11-$18/year`**
- Best for development, demonstrations, and acceptance testing.
- Not recommended for daily student applications or payment operations because the API may sleep and free database/storage limits are not a service-level guarantee.

### B. Production-minimum mode: recommended

Use free frontend, Render Starter API, Neon Free while below its limits, B2 free allowance while below its limits, and Resend Free.

- Estimated hosting cost: **`$7/month`**
- Domain is paid separately each year.
- Upgrade the database before it reaches its limits or before the owners need stronger backups, history, or support.
- Configure the database backup workflow already documented in the API README and keep backups in a separate private B2 bucket.

## 5. Costs not included in the totals

The following are operational or business costs rather than fixed hosting costs:

- SMS messages and sender registration, if required.
- Payment gateway or bank transaction charges, if online payments are added later.
- Developer implementation, support, monitoring, and incident response.
- Taxes, VAT, card charges, and foreign-exchange fees.
- Paid database/storage usage after free limits.
- A paid Vercel plan if the institution's commercial use requires it.
- A second domain, branded mailbox service, or paid backup retention.

Email delivery does not automatically provide a mailbox such as `admin@domain.com`; Resend is a transactional sending service. Add a mailbox provider only if staff need to receive and send normal office email from the domain.

## 6. Domain plan

1. Register a short, institution-controlled domain such as `executivehostel.example` or the approved institutional domain.
2. Put the domain account, billing email, recovery email, and two-factor authentication under the hostel/institution, not an individual developer.
3. Prefer a registrar with transparent renewal pricing. Namecheap currently lists `.com` registration around `$11.28` on sale and renewal around `$18.48`; Cloudflare Registrar advertises registration and renewal at registry cost where the TLD is supported.
4. Use the root domain for the frontend, for example `https://portal.example.com` or `https://executivehostel.example`.
5. Use a separate API hostname, for example `https://api.example.com`.
6. Enable automatic renewal and record the renewal date in the owners' calendar.

Hosting providers supply HTTPS certificates. Do not purchase a separate SSL certificate unless a provider specifically requires it.

## 7. Deployment architecture

```text
Student/Admin browser
        |
        | HTTPS
        v
Frontend: Vercel Hobby
        |
        | VITE_API_BASE_URL
        v
API: Render Starter
        |
        +--> Neon PostgreSQL via DATABASE_URL
        +--> Backblaze B2 private bucket via S3 credentials
        +--> Resend for email (optional but recommended)
        +--> Africa's Talking for SMS (optional and usage-billed)
```

Payment evidence is uploaded directly from the browser to the private B2 bucket using a short-lived signed URL. The API stores the object key and creates short-lived download URLs after authorization checks.

## 8. Owner responsibilities

Owners or the designated operations manager must:

- Own the registrar, Vercel, Render, Neon, Backblaze, Resend, GitHub, and SMS accounts.
- Keep billing details and recovery methods current.
- Require two-factor authentication on every provider account.
- Approve who can access student data and payment evidence.
- Confirm the accommodation fees, bank/payment instructions, room inventory, and hostel rules before launch.
- Review monthly provider usage and invoices.
- Ensure database backups are running and periodically test a restore.
- Report suspected account compromise immediately and rotate affected credentials.
- Approve production releases and maintain a named emergency contact.

Never store provider passwords, JWT secrets, database URLs, or S3 secret keys in the repository or in screenshots.

## 9. Developer deployment runbook

### 9.1 Create services

1. Create a GitHub repository containing this project.
2. Create a Neon PostgreSQL project and copy its pooled or direct `DATABASE_URL` as appropriate for Prisma.
3. Create a private Backblaze B2 bucket for evidence.
4. Create a second private B2 bucket for database backups.
5. Create a Resend account and verify the sending domain if email is enabled.
6. Create a Render Web Service for `executive-hostel-api` using the API directory as the root directory.
7. Create a Vercel project for `executive-hostel-web` using the web directory as the root directory.

### 9.2 Render API settings

Use:

```text
Build command: npm install && npm run build && npx prisma migrate deploy
Start command: npm start
Plan: Starter
```

Set these required environment variables:

```text
DATABASE_URL=<Neon connection string>
JWT_ACCESS_SECRET=<random secret>
JWT_REFRESH_SECRET=<different random secret>
CORS_ORIGINS=https://<frontend-domain>
NODE_ENV=production
S3_ENDPOINT=<Backblaze S3 endpoint>
S3_REGION=<Backblaze region>
S3_BUCKET=<private evidence bucket>
S3_ACCESS_KEY_ID=<bucket-scoped key>
S3_SECRET_ACCESS_KEY=<bucket-scoped secret>
S3_MAX_UPLOAD_BYTES=8388608
APP_URL=https://<frontend-domain>
```

Set these only when enabled:

```text
RESEND_API_KEY=<Resend key>
EMAIL_FROM=Executive Hostel <noreply@<verified-domain>>
AT_API_KEY=<Africa's Talking key>
AT_USERNAME=<Africa's Talking username>
```

Generate JWT secrets using a password manager or a cryptographically secure generator. Use two different values.

### 9.3 Vercel frontend settings

Set:

```text
Root directory: executive-hostel-web
Build command: npm run build
Output directory: dist
VITE_API_BASE_URL=https://<api-domain>
```

After deployment, update Render's `CORS_ORIGINS` and `APP_URL` to the final custom frontend URL, then redeploy the API.

### 9.4 First production checks

Run these checks after every first deployment:

```text
GET https://<api-domain>/health
```

Expected response:

```json
{"status":"ok"}
```

Then verify:

- The public rooms page loads.
- A test application can be submitted.
- A student can register or log in.
- An administrator can review an application.
- A payment evidence file uploads to the private bucket.
- An authorized admin can view the evidence through a signed URL.
- An unauthorized user cannot view another student's evidence.
- Password reset email delivery works, if enabled.
- CORS allows the production frontend and rejects unapproved origins.
- Prisma migrations complete before the API starts serving traffic.

Do not use real student or payment data for the first test. Delete test accounts and files after acceptance testing.

## 10. Upgrade triggers

Upgrade or redesign the deployment when any of these occurs:

- Neon reaches `0.5 GB` storage, `100 CU-hours`, or `5 GB` egress on the free plan.
- The API frequently responds slowly after sleeping or reaches Render resource limits.
- B2 evidence storage or downloads exceed the free allowance.
- Email volume exceeds the Resend daily or monthly limit.
- The number of concurrent students grows beyond the free database/API assumptions.
- The owners require a contractual uptime SLA, longer log retention, point-in-time recovery, or managed support.
- A security, privacy, or institutional procurement policy disallows a free-tier service.

The first likely upgrade is the database or API, not the frontend. Keep the storage bucket private and monitor its growth before simply increasing limits.

## 11. Monthly review checklist

- [ ] Check Render service health and deployment history.
- [ ] Check Neon storage, compute, and egress usage.
- [ ] Check B2 stored bytes, downloads, and failed uploads.
- [ ] Check Resend delivery and bounce rates.
- [ ] Confirm the latest database backup exists in the separate backup bucket.
- [ ] Confirm the domain auto-renewal date and payment method.
- [ ] Review administrator accounts and remove staff who no longer need access.
- [ ] Review audit logs for unusual payment, account, or permission activity.
- [ ] Test the health endpoint and one read-only frontend workflow.

## 12. Source pricing pages checked

Prices and limits change. Re-check these pages before purchase or renewal:

- Vercel pricing: https://vercel.com/pricing
- Render pricing: https://render.com/pricing
- Neon pricing: https://neon.com/pricing
- Backblaze B2 pricing: https://www.backblaze.com/cloud-storage/pricing
- Resend pricing: https://resend.com/pricing
- Cloudflare Registrar: https://www.cloudflare.com/products/registrar/
- Namecheap `.com` pricing: https://www.namecheap.com/domains/registration/gtld/com/

## Decision summary

For the lowest practical owner budget, approve **Production-minimum mode at approximately `$7/month`, plus one domain renewal each year and usage-based SMS**. Use the fully free arrangement only while testing. The owners should control every provider account, and developers should deploy using environment variables and the existing migration/backup procedures rather than embedding credentials in source code.
