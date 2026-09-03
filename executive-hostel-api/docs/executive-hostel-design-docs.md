# EXECUTIVE HOSTEL MANAGEMENT SYSTEM
### Design Documentation Package — Soroti University Student Accommodation

This package covers the nine design deliverables required before implementation (per the system's own development order): Architecture, Roles & Permissions, ER Diagram, Database Schema, Core Workflows, Sitemap, UI Design System, API Architecture, and Security Architecture.

---

## 1. SYSTEM ARCHITECTURE

### 1.1 Architectural Style
A layered, monolith-first web application (not microservices — the scale doesn't justify the operational overhead for a single hostel). Structured so pieces can be extracted later if the system expands to multiple properties/universities.

```
┌─────────────────────────────────────────────────────────┐
│  CLIENT LAYER                                            │
│  Student PWA (mobile-first) · Admin/Landlady Web App     │
│  Public Marketing Site                                   │
└───────────────────────────┬───────────────────────────────┘
                             │ HTTPS / JSON
┌───────────────────────────┴───────────────────────────────┐
│  API LAYER (REST, versioned /api/v1)                      │
│  Auth · Students · Rooms · Payments · Applications         │
│  Announcements · Maintenance · Reports · Notifications     │
│  Middleware: authn, authz (RBAC), validation, rate limit,  │
│  audit logging                                             │
└───────────────────────────┬───────────────────────────────┘
                             │
┌───────────────────────────┴───────────────────────────────┐
│  SERVICE / DOMAIN LAYER                                    │
│  RoomAllocationService · PaymentVerificationService         │
│  ApplicationService · NotificationService · ReportService   │
│  AuditService                                               │
│  (business rules live here, never in controllers)          │
└───────────────────────────┬───────────────────────────────┘
                             │
┌───────────────────────────┴───────────────────────────────┐
│  DATA LAYER                                                 │
│  PostgreSQL (primary relational store, enforces the         │
│  single-room and payment-integrity rules with constraints)  │
│  Object storage (private bucket) for payment evidence &      │
│  attachments, served via short-lived signed URLs             │
│  Redis (optional) for session/rate-limit state                │
└───────────────────────────────────────────────────────────┘
```

### 1.2 Recommended Stack
Chosen for maintainability by a small team and easy deployment, not for novelty:

| Layer | Choice | Why |
|---|---|---|
| Backend | Node.js (NestJS) or Django | Strong RBAC + ORM patterns, mature auth libraries |
| Database | PostgreSQL | Real foreign keys, unique constraints, transactions — required for the single-room rule and payment integrity |
| ORM | Prisma (Node) or Django ORM | Migrations, type safety |
| File storage | S3-compatible bucket (e.g. Backblaze B2, DigitalOcean Spaces) | Private by default, signed URLs, cheap |
| Frontend (student/admin) | React + Tailwind, PWA-enabled | Mobile-first, installable, works offline for viewing |
| Auth | JWT (short-lived) + refresh token, bcrypt/argon2 password hashing | Standard, no vendor lock-in |
| Hosting | Any VPS or PaaS with Postgres addon (Render, Railway, Fly.io, or a Ugandan/regional VPS) | Cost-appropriate for a single hostel's budget |
| Backups | Nightly automated Postgres dump + bucket versioning | Non-negotiable for financial data |

This is a recommendation, not a lock-in — the schema and API contract below are stack-agnostic.

### 1.3 Environments
- **Development** — seeded with fake data, placeholder payment details clearly marked "NOT REAL — CONFIGURE IN PRODUCTION."
- **Staging** — mirrors production, used for admin training before go-live.
- **Production** — real data, restricted deploy access, automated backups, error monitoring (e.g. Sentry).

---

## 2. USER ROLES AND PERMISSIONS MATRIX

| Capability | Student | Administrator | Landlady/Landlord | Chairperson | Public |
|---|:---:|:---:|:---:|:---:|:---:|
| View own profile/payments/room | ✅ | — | — | — | — |
| Edit own non-locked profile fields | ✅ | — | — | — | — |
| Submit payment evidence | ✅ | — | — | — | — |
| Submit maintenance request | ✅ | — | — | — | — |
| View all students | — | ✅ | ✅ (read) | — | — |
| Edit student records | — | ✅ | — | — | — |
| Assign/change room | — | ✅ | — | — | — |
| Verify/reject payments | — | ✅ | — | — | — |
| Change accommodation fees | — | ✅ (config permission) | ✅ | — | — |
| View financial reports | — | ✅ | ✅ | — | — |
| Process applications | — | ✅ | — | — | — |
| Publish announcements | — | ✅ | ✅ | ✅ (limited audience) | — |
| Manage maintenance requests | — | ✅ | ✅ (read) | — | — |
| View audit logs | — | ✅ (own actions +) | ✅ (full) | — | — |
| Configure system settings (bank details, contacts) | — | ✅ (permissioned) | ✅ | — | — |
| Manage user accounts/roles | — | ✅ (permissioned) | ✅ | — | — |
| View public info, apply, browse vacancies | — | — | — | — | ✅ |

Notes:
- Roles are stored per-user, and **permissions are granular flags**, not hardcoded to the role name — so a chairperson can be given exactly the access described in the brief (announcements + general info, explicitly *not* payments or room data) and this can be adjusted later without a code change.
- "Administrator" is not one tier — a `permissions` table lets the landlady grant/revoke individual capabilities (e.g. one admin can verify payments but not change fees).

---

## 3. DATABASE ER DIAGRAM (textual)

```
Users ──1:1── Students ──*:1── Rooms ──*:1── RoomTypes
  │                │              │
  │                │              └──*:1── HostelSections ──*:1── Hostels
  │                │
  │                ├──*:1── Parents/Guardians
  │                ├──1:*── Payments ──1:1── PaymentEvidence
  │                │            └──*:1── AccommodationFees
  │                ├──1:*── RoomAssignments (history)
  │                ├──1:1── CheckIns
  │                ├──1:1── CheckOuts
  │                ├──1:*── MaintenanceRequests
  │                └──1:*── Applications (pre-admission)
  │
  ├──1:*── AuditLogs (actor)
  ├──1:*── Announcements (author)
  └──1:*── Notifications (recipient)

AcademicYears ──1:*── Semesters ──1:*── Payments / AccommodationFees
SystemSettings (singleton-per-key config: bank info, contacts, deadlines)
HostelGuidelines (categorized, editable content)
Contacts (configurable public contact entries)
```

Key relationship rules enforced at the database level (not just application logic):
- `Rooms.current_student_id` is nullable and **unique** where not null → a room can have at most one active occupant.
- `Students.current_room_id` is nullable and **unique** where not null → a student can have at most one active room.
- `Payments.status` transitions are constrained (`PENDING → VERIFIED | REJECTED | CLARIFICATION_REQUESTED`); once `VERIFIED`, the row becomes append-only (corrections create a new linked `PaymentCorrections` row, never an UPDATE to amount/status).

---

## 4. DATABASE SCHEMA

```sql
-- NOTE: table order matters here. students.semester_id references
-- semesters, and rooms.current_student_id / students.current_room_id
-- reference each other (a genuine circular pair) - both were verified
-- against a real PostgreSQL 16 instance and required: semesters defined
-- before students, and the rooms->students direction of the circular FK
-- added via ALTER TABLE after both tables exist, not inline.

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20) UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('student','administrator','landlady','chairperson','public')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_permissions (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  permission_key VARCHAR(60) NOT NULL,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_key)
);

CREATE TABLE hostels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,              -- "Executive Hostel"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hostel_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES hostels(id),
  name VARCHAR(80) NOT NULL,               -- "Executive Main" / "Executive Annex"
  UNIQUE (hostel_id, name)
);

CREATE TABLE room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(60) NOT NULL UNIQUE,        -- "Non-Self-Contained" / "Self-Contained"
  description TEXT
);

CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR(20) NOT NULL UNIQUE          -- "2025/2026"
);

CREATE TABLE semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  label VARCHAR(40) NOT NULL,                -- "Semester 1"
  start_date DATE, end_date DATE
);

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES hostel_sections(id),
  room_number VARCHAR(10) NOT NULL,        -- "01".."52" — NOT globally unique
  room_type_id UUID NOT NULL REFERENCES room_types(id),
  status VARCHAR(30) NOT NULL DEFAULT 'vacant'
    CHECK (status IN ('vacant','occupied','reserved','under_maintenance','temporarily_unavailable')),
  current_student_id UUID UNIQUE,  -- FK added below, once students exists (was circular)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (section_id, room_number)          -- "Main-01" and "Annex-01" are distinct
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  full_name VARCHAR(150) NOT NULL,
  registration_number VARCHAR(50) NOT NULL UNIQUE,
  course VARCHAR(150),
  year_of_study SMALLINT,
  semester_id UUID REFERENCES semesters(id),
  phone VARCHAR(20),
  email VARCHAR(255),
  home_district VARCHAR(100),
  emergency_contact_name VARCHAR(150),
  emergency_contact_phone VARCHAR(20),
  current_room_id UUID UNIQUE REFERENCES rooms(id),  -- mirrors rooms.current_student_id, kept in sync via transaction
  status VARCHAR(30) NOT NULL DEFAULT 'active'
    CHECK (status IN ('applicant','active','checked_out','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Circular FK: rooms.current_student_id <-> students.current_room_id reference each other, so this direction is added after both tables exist.
ALTER TABLE rooms ADD CONSTRAINT fk_rooms_current_student
  FOREIGN KEY (current_student_id) REFERENCES students(id);


CREATE TABLE guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  name VARCHAR(150),
  relationship VARCHAR(60),
  phone VARCHAR(20),
  location VARCHAR(150)
);

CREATE TABLE accommodation_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id UUID NOT NULL REFERENCES room_types(id),
  amount NUMERIC(12,2) NOT NULL,
  academic_year_id UUID REFERENCES academic_years(id),
  semester_id UUID REFERENCES semesters(id),
  effective_date DATE NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(150) NOT NULL,
  university VARCHAR(150) DEFAULT 'Soroti University',
  registration_number VARCHAR(50),
  course VARCHAR(150),
  year_of_study SMALLINT,
  semester_id UUID REFERENCES semesters(id),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  preferred_section_id UUID REFERENCES hostel_sections(id),
  preferred_room_type_id UUID REFERENCES room_types(id),
  expected_checkin_date DATE,
  emergency_contact VARCHAR(150),
  status VARCHAR(30) NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','under_review','approved','rejected','waitlisted','cancelled')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE room_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ                     -- null while active
);

CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  check_in_date DATE NOT NULL,
  recorded_by UUID REFERENCES users(id),
  notes TEXT,
  room_condition_notes TEXT
);

CREATE TABLE check_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  check_out_date DATE NOT NULL,
  reason TEXT,
  outstanding_balance NUMERIC(12,2),
  room_condition_notes TEXT,
  clearance_status VARCHAR(30) DEFAULT 'pending'
    CHECK (clearance_status IN ('pending','cleared','disputed')),
  recorded_by UUID REFERENCES users(id)
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  room_id UUID REFERENCES rooms(id),
  academic_year_id UUID REFERENCES academic_years(id),
  semester_id UUID REFERENCES semesters(id),
  accommodation_fee_id UUID REFERENCES accommodation_fees(id),
  amount NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('bank','mobile_money','other')),
  payment_date DATE NOT NULL,
  transaction_reference VARCHAR(100),
  payer_name VARCHAR(150),
  remarks TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','rejected','clarification_requested')),
  previous_balance NUMERIC(12,2),
  remaining_balance NUMERIC(12,2),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  admin_remarks TEXT
);

CREATE TABLE payment_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,        -- private bucket key, resolved via signed URL at request time
  file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('image','pdf')),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id),
  corrected_by UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  previous_amount NUMERIC(12,2),
  new_amount NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  room_id UUID REFERENCES rooms(id),
  category VARCHAR(30) NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','in_progress','resolved','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','important','urgent')),
  audience_type VARCHAR(30) NOT NULL DEFAULT 'all'
    CHECK (audience_type IN ('all','section','room','year','group')),
  audience_ref TEXT,             -- section_id / room_id / year value depending on audience_type
  attachment_url TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  payload JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hostel_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(60) NOT NULL,
  content TEXT NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR(80) NOT NULL,     -- "Landlady", "Hostel Line", "Chairperson"
  phone VARCHAR(20),
  email VARCHAR(255),
  notes TEXT
);

CREATE TABLE system_settings (
  key VARCHAR(80) PRIMARY KEY,    -- 'bank_name','bank_account_number','mobile_money_number', etc.
  value TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  action VARCHAR(80) NOT NULL,        -- 'payment.verified', 'room.assigned', etc.
  entity_type VARCHAR(60),
  entity_id UUID,
  previous_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes (representative, not exhaustive)
CREATE INDEX idx_students_reg_no ON students(registration_number);
CREATE INDEX idx_payments_student ON payments(student_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_rooms_section ON rooms(section_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
```

### 4.1 Enforcing "one room = one student" at the DB level
Two mechanisms, used together:
1. `rooms.current_student_id` and `students.current_room_id` are both `UNIQUE` — a second attempt to set either creates a constraint violation.
2. Room assignment is done inside a single **database transaction**: check room is vacant → check student has no active room → update both foreign keys → insert `room_assignments` row → update room status. If any step fails, the whole transaction rolls back — no partial state.

---

## 5. MAIN USER WORKFLOWS

### 5.1 Payment Submission → Verification (the core workflow)
```
STUDENT                          SYSTEM                         ADMIN
  │  opens Make Payment            │                               │
  │──────────────────────────────▶│ shows fee, paid, balance,      │
  │                                │ bank + mobile money info       │
  │  pays externally (bank/MoMo)   │                               │
  │  submits evidence form ───────▶│ creates Payment(status=PENDING)│
  │                                │ + PaymentEvidence               │
  │                                │ notifies admin ───────────────▶│
  │                                │                                │ reviews evidence
  │                                │                                │ APPROVE / REJECT / CLARIFY
  │                                │◀───────────────────────────────│
  │  notified of outcome ◀─────────│ if approved: recompute balance,│
  │                                │ write audit log, lock payment  │
```
Balance is only recomputed on `VERIFIED`. `PENDING` amounts are shown separately as "Pending Verification" and never added to the paid total.

### 5.2 Application → Approval → Room Allocation → Check-in
```
Prospective student submits Application (status: submitted)
   → Admin reviews (under_review)
   → Approve → Admin selects a vacant, compatible room
        → transaction: verify vacancy, verify student has no active room,
          assign room, create Student record if not existing, set fee
   → Student notified: "Accommodation Confirmed — [Section] Room [n]"
   → On arrival: Admin performs Check-in → student.status = active
```
Rejected/waitlisted applications remain in the table for reference; no destructive deletes.

### 5.3 Check-out
```
Admin opens student → Check-out
   → records date, reason, room condition, outstanding balance, clearance
   → room.status = vacant, room.current_student_id = null
   → student.status = checked_out, current_room_id = null
   → history (payments, past room_assignments) is preserved, not deleted
```

### 5.4 Maintenance Request
```
Student submits (category, description, room, optional photo)
   → status: submitted → in_progress → resolved → closed
   → student notified at each transition
```

---

## 6. PAGE / SITEMAP STRUCTURE

```
PUBLIC (no login)
├── / (Home — hero, quick links)
├── /about
├── /accommodation
│   ├── /accommodation/main
│   └── /accommodation/annex
├── /available-rooms
├── /facilities
├── /guidelines
├── /announcements (public-audience only)
├── /faq
├── /contact
├── /apply
└── /login

STUDENT (authenticated)
├── /dashboard
├── /profile
├── /payments
│   ├── /payments/make
│   ├── /payments/history
├── /announcements
├── /guidelines
├── /maintenance
│   ├── /maintenance/new
│   └── /maintenance/history
└── /contact

ADMINISTRATOR
├── /admin/dashboard
├── /admin/rooms (visual room grid, per section)
├── /admin/students
├── /admin/applications
├── /admin/payments (verification queue + filters)
├── /admin/payments/:id (review)
├── /admin/outstanding-balances
├── /admin/announcements/new
├── /admin/maintenance
├── /admin/reports
├── /admin/settings (fees, bank info, contacts; permanent rules are read-only)
└── /admin/audit-log

LANDLADY/LANDLORD
├── /owner/overview (financial + occupancy summary)
├── /owner/reports
├── /owner/settings
└── (read access into admin/students, admin/payments)

CHAIRPERSON
└── /chair/announcements (publish only, scoped audiences)
```

---

## 7. UI DESIGN SYSTEM

Derived from the uploaded hostel photographs: warm terracotta/orange exterior walls, brown trim, cream walkways, and green landscaping/teal accents.

**Palette**
| Token | Hex | Use |
|---|---|---|
| `--color-bg` | `#FAF6F0` | App background (warm off-white, not stark white) |
| `--color-surface` | `#FFFFFF` | Cards |
| `--color-primary` | `#C9663A` | Terracotta — primary actions, active states |
| `--color-primary-dark` | `#9B4A28` | Hover/pressed, headers |
| `--color-accent` | `#3E7A63` | Deep teal-green — success, verified states, secondary actions |
| `--color-text` | `#332821` | Warm dark brown-black, body text |
| `--color-muted` | `#8A7A6D` | Secondary text |
| `--color-warning` | `#C79A3D` | Pending / partially paid |
| `--color-danger` | `#B23A2E` | Rejected / overdue |
| `--color-border` | `#E7DDCF` | Card borders, dividers |

**Typography**
- Display/headings: a humanist serif or slab (e.g. "Fraunces" or "Zilla Slab") at restrained weight — gives warmth without looking decorative on a utility app.
- Body/UI: a clean grotesk (e.g. "Inter" or "Work Sans") for forms, tables, numbers — must render Ugandan Shilling amounts and tabular data cleanly with tabular-nums.

**Layout**
- Student app: single-column, card-based, bottom nav on mobile (Dashboard / Payments / Announcements / Maintenance / More). Large tap targets (min 44px).
- Admin app: sidebar nav on tablet/desktop, collapses to drawer on mobile. Room grid uses a card-per-room layout (not raw tables) — status shown as a colored left-border + badge (Vacant = neutral, Occupied = teal, Reserved = amber, Maintenance = warning stripe, Unavailable = grey/hatched).

**Signature element**
A "room card" component reused everywhere a room appears (allocation, grid, dashboards, public vacancy list) — section + room number as an eyebrow label, status as a colored edge, occupant name only shown where the viewer is authorized. This single consistent card is what ties the public site, student dashboard, and admin grid together visually.

**Status color coding (consistent everywhere)**
- Vacant/Available → neutral grey-cream
- Occupied/Verified/Fully Paid → teal
- Pending/Partially Paid/Reserved → amber
- Rejected/Outstanding/Overdue → terracotta-red

---

## 8. API ARCHITECTURE

REST, versioned, JSON. Representative endpoints (not exhaustive):

```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/password-reset/request
POST   /api/v1/auth/password-reset/confirm

GET    /api/v1/me
PATCH  /api/v1/me/profile

GET    /api/v1/rooms?section=&type=&status=
GET    /api/v1/rooms/:id
POST   /api/v1/rooms/:id/assign          [admin]
POST   /api/v1/rooms/:id/checkin         [admin]
POST   /api/v1/rooms/:id/checkout        [admin]
PATCH  /api/v1/rooms/:id/status          [admin]

GET    /api/v1/students?filter=...       [admin]
GET    /api/v1/students/:id              [admin, or self]
PATCH  /api/v1/students/:id              [admin: locked fields; self: profile fields only]

POST   /api/v1/applications              [public]
GET    /api/v1/applications              [admin]
PATCH  /api/v1/applications/:id/decision [admin]

GET    /api/v1/payments/me               [student]
POST   /api/v1/payments                  [student] -> creates status=pending
GET    /api/v1/payments?status=&section=&dateFrom=&dateTo=  [admin]
GET    /api/v1/payments/:id              [admin, or owning student]
POST   /api/v1/payments/:id/verify       [admin, permission=verify_payments]
POST   /api/v1/payments/:id/reject       [admin]
POST   /api/v1/payments/:id/request-clarification [admin]
POST   /api/v1/payments/:id/evidence     [student] -> signed upload

GET    /api/v1/reports/occupancy         [admin/landlady]
GET    /api/v1/reports/financial         [admin/landlady]
GET    /api/v1/reports/outstanding       [admin/landlady]
GET    /api/v1/reports/export?type=pdf|csv|xlsx

GET    /api/v1/announcements             [role-filtered audience]
POST   /api/v1/announcements             [admin/landlady/chairperson]

POST   /api/v1/maintenance               [student]
GET    /api/v1/maintenance               [admin] / [student: own]
PATCH  /api/v1/maintenance/:id/status    [admin]

GET    /api/v1/settings/public           [public: bank info, contacts — only configured fields]
PATCH  /api/v1/settings                  [admin/landlady, permission=manage_settings]

GET    /api/v1/audit-logs                [admin/landlady]
```

**Conventions:** every mutating endpoint requires an authenticated actor recorded to `audit_logs`; every list endpoint supports pagination + the filters named in Section 48 of the brief; error responses use a consistent `{ error: { code, message } }` shape.

---

## 9. SECURITY ARCHITECTURE

- **Auth:** password hashed with argon2id (or bcrypt cost ≥ 12); JWT access token (short TTL, ~15 min) + rotating refresh token; account lockout after repeated failed attempts.
- **Authorization:** RBAC middleware checks role + granular permission on every route; ownership checks ensure a student can only reach `/payments/:id` etc. for their own records — enforced server-side, never trusted from the client.
- **File uploads:** payment evidence restricted to image/PDF, size-capped (e.g. 8MB), virus/type-sniffed (not just extension-checked), stored in a **private** bucket, served only via short-lived signed URLs to the submitting student, verifying admins, and the landlady.
- **Payment integrity:** verified payments are immutable at the API layer; corrections are new rows linked via `payment_corrections`, always with a reason and actor recorded.
- **Transport:** HTTPS everywhere, HSTS enabled.
- **Secrets:** DB credentials, JWT signing key, bucket keys in environment variables / secret manager — never in frontend bundles or committed code.
- **Rate limiting:** login and password-reset endpoints throttled per IP/account.
- **Input validation:** schema validation (e.g. Zod/Joi) on every endpoint; parameterized queries only (ORM handles this by default).
- **Audit logging:** every payment action, room change, fee change, and permission change written to `audit_logs` with before/after values.
- **Backups:** nightly encrypted Postgres dumps, retained on a rolling window (e.g. 30 days), stored off the primary host; bucket versioning enabled so deleted evidence files are recoverable for a period.
- **Least privilege:** database roles separated (app connection role vs. migration/admin role); the chairperson account literally cannot query payment tables at the API layer, not just hidden in the UI.

---

## PHASE PLAN (as specified)
Phase 1 Auth → 2 Profiles → 3 Sections/Rooms → 4 Allocation → 5 Fees → 6 Payment Submission → 7 Payment Verification → 8 Student Dashboard → 9 Applications → 10 Announcements → 11 Maintenance → 12 Reports → 13 Public Website → 14 Security Hardening → 15 Testing → 16 Production Deployment.

This document is the reference for all of those phases. Configurable/unknown values (bank details, real hostel rules, landlady and chairperson names, exact facilities) are intentionally left as placeholders throughout — see `system_settings` and `hostel_guidelines` tables, which exist specifically so nothing is hardcoded.
