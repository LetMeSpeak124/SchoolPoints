# 🌟 SchoolPoints - Local Proof of Concept

A positive student reward and point-redemption web app built with Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, SQLite via Prisma, and an append-only points ledger.

This repository is the hardened **Option B** proof of concept: it keeps the existing Next.js/SQLite stack and demo UI while enforcing the core security and integrity rules server-side.

---

## 🚀 Quick Start (Windows PowerShell)

Requires **Node.js 24** or newer. All commands should be executed from the project root directory.

### 1. Install Dependencies
```powershell
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`, then set unique secrets:
```powershell
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Use the generated value for `SESSION_SECRET` (32+ characters). Generate a second value for `CRON_SECRET`, which protects the scheduled expiry endpoint. The app refuses to start sessions without a valid session secret; there is no fallback key.

### 3. Set Up the Database
Apply the checked-in migration:
```powershell
npm run db:deploy
```
Then seed the demo data:
```powershell
npm run db:seed
```

For a clean local reset (drops the database, re-applies migrations, and seeds automatically):
```powershell
npx prisma migrate reset
```

### 4. Run Automated Tests
Tests use a separate `prisma/test.db`, so they never touch `dev.db`:
```powershell
npm run test
```

### 5. Start the Development Server
```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Demo Accounts (Password for all: `password123`)

Seed the database with `npm run db:seed`, then sign in on the login page with any seeded username and password. Demo mode is no longer a separate click-login flow — all accounts use the same credentials form.

| Role | Username | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `password123` | Principal Vance (approves teachers, sets daily limits, enables/disables accounts, manages rewards and redemptions) |
| **Teacher (Approved)** | `teacher_sarah` | `password123` | Ms. Connor (Room 5A, 60-point daily limit, 3-click award flow) |
| **Teacher (Pending)** | `teacher_john` | `password123` | Mr. Keating (cannot award until approved) |
| **Student** | `student_alice` | `password123` | Alice Walker (Room 5A; balance, catalog, redemption history) |

---

## 🛡️ Security & Integrity Rules

1. **Sessions are real and revocable.**
   - Signed JWT in an `httpOnly`, `sameSite=lax` cookie (`secure` in production).
   - `SESSION_SECRET` is mandatory and must be at least 32 characters.
   - Every request re-checks the account in the database, so disabled accounts and role changes take effect immediately.

2. **Every action authorizes on the server.**
   - Admin actions require `ADMIN`; teacher actions require `TEACHER`; student redemptions require `STUDENT`.
   - Teachers may award only to students in their own classrooms.
   - Students may read and cancel only their own records.
   - Pending or revoked teachers cannot award points.

3. **Append-only points ledger.**
   - Balances are computed as the `SUM` of `PointLedger` rows (`AWARD`, `REDEMPTION`, `REFUND`).
   - Points are never edited directly on a user row.

4. **Award limits are enforced in the service layer.**
   - Maximum **10 points per single award**.
   - Maximum **20 points received per student per day**.
   - Per-teacher daily award limit configured by the administrator.
   - Approved categories only: Participation, Homework, Kindness, Improvement.
   - Day boundaries use **Asia/Manila** school-local time, regardless of server timezone.

5. **Redemption state machine.**
   - `REQUESTED → READY → COLLECTED`
   - `CANCELLED` and `EXPIRED` are terminal and refund points exactly once.
   - Cancel/expire restores reserved stock in the same transaction.
   - Students may cancel their own active requests.
   - Requests expire after a **72-hour collection window**. Overdue requests are expired by the dashboard fallback, the `job:expire` script, or the protected `/api/cron/expire` endpoint.

6. **Transaction-safe inventory.**
   - Redemptions verify balance, check active status, and conditionally decrement stock so two simultaneous requests cannot oversell the last unit.
   - Terminal transitions use conditional updates, preventing double refunds or double collection.

7. **Audit trail.**
   - Security-relevant changes write `AuditLog` rows in the same transaction: awards, redemptions, cancellations, teacher approval changes, account status changes, and reward changes.

8. **Account lifecycle.**
   - Administrators can disable/enable teacher and student accounts.
   - Disabled accounts cannot sign in or perform actions, and existing sessions stop working.

9. **Login protection and browser hardening.**
   - Five failed attempts per IP + username trigger a 15-minute lockout.
   - Invalid usernames still run a bcrypt comparison to reduce timing differences.
   - CSP, HSTS, frame denial, `nosniff`, a strict referrer policy, and a restricted permissions policy are sent by `next.config.mjs`.
   - The `X-Powered-By` header is disabled.

   The login limiter is held in process memory, which is appropriate for the single-instance PoC. A multi-instance deployment must move it to Redis or a shared database table.

---

## 🧪 Automated Tests (19 passing)

The business suite runs against an isolated SQLite database created by `tests/globalSetup.ts`. The login limiter has separate unit tests.

### Business logic (`tests/schoolpoints.test.ts`) — 14 tests

