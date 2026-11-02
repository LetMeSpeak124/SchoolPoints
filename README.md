# 🌟 SchoolPoints - Local Proof of Concept

A full-featured positive student reward and point redemption web app built with Next.js 14 App Router, TypeScript, Tailwind CSS, SQLite via Prisma, and an append-only points ledger.

---

## 🚀 Quick Start (Windows PowerShell)

All commands should be executed from the project root directory:

### 1. Install Dependencies
```powershell
npm install
```

### 2. Set Up Database (SQLite)
Sync the Prisma schema to create the local `dev.db` SQLite database:
```powershell
npm run db:push
```

### 3. Seed Demo Data
Populates 1 Admin, 2 Teachers (1 approved, 1 pending), 10 Students across 2 classes, 8 school-supply rewards with emoji icons, and sample ledger entries:
```powershell
npm run db:seed
```

### 4. Run Automated Tests
Executes the 5 Vitest test cases verifying all business and security rules:
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

When `DEMO_MODE=true` in `.env`, the login page provides instant **1-Click Demo Buttons** to switch between roles without typing:

| Role | Username | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `password123` | Principal Vance (approves teachers, sets daily limits, manages rewards catalog & redemption statuses) |
| **Teacher (Approved)** | `teacher_sarah` | `password123` | Ms. Connor (teaches Room 5A, 60 pt daily limit, 3-click award flow) |
| **Teacher (Pending)** | `teacher_john` | `password123` | Mr. Keating (pending admin verification; cannot award until approved) |
| **Student** | `student_alice` | `password123` | Alice Walker (Room 5A; view balance, progress to next goal, catalog, redeem, history) |

---

## 🛡️ Core Rules & Architecture

1. **Append-Only Points Ledger:** Points are never directly edited on a user row. Every balance is computed as the `SUM` of all `PointLedger` rows (`AWARD`, `REDEMPTION`, `REFUND`).
2. **Transactional Redemptions & Cancellations:**
   - Redemptions execute inside an isolated DB transaction (`prisma.$transaction`) verifying stock and balance before decrementing stock and appending `-cost` to the ledger.
   - Admin cancellations refund points and restore stock within the same atomic transaction.
3. **Strict Server-Side Authorization:** Every action checks the `httpOnly` JWT session cookie. Students can only query their own ledger and redemptions. Teachers cannot award outside their enrolled classes or while pending approval.
4. **Teacher 3-Click Flow:**
   - **Click 1:** Pick Student from teacher's class
   - **Click 2:** Pick Category (`Participation +5`, `Homework +10`, `Kindness +10`, `Improvement +15`)
   - **Click 3:** Confirm & Award (with optional personalized note)
5. **Student Next-Goal Progress:** Automatically calculates points needed for the next unreached reward in the catalog and renders a visual progress bar.

---

## 🧪 Automated Vitest Tests (`tests/schoolpoints.test.ts`)

1. ✅ **Pending teacher cannot award points** (throws `TEACHER_NOT_APPROVED`)
2. ✅ **Teacher cannot award points outside their assigned classroom** (throws `STUDENT_NOT_IN_TEACHER_CLASS`)
3. ✅ **Over-redemption fails** when student has insufficient balance (throws `INSUFFICIENT_BALANCE`)
4. ✅ **Student cannot read another student's data** (throws `FORBIDDEN_STUDENT_ACCESS`)
5. ✅ **Redeeming the last item twice succeeds only once** (concurrency & stock check inside transaction)