1. ✅ Pending teacher cannot award points (`TEACHER_NOT_APPROVED`)
2. ✅ Teacher cannot award outside their assigned classroom (`STUDENT_NOT_IN_TEACHER_CLASS`)
3. ✅ Over-redemption fails without changing stock (`INSUFFICIENT_BALANCE`)
4. ✅ Students and unrelated teachers cannot read another student (`FORBIDDEN_STUDENT_ACCESS`)
5. ✅ Redeeming the last item twice succeeds only once (`OUT_OF_STOCK`)
6. ✅ Unknown award categories are rejected server-side (`INVALID_CATEGORY`)
7. ✅ Single awards above the 10-point ceiling are rejected (`AWARD_LIMIT_EXCEEDED`)
8. ✅ The 20-point student daily cap is enforced across awards (`STUDENT_DAILY_LIMIT_EXCEEDED`)
9. ✅ Redemption transitions are enforced and the collector is recorded
10. ✅ Cancellation refunds and restores stock exactly once
11. ✅ Collection after expiry is refused and the request is refunded
12. ✅ Overdue requests expire in one consistent pass
13. ✅ At most one concurrent request can claim the final item
14. ✅ Two different redemptions cannot spend the same balance twice

### Login limiter (`tests/rate-limit.test.ts`) — 5 tests

15. ✅ Allows attempts below the failure threshold
16. ✅ Blocks once the threshold is reached
17. ✅ Unblocks after the 15-minute window expires
18. ✅ Keeps different IP + username keys independent
19. ✅ Clears failures after a successful login

Run them with:
```powershell
npm run test
```

---

## 🗄️ Database & Migrations

| Command | Purpose |
| :--- | :--- |
| `npm run db:deploy` | Apply checked-in migrations (use for normal setup/deploy) |
| `npm run db:migrate` | Create and apply a new migration during development |
| `npm run db:seed` | Load demo users, classes, rewards, and history |
| `npm run db:backup` | Create a consistent SQLite snapshot in `backups/` (keeps 14) |
| `npm run job:expire` | Expire overdue redemptions once; suitable for a scheduler |
| `npm run db:push` | Legacy schema sync for quick local experiments |

Migrations live in `prisma/migrations/`. The initial migration is already baselined for the existing local database.

### Models

- `User` - admins, teachers, students; account status, teacher approval, daily limit
- `Classroom` - class and assigned teacher
- `Reward` - catalog item, point cost, stock, active flag
- `Redemption` - request lifecycle, expiry, collector metadata
- `PointLedger` - append-only point movements
- `AuditLog` - security-relevant changes

---

## 🧱 Phase 2 Foundation (implemented)

- **Policy versioning** - award caps, student daily caps, and collection windows are read from an active `PointPolicy` version and stored on ledger/redemption rows.
- **Monthly allocations** - administrators can allocate monthly point budgets per teacher; awards consume the allocation when one exists.
- **Activity references** - ledger entries, redemptions, and disputes can reference an `Activity`.
- **Disputes** - students can dispute their own awards/redemptions; administrators can resolve or reject them.
- **Idempotency keys** - retried award, redemption, and cancellation requests can reuse a client-provided key.
- **Distributed rate limiting** - login throttling now uses the `RateLimitBucket` table instead of process memory.
- **Shared job queue** - `Job` records can be enqueued and processed by `/api/cron/expire` or a worker.
- **Database-level protections** - triggers make `PointLedger` append-only and prevent negative reward stock.
- **Reports** - `/api/reports?dataset=students|ledger|redemptions` exports CSV for administrators.

---

### Scheduled expiry

Run the job directly:
```powershell
npm run job:expire
```

Or call the protected endpoint from a hosted scheduler:
```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Uri http://localhost:3000/api/cron/expire -Headers $headers
```

The endpoint requires `CRON_SECRET` (16+ characters) and returns `503` if it is not configured. It accepts `GET` and `POST`. The job is idempotent: concurrent or repeated runs cannot double-refund a redemption.

On Windows, create a Task Scheduler task that runs `npm run job:expire` from the project directory every 15 minutes.

### Health check

`GET /api/health` performs a database round trip and returns:
- `200` with `{ status: "ok", database: "ok", ... }`
- `503` with `{ status: "error", database: "unavailable" }`

Use it for container readiness/liveness probes and uptime monitoring.

### Backups

Create a consistent snapshot without stopping the app:
```powershell
npm run db:backup
```

Backups are written to `backups/schoolpoints-<timestamp>.db`, and only the newest 14 are retained. To restore:

1. Stop the app.
2. Copy the chosen backup over `prisma/dev.db`.
3. Run `npm run db:deploy` to confirm the schema is current.
4. Start the app.

The backup script uses SQLite `VACUUM INTO`, so it does not capture a half-written database.

### Continuous integration

`.github/workflows/ci.yml` installs dependencies, applies migrations, runs typecheck and all 19 tests, then performs a production build on every push and pull request.

---

## 🧭 Scope & Known Limitations

This is a local proof of concept, not the full system described in the research proposal. Not yet implemented:

- Monthly teacher point allocations and allocation rollover
- Versioned award policies and policy acknowledgements
- Activity references and evidence attachments
- Dispute/appeal workflow
- Analytics dashboards beyond the current operational views
- Multi-school tenancy and MySQL migration
- The proposal's full 17-entity data model (core pilot entities are implemented; additional entities remain future scope)

The current stack remains Next.js 16 + React 19 + Prisma + SQLite, and is intended for a single-school pilot/demo. Production dependencies are audit-clean (`npm audit --omit=dev`).
