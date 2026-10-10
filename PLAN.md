# Employee Management System (EMS) — Implementation Plan

> Status: **Draft for client/developer approval.** No application code has been written. Do not start implementation until this plan is approved.
>
> Date: 2026-10-10

---

## 0. How to read this plan

- **Confirmed requirement (CR)** — stated explicitly in the client brief.
- **Assumption (A)** — a decision made by this plan to fill a gap. Each one can be changed after client feedback; the cost of changing it is noted where significant.
- **Open question (Q)** — must be answered by the client. See [Section 14](#14-pending-client-clarifications).

---

## 1. Current project analysis

Inspected on 2026-10-10.

| Item | Finding | Impact on plan |
|---|---|---|
| Framework | `next@16.4.0`, `react@19.3.0`, App Router, **no `src/` folder** (`app/` at root) | Keep root `app/`. Do not move to `src/`. |
| TypeScript | `strict: true`, path alias `@/*` → `./*` | Keep. Add `noUncheckedIndexedAccess` (optional, Phase 1). |
| Styling | Tailwind CSS v4 via `@tailwindcss/turbopack` loader in `next.config.ts` (no `postcss.config`) | Keep the existing setup. Theme tokens go in `app/globals.css` with `@theme`. |
| `next.config.ts` | `cacheComponents: true`, `partialPrefetching: true`, `experimental.agentFeedback: true` | Request-time data (cookies, session) must render inside `<Suspense>`. See [Section 9.4](#94-nextjs-16-specific-rules-verified-against-node_modulesnextdistdocs). |
| Middleware | Next.js 16 renamed `middleware.ts` to **`proxy.ts`** (`middleware` is deprecated) | Use `proxy.ts` at the project root. |
| ESLint | `eslint-config-next` core-web-vitals + typescript | Keep. |
| Existing app files | `app/layout.tsx`, `app/page.tsx` (create-next-app boilerplate), `app/globals.css` (includes a dark-mode media query and an `Arial` body font override) | Replace boilerplate in Phase 1/4. Remove dark-mode query (white corporate theme). |
| Dependencies | No Supabase, validation, or email packages yet | Install in Phase 1 (list in [Section 9.3](#93-libraries-only-what-is-needed)). |
| `.gitignore` | Already ignores `.env*` | Commit `.env.example` with a negation rule (`!.env.example`). |
| `.agent/skills/` | `frontend-design` and `grill-me` agent skills | Not part of the app. |
| Figma screens | **Not present in this workspace.** | UI in this plan is derived from the written brief. See limitation below. |

**Figma status (updated 2026-10-10).** No Figma frames are stored in this project. The in-project Login page (`app/login`) was built from a Figma frame (brand panel `#023482` + white form panel), and the Activate Account and Change Default Credentials pages reuse that layout. Two other sources exist outside the project and disagree with it: `~/Downloads/Activate Account.png` and `Login Account.png` (card on a blurred photo background, illustration hero), and the older codebase in `Desktop/EMS`. The password rules were taken from `Desktop/EMS`. **Q1:** Which design is current? Please export the approved frames (Activate, Change Default Credentials, Login, and the portal screens) into `docs/figma/`.

---

## 2. Scope summary

### 2.1 Confirmed requirements

- Stack: Next.js App Router, TypeScript, Tailwind CSS, Supabase (Postgres, Auth, Storage), Brevo API (transactional email), Vercel.
- Exactly two roles: **Employee** and **Department Manager**. No administrator portal.
- Two pre-provisioned accounts for initial testing: one Employee, one Department Manager.
- Activation flow: Employee ID + company email → Brevo verification email → single-use, expiring link → set username and password → log in with username and password → role-based redirect.
- Forgot password, password reset, change password, logout, session persistence, rate limiting, anti-enumeration.
- Employee modules: Dashboard, Profile, Attendance (read-only), Assigned Tasks, Announcements, Leave Request, Leave Status, Account Settings.
- Manager modules: Dashboard, Employees, Attendance Review, Create and Assign Task, Task Progress Overview, Leave Management, Announcements.
- Authorization enforced in the database (RLS) and on the server, not only in navigation.
- Brevo API key never reaches the browser.

### 2.2 Out of scope (unless the client asks)

- Admin portal, HR provisioning UI, payroll, leave balances/credits, holiday calendar management, clock-in/clock-out, real-time chat, push notifications, multi-language, dark mode, mobile app.

### 2.3 Key assumptions

| ID | Assumption | Why |
|---|---|---|
| A1 | The company email is also the Supabase Auth email. Users never type it at login. | Supabase password login needs an email. Username is mapped server-side. |
| A2 | New employees and departments are provisioned by the developer through SQL scripts (no admin UI). | No admin portal is in scope. |
| A3 | A manager is authorized for every department where `departments.manager_id` = the manager. Usually one department. | Supports the "filter by department" requirement without a new role. |
| A4 | Attendance records are **not** created by users in the app. They come from seed/import scripts. Approved leave writes `on_leave` attendance rows automatically. | Brief defines attendance as read-only for employees and "review" for managers. Source is unknown (Q5). |
| A5 | Leave duration = inclusive count of Monday–Friday days. Whole days only. Public holidays are not excluded. | No holiday or half-day rule was given (Q7). |
| A6 | Task review is required only when the employee submits a task as finished (100%). Partial updates are visible to the manager but need no decision. | Brief says "approve or return task updates with feedback where required" (Q9). |
| A7 | Timezone is `Asia/Manila`. Dates are stored as `date`. Instants are stored as `timestamptz` (UTC). | Needed for "today", late, and due-date logic (Q15). |
| A8 | Managers also get the Account Settings page (change password). Managers do not get a Profile page. | Brief lists settings only under Employee, but every user needs to change a password. |
| A9 | Announcements are scoped to a department. Audience options: whole department, or selected employees in the department (Q10). | Brief says "set intended audience". |
| A10 | Email notifications for leave decisions and task assignment are built, but each is controlled by a feature flag that is off until the client confirms. | Brief marks them optional. |

---

## 3. Architecture overview

```
Browser
  │  (HTTPS, Supabase session cookies set by @supabase/ssr)
  ▼
Vercel — Next.js 16
  ├─ proxy.ts ............ refresh Supabase session, optimistic redirect of signed-out users
  ├─ Server Components ... read data with the user-scoped Supabase client (RLS applies)
  ├─ Server Actions ...... validate input (zod), re-check auth (DAL), write data
  ├─ Route handlers ...... only where a URL endpoint is required (none planned at first)
  └─ lib/email (server-only) ── HTTPS ──► Brevo Transactional Email API
  ▼
Supabase
  ├─ Auth ........ authentication authority (passwords hashed by Supabase, JWT sessions)
  ├─ Postgres .... tables, RLS policies, SECURITY DEFINER RPCs for status transitions
  └─ Storage ..... private bucket `leave-attachments` with storage RLS
```

### 3.1 Supabase clients (three, never mixed)

| Client | File | Key | Where | RLS |
|---|---|---|---|---|
| Browser client | `lib/supabase/client.ts` | publishable (anon) key | Client Components (file upload only) | Yes |
| Server client | `lib/supabase/server.ts` | publishable key + user cookies | Server Components, Server Actions | Yes |
| Admin client | `lib/supabase/admin.ts` (`import 'server-only'`) | secret (service role) key | Only auth flows: activation, username lookup, recovery link generation, rate limiting, email log | **Bypasses RLS** — keep calls few and audited |

Rule: every business-module read/write (profile, tasks, leave, attendance, announcements) uses the **server client**, so RLS is the last line of defense even if server code has a bug.

### 3.2 Write patterns

1. **Simple writes** (edit profile, create task, create announcement, mark announcement read): Server Action → zod validation → DAL role check → user-scoped insert/update. RLS policies and column-level `GRANT`s restrict what can change.
2. **Status transitions** (submit task progress, review task, create leave request, decide leave): Server Action → zod → DAL → call a Postgres function (`SECURITY DEFINER`, `search_path = ''`). The function reads `auth.uid()`, checks authorization, validates the transition, and writes all rows in one transaction. Authenticated users get **no direct `UPDATE` grant** on `tasks.status` or `leave_requests.status`.

---

## 4. Authentication and account activation

Supabase Auth is the authentication authority. It stores and hashes passwords and issues sessions. Brevo only delivers emails. The app never stores passwords.

### 4.1 Supabase Auth project settings

- Disable public sign-ups (`Allow new users to sign up` = off). Accounts are created only by the server with the Admin API during activation. Anonymous sign-ins: off.
- Password requirements: minimum 8 characters, with uppercase, digit, and special character (matches the Figma rules; mirrored in `features/auth/validation.ts`). Enable leaked-password protection if the plan supports it (Pro plan feature — Q17).
- Site URL and redirect allow-list: `APP_URL` for production, `http://localhost:3000` for development.
- JWT expiry: default 3600 s. Refresh-token rotation: on (default).
- Configure Brevo SMTP relay as Supabase's custom SMTP as a **fallback** only. The app does not rely on Supabase-sent emails (see 4.6), but this prevents the low default Supabase SMTP limit from blocking anything sent by Supabase directly.

### 4.2 Account states

`employees.account_status`:

| Value | Meaning |
|---|---|
| `pending_activation` | Provisioned with a default username. Cannot log in. Can request activation. |
| `active` | Auth user linked. Can log in. |
| `disabled` | Cannot log in or activate. Set manually by SQL (no admin portal). The DAL and RLS helpers treat a disabled user as signed out. |

`employees.employment_status` (`active`, `on_leave`, `resigned`, `terminated`) is HR data. Only `active` or `on_leave` employees can activate.

### 4.3 Activation flow (corrected 2026-10-10)

**Entry point rule.** A newly provisioned employee starts at **Activate Account**, not Login. `/` redirects to `/activate`. Activated employees go to `/login` directly.

```
New employee:       Activate Account → Email Verification → Change Default Credentials → Login
Activated employee: Login
```

Each provisioned employee has a **default username** (set by provisioning, given to the employee by HR — format Q4). The default username identifies the account on the Change Default Credentials page. The employee cannot log in until activation is complete.

Pages and footer links:

| Route | Page | Fields | Button | Footer |
|---|---|---|---|---|
| `/activate` | Activate Account | Employee ID, Company Email | Activate Account | "Already activated? **Login here**" → `/login` |
| `/activate/verify?token=…` | (route handler, no UI) | — | — | — |
| `/activate/credentials` | Change Default Credentials | Current username, New username, New password, Confirm new password (+ live password-rule checklist) | Update Credentials | — |
| `/login` | Login | Username, Password | Login | "Account not activated? **Activate Account**" → `/activate` |

```
[1] /activate ── Employee ID + company email ──► Server Action requestActivation
      │  validate → rate limit (IP + identifier) → admin lookup
      │  eligible = employee_no matches AND lower(company_email) matches
      │             AND account_status = 'pending_activation'
      │             AND employment_status IN ('active','on_leave')
      │  The account is NOT activated here.
      │  if eligible:  revoke previous unused tokens
      │                token = 32 random bytes (base64url); store SHA-256(token) only
      │                expires_at = now() + 30 min
      │                Brevo: "Verify your EMS account" with link APP_URL/activate/verify?token=<token>
      │  if already active: Brevo: "Your account is already active" (login + forgot-password links)
      │  else: send nothing
      ▼  ALWAYS show the same success state ("Check your email … expires in 30 minutes")

[2] GET /activate/verify?token=…   (route handler)
      │  hash token, check: unused, not revoked, not expired — does NOT consume it
      │     (email scanners prefetch links)
      │  invalid → redirect /activate?link=expired ("link invalid or expired, request a new one")
      │  valid   → set httpOnly, SameSite=Lax, Secure cookie `ems_activation` (path /activate,
      │            expires with the token) → redirect /activate/credentials
      │            (token leaves the address bar; Referrer-Policy: no-referrer)
      ▼
[3] /activate/credentials  (server checks the cookie token on every render;
      │                     no valid token → redirect /activate?link=expired)
      │  Server Action updateDefaultCredentials (POST)
      │  validate (username rules, password rules, confirm match, new ≠ current username)
      │  rate limit
      │  token from cookie must still be valid
      │  current username must equal the account's default username ("Current username is incorrect.")
      │  new username must be free (case-insensitive)
      │  RPC consume_activation_token(hash) → atomic single-use claim, returns employee_id
      │  Supabase Auth: create (or update) the auth user with the new password
      │     failure → RPC release_activation_token (if not expired) → show error
      │  RPC complete_activation(employee_id, auth_user_id, new_username)
      │     sets auth_user_id, username, account_status='active', activated_at
      │     failure (username race) → undo auth change + release token → show error
      │  delete cookie
      ▼
[4] redirect /login?activated=1 → "Your account is activated. Log in with your new username and password."
```

Security notes:

- Verification is never client-only. The Change Default Credentials page and its Server Action both re-check the token on the server.
- 256-bit random token from `crypto.randomBytes(32)`; only the SHA-256 hash is stored (`token_hash` unique).
- TTL 30 minutes (`ACTIVATION_TOKEN_TTL_MINUTES`). Single use (`used_at`). A new request revokes older unused tokens (`revoked_at`).
- The default username is not a secret, so it is not used as proof of identity. Proof comes from the emailed token. The current-username check guards against typos and a link opened for the wrong account.
- "Current username is incorrect" is only shown to someone who already holds a valid token, so it does not enable enumeration.

Password rules (from the Figma design, confirm — Q4): at least 8 characters, one uppercase letter, one number, one special character. Set the same minimum in Supabase Auth settings. Shown as a live checklist under the New password field.

Username rules: 4–30 characters, lowercase letters, digits, `.`, `_`, `-`; must start with a letter; stored as `citext` (case-insensitive unique). Must differ from the default username.

**Implementation status (2026-10-10).** Supabase-backed. Migrations `supabase/migrations/20261010130000_core_auth_schema.sql` and `20261010130100_activation_rpcs.sql` are applied to project `ctynioxnlrqfjecxwqwi`. Activation (`lib/auth/activation.ts`) issues and consumes hashed tokens through service-role RPCs and sends email through Brevo (`lib/email/brevo.ts`). Login (`features/auth/actions.ts#signIn`) maps username to email on the server, signs in with Supabase Auth, and redirects by the role stored in `public.employees`. Initial accounts are created by `scripts/provision-initial-users.mjs` (MGR-0001 / `mgr0001` / department_manager, EMP-0001 / `emp0001` / employee, department IT — Information Technology Department). The schema uses `employees.employee_id` (text ID) and `employees.activation_status`; section 6 names (`employee_no`, `account_status`) will be aligned when the remaining tables are added.

### 4.4 Login (username → auth mapping)

```
/login ── username + password ──► Server Action signIn
  zod validate → rate limit (username key + IP key)
  admin client: SELECT company_email FROM employees
                WHERE username = $1 AND account_status = 'active'
  not found → call signInWithPassword with a fixed non-existent placeholder email
              (keeps response timing similar) → generic error
  found     → server client signInWithPassword({ email, password })  (sets session cookies)
  error     → "Invalid username or password."  (same text for every failure)
  success   → read role via DAL → redirect('/employee') or redirect('/manager')
              (honor ?next= only if it is a same-origin path inside the user's own portal)
```

The username-to-email mapping runs only on the server. The browser never learns the auth email from the login form.

### 4.5 Session, logout, protected routes

- **Session persistence:** `@supabase/ssr` stores access and refresh tokens in cookies. `proxy.ts` calls `supabase.auth.getClaims()` on each matched request to refresh tokens and write updated cookies (official Supabase + Next.js pattern).
- **Proxy (optimistic only):** signed-out request to `/employee/*` or `/manager/*` → redirect to `/login?next=…`. Signed-in request to `/login` or `/activate` → redirect to `/`. The proxy does no database queries.
- **Data Access Layer (`lib/auth/dal.ts`, `server-only`):**
  - `getCurrentUser()` → `getClaims()` → load `employees` row by `auth_user_id` → return a narrow object `{ employeeId, role, departmentId, managedDepartmentIds, fullName, accountStatus }`. Uses React `cache()` per request.
  - `requireEmployee()` / `requireManager()` → redirect to `/login` if signed out or disabled; redirect to the user's own dashboard if the role is wrong.
  - Every page, Server Action, and query function calls one of these. Layout checks alone are not trusted.
- **`app/page.tsx`** (root): signed-in users go to `/employee` or `/manager`; everyone else goes to `/activate` (the entry point for new employees). Activated employees open `/login` directly.
- **Logout:** Server Action → `supabase.auth.signOut()` → `redirect('/login')`.
- **Database:** RLS helper functions check `account_status = 'active'`. A disabled user's existing JWT reads nothing.

### 4.6 Forgot password and reset

Supabase's built-in `resetPasswordForEmail` sends its own email. To make Brevo the delivery channel, the server generates the recovery link and sends it through Brevo:

```
/forgot-password ── username OR company email ──► Server Action requestPasswordReset
  rate limit → admin lookup of an active employee
  found → admin.auth.admin.generateLink({ type: 'recovery', email })
          → take properties.hashed_token
          → link = APP_URL/auth/confirm?token_hash=<hashed_token>&type=recovery
          → Brevo "Reset your EMS password"
  ALWAYS show: "If an active account matches, a reset link has been sent."

/auth/confirm (page, GET does not consume) → "Continue to reset password" button
  POST Server Action → supabase.auth.verifyOtp({ type: 'recovery', token_hash })
     → session created → redirect('/reset-password')

/reset-password (requires the recovery session)
  new password + confirm → supabase.auth.updateUser({ password })
  → signOut({ scope: 'others' }) → redirect to the user's dashboard with a success message
```

Recovery link lifetime follows Supabase's email OTP expiry (set to 1 hour in Auth settings). Supabase enforces single use.

### 4.7 Change password (Account Settings)

```
current password + new password + confirm ──► Server Action changePassword
  requireEmployee()/requireManager() → zod (new ≠ current, policy, match) → rate limit
  verify current password: signInWithPassword(email, current) on a separate
     non-persisting Supabase client (no cookies written)
     failure → field error "Current password is incorrect."
  server client: auth.updateUser({ password: new })
  auth.signOut({ scope: 'others' })  (end other sessions)
  → success message
```

If the Supabase project enables "Secure password change" (reauthentication nonce), adjust to that flow during Phase 3. Verify against current Supabase docs at implementation time.

### 4.8 Rate limiting and anti-enumeration

Vercel functions are stateless, so in-memory counters do not work. Use a Postgres table (no new paid service):

- Table `rate_limit_events` + RPC `check_rate_limit(action, key_hash, max, window)` (service role only). The RPC counts recent events, inserts one, deletes old events for that key, and returns allowed/blocked.
- Keys are HMAC-SHA256(`RATE_LIMIT_SECRET`, value). Raw IPs and emails are not stored.
- IP comes from the `x-forwarded-for` header set by Vercel.

| Action | Limit per identifier | Limit per IP |
|---|---|---|
| Activation request | 3 / 15 min | 10 / hour |
| Complete activation | 5 / 15 min (per token hash) | 10 / hour |
| Login | 5 failures / 15 min (per username) | 20 / 15 min |
| Forgot password | 3 / hour | 10 / hour |
| Change password | 5 / 15 min (per user) | — |

Blocked → generic "Too many attempts. Try again in a few minutes." Supabase Auth's own rate limits stay active as a second layer.

Anti-enumeration rules: same message and HTTP status for match/no-match in activation and forgot-password; generic login error; no "username taken" check before a valid activation token is held.

### 4.9 Error handling

- Server Actions return `{ ok: false, message, fieldErrors }`. They never return raw Supabase or Brevo errors to the client.
- Unexpected errors are logged server-side (`console.error` with a short error ID). The user sees "Something went wrong (ref: ABC123)."
- Email send failure during activation or reset: the user still sees the generic message. The failure is recorded in `email_log`. The user can request again.

---

## 5. Module specifications

Each module lists route, data, actions, and states. "DAL" means `requireEmployee()` or `requireManager()` runs first.

### 5.1 Employee portal (`/employee/...`)

**Dashboard — `/employee`**
- Welcome card (name, position, department, today's date).
- Task summary: counts by status (to do, in progress, for review, returned, completed) and overdue count.
- Task progress: average progress of open tasks + list of 3 nearest due tasks with progress bars.
- Leave summary: pending, approved, and rejected counts; latest request with status badge.
- Attendance overview: current month counts (present, late, absent, on leave).
- Recent announcements: latest 3, unread marker, link to Announcements.
- Each card streams inside its own `<Suspense>` with a skeleton.

**Profile — `/employee/profile`**
- View: employee number, name, department, position, employment type, date hired, company email, username, account status (read-only, from `employees`).
- Edit (permitted personal fields in `employee_profiles`; **Q3** to confirm list): mobile number, personal email, address, birth date, civil status, emergency contact name / relationship / phone.
- Server Action `updateProfile` → zod → update own row. Column-level `GRANT UPDATE` limits editable columns at the DB level.
- Feedback: inline field errors, success toast, pending button state.

**Attendance — `/employee/attendance?month=YYYY-MM`**
- Month calendar (Mon–Sun grid). Each day shows a status badge with text and color: Present, Late, Absent, On leave. Weekends are muted. Future days are empty.
- Month navigation (previous/next), default current month.
- Statistics: present, late, absent, on-leave counts; attendance rate = (present + late) / recorded working days.
- Read-only. Table view of the month below the calendar (date, time in, time out, status, remarks) for accessibility.

**Assigned Tasks — `/employee/tasks`, `/employee/tasks/[id]`**
- List: title, priority badge, due date (overdue highlighted), status badge, progress bar. Filter tabs by status; sort by due date.
- Detail: description, assigned by, dates, progress history timeline (each update with %, remarks, time), review feedback (approved / returned + manager's feedback).
- Update progress form: progress % (0–100, cannot go below the last value — **Q9**), remarks (required, max 1000), checkbox "Submit as finished for review" (forces 100%).
- Server Action → RPC `submit_task_progress`. Blocked when task status is `for_review` or `completed`.
- States: success toast, validation errors, "waiting for review" banner, "returned" banner with feedback.

**Announcements — `/employee/announcements`**
- Tabs: All, Unread (with count). List cards: title, author, published date, excerpt, unread dot.
- Open an announcement (dialog or detail page) → marks it read (insert into `announcement_reads`, idempotent). "Mark as read" button also available; "Mark all as read" optional (**Q11**).

**Leave Request — `/employee/leave/new`**
- Fields: leave type (select), start date, end date, computed duration (live preview: "3 working days"), reason (required, 10–1000 chars), attachments (required when the leave type demands it).
- Attachments: PDF, JPG, PNG; max 5 MB each; max 3 files (**Q8**). Uploaded from the browser directly to Supabase Storage (see 7.3), then the form is submitted.
- Server Action → RPC `create_leave_request` (DB recomputes duration; rejects overlap with existing pending/approved requests; rejects start date in the past — **Q7**).
- Success → redirect to Leave Status with toast.

**Leave Status — `/employee/leave`**
- Tabs: All, Pending, Approved, Rejected. Table: type, dates, days, filed on, status badge.
- Detail drawer/page: reason, attachments (signed download links), decision, reviewer name, decision date, manager remarks.

**Account Settings — `/employee/settings`** (same component reused at `/manager/settings`)
- Change password form (see 4.7) with show/hide toggles, policy checklist, validation errors, success confirmation.

### 5.2 Department Manager portal (`/manager/...`)

**Dashboard — `/manager`**
- Employee count in managed department(s) (active / total).
- Task overview: counts by status, overdue count, tasks waiting for review.
- Pending leave requests: count + latest 5 with quick link.
- Attendance summary: today (present, late, absent, on leave) and month-to-date rate.
- Recent announcements (own department, latest 3).

**Employees — `/manager/employees`, `/manager/employees/[id]`**
- Table: employee no, name, position, employment status badge, account status badge. Search (name, employee no, email). Filters: employment status, account status, department (only shown when the manager manages more than one). Pagination 20 per page via `searchParams`.
- Detail: employment info, contact info (from `employee_profiles`), account status, activation date. Read-only (no admin functions).

**Attendance Review — `/manager/attendance`**
- Filters: department (if more than one), employee, date range (default current month), status. Table: date, employee, time in, time out, status badge, remarks. Summary counts above the table. Pagination.
- Read-only until **Q5** is answered (if managers must record or correct attendance, add a form and an RLS insert/update policy in Phase 5).

**Create and Assign Task — `/manager/tasks/new`**
- Fields: title (3–150), description (max 5000), deadline (date, today or later), priority (low, medium, high), assignee (select of active employees in managed departments).
- Server Action → insert into `tasks` (RLS + trigger check that assignee is in a managed department). Optional Brevo "New task assigned" email (flag `EMAIL_NOTIFY_TASK_ASSIGNED`).
- Confirmation: success dialog with "View task" and "Assign another".

**Task Progress Overview — `/manager/tasks`, `/manager/tasks/[id]`**
- Table: title, assignee, priority, due date, status, progress bar, last update. Filters: status, assignee, priority. "For review" tab highlighted.
- Detail: full progress history with employee remarks. When status is `for_review`: Approve or Return buttons; Return requires feedback (min 5 chars); Approve accepts optional feedback.
- Server Action → RPC `review_task`. Confirmation dialog before the decision.
- Edit task (title, description, deadline, priority) — **Q9** (planned as allowed while not completed).

**Leave Management — `/manager/leave`, `/manager/leave/[id]`**
- Tabs: Pending (default), Approved, Rejected, All. Table: employee, type, dates, days, filed on, status.
- Detail: reason, attachments (signed URLs, 60 s), employee's other leave in the same period.
- Approve (confirmation dialog, optional remarks) / Reject (dialog, reason required). Server Action → RPC `decide_leave_request` records `reviewed_by`, `reviewed_at`, `decision_remarks`, and on approval writes `on_leave` attendance rows.
- Optional Brevo "Leave request approved/rejected" email (flag `EMAIL_NOTIFY_LEAVE_DECISION`).

**Announcements — `/manager/announcements`, `/manager/announcements/new`**
- List of department announcements with status (draft/published), audience, read count ("5 of 12 read").
- Create form: title (3–150), body (plain text with line breaks, max 5000), audience (whole department / selected employees — **Q10**), "Save draft" or "Publish".
- Success toast; publishing sets `published_at`.

---

## 6. Database architecture

All tables are in schema `public` with RLS **enabled**. Helper functions live in schema `private` (not exposed by the Data API). Primary keys use `uuid default gen_random_uuid()` unless stated. Every table has `created_at timestamptz not null default now()`; mutable tables also have `updated_at` maintained by a shared trigger `private.set_updated_at()`.

Extensions: `citext` (case-insensitive email/username), `btree_gist` (leave overlap exclusion).

### 6.1 Enums

```sql
app_role            : 'employee' | 'department_manager'
account_status      : 'pending_activation' | 'active' | 'disabled'
employment_status   : 'active' | 'on_leave' | 'resigned' | 'terminated'
employment_type     : 'regular' | 'probationary' | 'contractual' | 'part_time'   -- Q3
attendance_status   : 'present' | 'late' | 'absent' | 'on_leave'
task_priority       : 'low' | 'medium' | 'high'
task_status         : 'todo' | 'in_progress' | 'for_review' | 'returned' | 'completed'
review_decision     : 'approved' | 'returned'
leave_status        : 'pending' | 'approved' | 'rejected'      -- add 'cancelled' if Q12 = yes
announcement_status : 'draft' | 'published'
announcement_audience : 'department' | 'selected_employees'
email_status        : 'sent' | 'failed'
```

"Overdue" is derived (`due_date < today AND status <> 'completed'`), not stored.

### 6.2 Tables

#### `departments`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| code | text unique not null | e.g. `HR`, `IT` |
| name | text not null | |
| manager_id | uuid null FK → employees(id) on delete set null | Authorized manager |
| created_at, updated_at | timestamptz | |

Constraint (trigger): `manager_id` must reference an employee with `role = 'department_manager'`.
Index: `manager_id`.

#### `employees` (employee record + role assignment + account link)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| employee_no | text unique not null | The "Employee ID" typed at activation (format **Q2**) |
| auth_user_id | uuid unique null FK → auth.users(id) on delete set null | Set at activation |
| department_id | uuid not null FK → departments(id) | |
| role | app_role not null default 'employee' | **Role assignment** (one role per user; only two roles exist) |
| first_name, middle_name, last_name | text (middle null) | |
| company_email | citext unique not null | Also the Supabase Auth email |
| username | citext unique not null | Default username at provisioning; replaced by the employee at activation; check constraint on format |
| position | text not null | Job title |
| employment_type | employment_type not null | |
| employment_status | employment_status not null default 'active' | |
| date_hired | date not null | |
| account_status | account_status not null default 'pending_activation' | |
| activated_at | timestamptz null | |
| created_at, updated_at | timestamptz | |

Constraints: `check (account_status <> 'active' or auth_user_id is not null)`; username regex check.
Indexes: `department_id`; `(department_id, employment_status)`; unique indexes from constraints cover `employee_no`, `company_email`, `username`, `auth_user_id`.

Why role is a column: there are exactly two fixed roles and one role per user, so a separate `user_roles` table adds joins without benefit. Department authority (which departments a manager controls) is stored in `departments.manager_id`.

#### `employee_profiles` (personal, employee-editable)
| Column | Type | Notes |
|---|---|---|
| employee_id | uuid PK FK → employees(id) on delete cascade | 1:1 |
| mobile_number | text null | Check: PH mobile format (Q3) |
| personal_email | citext null | |
| address | text null | max 300 |
| birth_date | date null | check: in the past |
| civil_status | text null | |
| emergency_contact_name, emergency_contact_relationship, emergency_contact_phone | text null | |
| updated_at | timestamptz | |

Splitting HR data (`employees`) from personal data (`employee_profiles`) lets the database restrict employee edits to personal fields only.

#### `account_activation_tokens`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| employee_id | uuid not null FK → employees(id) on delete cascade | |
| token_hash | text unique not null | SHA-256 hex of raw token |
| expires_at | timestamptz not null | |
| used_at | timestamptz null | |
| revoked_at | timestamptz null | |
| requested_ip_hash | text null | HMAC, for audit |
| created_at | timestamptz | |

Index: `(employee_id) where used_at is null and revoked_at is null`.
RLS on, **no policies**; `revoke all` from `anon`, `authenticated`. Service role only.

#### `rate_limit_events`
| Column | Type |
|---|---|
| id | bigint generated always as identity PK |
| action | text not null |
| key_hash | text not null |
| created_at | timestamptz not null default now() |

Index: `(action, key_hash, created_at desc)`. Service role only.

#### `email_log`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| template | text not null | e.g. `activation_verify` |
| recipient_email | citext not null | |
| status | email_status not null | |
| attempts | smallint not null | |
| provider_message_id | text null | Brevo `messageId` |
| last_error | text null | Truncated; never contains tokens |
| related_table, related_id | text, uuid null | e.g. `leave_requests` |
| created_at | timestamptz | |

Index: `(status, created_at desc)`. Service role only. Never stores link URLs or tokens.

#### `attendance_records`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| employee_id | uuid not null FK → employees(id) on delete cascade | |
| work_date | date not null | |
| status | attendance_status not null | |
| time_in, time_out | timestamptz null | check `time_out > time_in` |
| remarks | text null | |
| leave_request_id | uuid null FK → leave_requests(id) on delete set null | Set for `on_leave` rows |
| created_at, updated_at | timestamptz | |

Unique: `(employee_id, work_date)`. Index: `(work_date)` for department date-range queries (joined via employee).

#### `tasks`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| department_id | uuid not null FK → departments(id) | Denormalized for fast RLS |
| assigned_to | uuid not null FK → employees(id) | |
| created_by | uuid not null FK → employees(id) | Manager |
| title | text not null | 3–150 chars |
| description | text not null default '' | max 5000 |
| priority | task_priority not null default 'medium' | |
| due_date | date not null | |
| status | task_status not null default 'todo' | |
| progress_percent | smallint not null default 0 | check 0–100 |
| completed_at | timestamptz null | |
| created_at, updated_at | timestamptz | |

Trigger: `assigned_to` must belong to `department_id`; `department_id` must be managed by `created_by`.
Indexes: `(assigned_to, status)`, `(department_id, status)`, `(due_date)`.

#### `task_progress_updates` (immutable history)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| task_id | uuid not null FK → tasks(id) on delete cascade | |
| employee_id | uuid not null FK → employees(id) | |
| progress_percent | smallint not null | 0–100 |
| remarks | text not null | 1–1000 |
| is_submission | boolean not null default false | true = "submit for review" |
| created_at | timestamptz | |

Index: `(task_id, created_at desc)`.

#### `task_reviews` (immutable history)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| task_id | uuid not null FK → tasks(id) on delete cascade | |
| progress_update_id | uuid not null FK → task_progress_updates(id) | The submission reviewed |
| reviewer_id | uuid not null FK → employees(id) | |
| decision | review_decision not null | |
| feedback | text null | check: required (≥5 chars) when `decision = 'returned'` |
| created_at | timestamptz | |

Index: `(task_id, created_at desc)`. Unique: `progress_update_id` (one decision per submission).

#### `leave_types`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| code | text unique not null | |
| name | text not null | |
| requires_attachment | boolean not null default false | |
| attachment_min_days | smallint null | e.g. sick leave needs a certificate when > 2 days (Q8) |
| is_active | boolean not null default true | |

Seed (placeholder until Q8): Vacation, Sick, Emergency, Bereavement, Maternity, Paternity.

#### `leave_requests`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| employee_id | uuid not null FK → employees(id) | |
| department_id | uuid not null FK → departments(id) | Copied from employee at insert (RLS speed) |
| leave_type_id | uuid not null FK → leave_types(id) | |
| start_date, end_date | date not null | check `end_date >= start_date` |
| duration_days | smallint not null | check > 0; computed by DB function |
| reason | text not null | 10–1000 |
| status | leave_status not null default 'pending' | |
| reviewed_by | uuid null FK → employees(id) | |
| reviewed_at | timestamptz null | |
| decision_remarks | text null | check: required when `status = 'rejected'` |
| created_at, updated_at | timestamptz | |

Constraints:
- `check ((status = 'pending') = (reviewed_by is null and reviewed_at is null))`
- Exclusion: `exclude using gist (employee_id with =, daterange(start_date, end_date, '[]') with &&) where (status in ('pending','approved'))` — no overlapping active requests.

Indexes: `(employee_id, status, start_date desc)`, `(department_id, status, created_at desc)`.

#### `leave_attachments`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| leave_request_id | uuid not null FK → leave_requests(id) on delete cascade | |
| storage_path | text unique not null | `{employee_id}/{uuid}.{ext}` in bucket `leave-attachments` |
| file_name | text not null | Original name, sanitized, max 200 |
| mime_type | text not null | check in (`application/pdf`, `image/jpeg`, `image/png`) |
| size_bytes | integer not null | check ≤ 5 242 880 |
| uploaded_by | uuid not null FK → employees(id) | |
| created_at | timestamptz | |

Index: `leave_request_id`.

#### `announcements`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| department_id | uuid not null FK → departments(id) | |
| author_id | uuid not null FK → employees(id) | |
| title | text not null | 3–150 |
| body | text not null | max 5000 |
| audience | announcement_audience not null default 'department' | |
| status | announcement_status not null default 'draft' | |
| published_at | timestamptz null | check: not null when published |
| created_at, updated_at | timestamptz | |

Index: `(department_id, status, published_at desc)`.

#### `announcement_recipients` (only used when audience = `selected_employees`; drop if Q10 says department-only)
| Column | Type |
|---|---|
| announcement_id | uuid FK → announcements(id) on delete cascade |
| employee_id | uuid FK → employees(id) on delete cascade |
| PK | (announcement_id, employee_id) |

Index: `employee_id`.

#### `announcement_reads` (read receipts)
| Column | Type |
|---|---|
| announcement_id | uuid FK → announcements(id) on delete cascade |
| employee_id | uuid FK → employees(id) on delete cascade |
| read_at | timestamptz not null default now() |
| PK | (announcement_id, employee_id) |

Index: `employee_id`.

### 6.3 Relationships

```
departments 1─* employees            (employees.department_id)
departments *─1 employees            (departments.manager_id — authority)
employees   1─1 employee_profiles
employees   1─* account_activation_tokens
employees   1─* attendance_records
employees   1─* tasks (assigned_to) ; employees 1─* tasks (created_by)
tasks       1─* task_progress_updates 1─0..1 task_reviews
employees   1─* leave_requests 1─* leave_attachments
leave_types 1─* leave_requests
leave_requests 1─* attendance_records (on_leave rows)
departments 1─* announcements 1─* announcement_reads / announcement_recipients
auth.users  1─0..1 employees         (employees.auth_user_id)
```

### 6.4 RLS helper functions (`private` schema)

All are `language sql stable security definer set search_path = ''`. `EXECUTE` granted to `authenticated` only. Policies call them as `(select private.fn())` so Postgres evaluates them once per statement.

| Function | Returns |
|---|---|
| `private.current_employee_id()` | `employees.id` where `auth_user_id = auth.uid()` and `account_status = 'active'`, else null |
| `private.current_role()` | the caller's `app_role` (null if inactive) |
| `private.current_department_id()` | caller's `department_id` |
| `private.managed_department_ids()` | `uuid[]` of departments where `manager_id = current_employee_id()` and caller role is manager |
| `private.count_business_days(start date, end date)` | integer Mon–Fri count (used by RPC and a matching TS util) |

### 6.5 RLS policies

Notation: **me** = `(select private.current_employee_id())`, **mgd** = `(select private.managed_department_ids())`. "None" means no policy, so the operation is denied for `anon` and `authenticated`. `anon` has no policies on any table.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| departments | `id = current_department_id()` or `id = any(mgd)` | None | None | None |
| employees | `id = me` or `department_id = any(mgd)` | None | None | None |
| employee_profiles | `employee_id = me` or employee's dept `= any(mgd)` | None (row created by provisioning) | `employee_id = me`; column `GRANT UPDATE` on personal columns only | None |
| account_activation_tokens, rate_limit_events, email_log | None | None | None | None |
| attendance_records | `employee_id = me` or employee's dept `= any(mgd)` | None (Q5) | None (Q5) | None |
| tasks | `assigned_to = me` or `department_id = any(mgd)` | role = manager, `department_id = any(mgd)`, `created_by = me` | manager, `department_id = any(mgd)`, status ≠ completed; column grant: title, description, priority, due_date | None |
| task_progress_updates | own (`employee_id = me`) or task's dept `= any(mgd)` | None (RPC only) | None | None |
| task_reviews | task assigned to me or task's dept `= any(mgd)` | None (RPC only) | None | None |
| leave_types | all authenticated, `is_active` | None | None | None |
| leave_requests | `employee_id = me` or `department_id = any(mgd)` | None (RPC only) | None (RPC only) | None |
| leave_attachments | via parent: own request or `department_id = any(mgd)` | None (RPC only) | None | None |
| announcements | manager: `department_id = any(mgd)`; employee: `status = 'published'` and `department_id = current_department_id()` and (`audience = 'department'` or exists recipient row for me) | manager, `department_id = any(mgd)`, `author_id = me` | manager, `department_id = any(mgd)` | manager, draft only |
| announcement_recipients | own row, or manager of the announcement's dept | manager of the dept | None | manager of the dept |
| announcement_reads | own; manager may read rows for own dept announcements (read counts) | `employee_id = me` and the announcement is visible to me | None | None |

Views (if used, e.g. `announcements_with_read_state`) are created `with (security_invoker = true)` so RLS still applies.

### 6.6 RPC functions (public, `SECURITY DEFINER`, `search_path = ''`)

| Function | Caller | Behavior |
|---|---|---|
| `consume_activation_token(p_hash)` | service role only | atomic single-use claim, returns `employee_id` |
| `release_activation_token(p_hash)` | service role only | undo claim if not expired |
| `complete_activation(p_employee_id, p_auth_user_id, p_username)` | service role only | link auth user, set username, status `active` |
| `check_rate_limit(p_action, p_key_hash, p_max, p_window)` | service role only | returns boolean |
| `submit_task_progress(p_task_id, p_percent, p_remarks, p_submit)` | authenticated | caller must be assignee; task not `for_review`/`completed`; insert update; set `tasks.progress_percent`, status → `in_progress` or `for_review` |
| `review_task(p_task_id, p_decision, p_feedback)` | authenticated | caller manages task dept; task is `for_review`; insert review on latest submission; status → `completed` (set `completed_at`) or `returned` |
| `create_leave_request(p_leave_type_id, p_start, p_end, p_reason, p_attachments jsonb)` | authenticated | caller is an active employee; computes duration; checks attachment rule; checks each `storage_path` starts with caller's employee id and exists in `storage.objects`; inserts request + attachments |
| `decide_leave_request(p_id, p_decision, p_remarks)` | authenticated | caller manages request dept; caller ≠ requester; status `pending`; sets reviewer fields; on approve upserts `on_leave` rows in `attendance_records` for each business day |

`EXECUTE` is revoked from `public` and `anon` on all RPCs; service-role-only RPCs are not granted to `authenticated`.

### 6.7 Storage

- Bucket `leave-attachments`: **private**, `file_size_limit = 5 MB`, `allowed_mime_types = [application/pdf, image/jpeg, image/png]` (enforced by Supabase, not only the UI).
- Object path: `{employee_id}/{random-uuid}.{ext}`. The original name is kept only in `leave_attachments.file_name`.
- `storage.objects` policies for this bucket:
  - INSERT: `(storage.foldername(name))[1] = me::text`.
  - SELECT: own folder, or folder owner's department `= any(mgd)`.
  - DELETE: own folder **and** the object is not referenced by `leave_attachments` (lets the user remove a file before submitting).
  - UPDATE: none.
- Downloads use `createSignedUrl(path, 60)` from the server client (RLS checked).
- Orphan uploads (uploaded but never submitted) are rare at this scale. Document a manual cleanup query; no scheduled job.

### 6.8 Seed and provisioning data

- `supabase/seed.sql` (local development only): 1 department, 1 manager, 1 employee (both `pending_activation`), `employee_profiles` rows, leave types, ~2 months of sample attendance for the employee, 2 sample tasks, 1 published announcement.
- `supabase/provision/001_initial_accounts.sql` (production, run manually once by the developer): the client's real department and the two real test accounts with real company emails (**Q2, Q13**). No auth users are created by seeds; users must activate.
- RLS test fixtures (`supabase/tests/`) add a second department, manager, and employee to prove cross-department isolation. These never go to production.

---

## 7. Email integration (Brevo)

### 7.1 Integration

- `lib/email/brevo.ts` (`import 'server-only'`): `POST https://api.brevo.com/v3/smtp/email` with header `api-key: BREVO_API_KEY`, JSON body `{ sender, to, subject, htmlContent, textContent, tags }`. Plain `fetch` — no SDK needed.
- Timeout: `AbortSignal.timeout(10_000)`.
- Retries: up to 3 attempts for network errors, HTTP 429, and 5xx, with backoff 500 ms then 1500 ms. No retry for other 4xx (bad key, invalid payload) — log and fail.
- Every attempt result is written to `email_log` (status, attempts, `messageId`, short error).
- Auth emails (activation, already-active notice, recovery) are sent inline during the Server Action, because the user is waiting. The UI message stays generic either way.
- Notification emails (task assigned, leave decision) are sent with `after()` from `next/server` so the action responds immediately; a failure never rolls back the business change.
- `EMAIL_DELIVERY_MODE=log` (development/test): skip Brevo and print subject and link to the server console. `brevo` in production.

### 7.2 Security

- `BREVO_API_KEY` exists only in server env vars (no `NEXT_PUBLIC_` prefix); `lib/env.ts` validates it with zod and is `server-only`.
- Brevo "Authorized IPs" restriction must be **off** for this key, because Vercel functions use changing IPs (otherwise every send fails with 401).
- Sender domain authenticated in Brevo (SPF, DKIM, DMARC) for deliverability (**Q14**).
- All interpolated values are HTML-escaped. Links are built from `APP_URL`, never from the request `Host` header.

### 7.3 Templates (in code, `lib/email/templates/*.ts`, each returns `{ subject, html, text }`)

| Template | Trigger | Content |
|---|---|---|
| `activation_verify` | eligible activation request | Greeting, "Verify your account" button, expiry (30 min), "ignore if not you" |
| `activation_already_active` | activation request for an active account | "Your account is already active", login link, forgot-password link |
| `activation_complete` (optional) | activation completed | Confirmation, username shown, "contact HR if this was not you" |
| `password_reset` | forgot-password request | Reset button, expiry (1 h), "ignore if not you" |
| `password_changed` | successful change/reset | Security notice |
| `task_assigned` (flag) | task created | Title, due date, priority, link to task |
| `leave_decision` (flag) | leave approved/rejected | Dates, decision, remarks, link |

Layout: simple table-based HTML, company name/logo (Q16), blue header bar, plain-text alternative. Code templates are versioned in git; no Brevo dashboard templates required.

---

## 8. UI and UX

### 8.1 Visual system

- Corporate blue and white. Tokens in `app/globals.css` `@theme`: `--color-primary-*` (blue-700 base, e.g. `#1d4ed8`), neutral grays, semantic `success`, `warning`, `danger`, `info`. Final values follow Figma (Q1).
- Font: keep Geist (already loaded in `app/layout.tsx`); remove the `Arial` override and the dark-mode media query in `globals.css`.
- Layout: persistent left sidebar (logo, role-specific nav, user block with logout) + top bar (page title, breadcrumbs). Sidebar collapses to a slide-over drawer below `lg`.
- Tables for operational records with sticky headers, empty states, and pagination. Cards for dashboard summaries.
- Status badges always show text plus color (never color only).

### 8.2 Reusable components (`components/`)

- `ui/`: `Button`, `Input`, `Textarea`, `Select`, `DateInput`, `Checkbox`, `FormField` (label, hint, error with `aria-describedby`), `SubmitButton` (`useFormStatus` pending), `Badge`, `StatusBadge` (maps every enum value to label + color), `Card`, `Table` primitives, `Pagination`, `Tabs` (link-based, uses `searchParams`), `Dialog` / `ConfirmDialog` (native `<dialog>`), `Toast` (small custom provider), `Alert`, `EmptyState`, `Skeleton`, `ProgressBar`, `Avatar` (initials).
- `layout/`: `PortalShell`, `Sidebar`, `Topbar`, `nav-config.ts` (employee and manager nav items), `UserMenu`.
- `data/`: `StatCard`, `FilterBar`, `SearchInput`, `AttendanceCalendar`, `ProgressTimeline`, `FileList`.
- Shared feature components used by both portals: `ChangePasswordForm`, `AnnouncementCard`, `TaskStatusTabs`, `LeaveTable`.

### 8.3 Form pattern

Server Action + `useActionState`. One zod schema per form in `features/<module>/schemas.ts`, used on the client (instant feedback) and the server (authoritative). The action returns `{ ok, message, fieldErrors, values }` so input is kept after an error. Success: toast or redirect. No form library is needed.

### 8.4 States

- `loading.tsx` per portal segment + `<Suspense>` skeletons per dashboard card.
- `error.tsx` per portal segment (friendly message + retry), `app/global-error.tsx`, `app/not-found.tsx`.
- Every list has an empty state. Every destructive or final decision (approve/reject leave, approve/return task, publish announcement) uses `ConfirmDialog`.

---

## 9. Architecture and folder structure

### 9.1 Proposed tree (root `app/`, matching the existing project)

```
proxy.ts                          # session refresh + optimistic redirects
app/
  layout.tsx                      # root: fonts, metadata, ToastProvider
  page.tsx                        # redirect by session/role
  not-found.tsx, global-error.tsx
  globals.css                     # Tailwind v4 + theme tokens
  (auth)/
    layout.tsx                    # centered card layout
    login/page.tsx
    activate/page.tsx
    activate/verify/route.ts      # verifies token, sets httpOnly cookie, redirects
    activate/credentials/page.tsx # Change Default Credentials
    forgot-password/page.tsx
    auth/confirm/page.tsx         # recovery link landing (button POST)
    reset-password/page.tsx
  employee/
    layout.tsx                    # PortalShell with employee nav
    loading.tsx, error.tsx
    page.tsx                      # dashboard
    profile/page.tsx
    attendance/page.tsx
    tasks/page.tsx, tasks/[id]/page.tsx
    announcements/page.tsx
    leave/page.tsx, leave/new/page.tsx, leave/[id]/page.tsx
    settings/page.tsx
  manager/
    layout.tsx, loading.tsx, error.tsx
    page.tsx                      # dashboard
    employees/page.tsx, employees/[id]/page.tsx
    attendance/page.tsx
    tasks/page.tsx, tasks/new/page.tsx, tasks/[id]/page.tsx
    leave/page.tsx, leave/[id]/page.tsx
    announcements/page.tsx, announcements/new/page.tsx
    settings/page.tsx
components/
  ui/  layout/  data/
features/                         # domain logic, one folder per module
  auth/          actions.ts schemas.ts components/
  profile/       queries.ts actions.ts schemas.ts components/
  attendance/    queries.ts components/
  tasks/         queries.ts actions.ts schemas.ts components/
  leave/         queries.ts actions.ts schemas.ts components/
  announcements/ queries.ts actions.ts schemas.ts components/
  dashboard/     queries.ts components/
  employees/     queries.ts components/
lib/
  env.ts                          # zod-validated env (server-only) + public env
  supabase/ client.ts server.ts admin.ts proxy.ts
  auth/ dal.ts tokens.ts rate-limit.ts redirects.ts
  email/ brevo.ts send.ts templates/*.ts
  utils/ dates.ts business-days.ts cn.ts errors.ts
types/
  database.types.ts               # generated by `supabase gen types`
  app.ts                          # shared domain types
supabase/
  config.toml
  migrations/                     # timestamped SQL
  seed.sql                        # local only
  provision/001_initial_accounts.sql
  tests/*.test.sql                # pgTAP RLS tests
tests/
  unit/                           # Vitest
  e2e/                            # Playwright
.env.example
```

Route groups: `(auth)` shares a layout without adding a URL segment. `employee/` and `manager/` are real URL segments, so the proxy can match them by prefix.

### 9.2 Environment variables

| Name | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | publishable/anon key (RLS-protected) |
| `SUPABASE_SECRET_KEY` | server | service role / secret key — admin client only |
| `APP_URL` | server | absolute base URL for email links |
| `BREVO_API_KEY` | server | Brevo transactional API |
| `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` | server | verified sender |
| `EMAIL_DELIVERY_MODE` | server | `brevo` or `log` |
| `EMAIL_NOTIFY_TASK_ASSIGNED`, `EMAIL_NOTIFY_LEAVE_DECISION` | server | `true`/`false` |
| `RATE_LIMIT_SECRET` | server | HMAC key for rate-limit identifiers (32+ random bytes) |
| `ACTIVATION_TOKEN_TTL_MINUTES` | server | default 30 |

### 9.3 Libraries (only what is needed)

| Package | Why |
|---|---|
| `@supabase/supabase-js`, `@supabase/ssr` | Supabase clients with cookie sessions |
| `zod` | Shared validation (client + server + env) |
| `server-only` | Build error if server modules are imported into Client Components |
| `lucide-react` (optional) | Sidebar and status icons; can be replaced by inline SVG |
| dev: `supabase` (CLI) | Migrations, local stack, type generation, `supabase test db` |
| dev: `vitest` | Unit tests |
| dev: `@playwright/test` | E2E tests (Phase 10) |

Not needed: UI kits, form libraries, state managers, Brevo SDK, date libraries (native `Intl` + small helpers are enough), Redis/Upstash.

### 9.4 Next.js 16-specific rules (verified against `node_modules/next/dist/docs`)

- `proxy.ts` (not `middleware.ts`). Keep it to cookie reads and session refresh; no DB queries.
- `cacheComponents: true`: reading `cookies()` outside `<Suspense>` is a build error. Portal layouts render the static shell (sidebar, nav) and put session-dependent parts (user menu, page data) inside `<Suspense>`. Do not `await` the session at the top level of a layout. If a route cannot be restructured in time, use `export const instant = false` on it as a documented temporary measure.
- Per-user data is **not** cached on the server with `use cache` (the RLS client needs cookies). If profiling shows a need, use `use cache: private` for `getCurrentUser()`.
- After mutations, refresh data with `revalidatePath()` / `refresh()` (check the exact API in the installed docs during Phase 4).
- `params` and `searchParams` are Promises in pages; global `PageProps` / `LayoutProps` helpers are available.
- Server Action body limit is 1 MB by default, and Vercel limits function bodies to about 4.5 MB. File uploads therefore go browser → Supabase Storage directly, never through a Server Action.
- Read the relevant docs in `node_modules/next/dist/docs/01-app/` before each phase (AGENTS.md rule).

---

## 10. Phased implementation plan

Order: 1 → 2 → 3 → 4, then 5–8 (each depends on 4; 6 and 7 can swap), then 9 → 10.

### Phase 1 — Foundation, dependencies, environment

- **Objective:** project ready for Supabase work, no features.
- **Features:** env validation, Supabase clients, folder skeleton, theme tokens, tooling.
- **Files:** `.env.example`, `lib/env.ts`, `lib/supabase/{client,server,admin,proxy}.ts`, `lib/utils/cn.ts`, `supabase/config.toml` (via `supabase init`), `vitest.config.ts`, update `app/globals.css` tokens, replace boilerplate `app/page.tsx` with a placeholder redirect, `.gitignore` (`!.env.example`).
- **Database changes:** none.
- **Dependencies:** client answers Q1 (Figma), Supabase project(s) created by the developer (dev + prod, or local Docker stack), Brevo account.
- **Checklist:**
  - [ ] Install packages from 9.3.
  - [ ] `supabase init`; decide local Docker stack vs. hosted dev project (Docker Desktop on Windows required for local).
  - [ ] Env schema with clear error on missing values.
  - [ ] Three Supabase clients; admin client guarded by `server-only`.
  - [ ] Theme tokens, remove dark mode, fix body font.
  - [ ] `npm run lint`, `npx tsc --noEmit`, `npm run build` pass.
- **Acceptance:** build passes; importing `lib/supabase/admin.ts` from a Client Component fails the build; missing env var fails fast with a readable message.
- **Done when:** checklist complete and reviewed.

### Phase 2 — Database schema, constraints, RLS, seeds

- **Objective:** full schema from Section 6 with RLS proven by tests.
- **Files:** `supabase/migrations/` split by domain: `..._extensions_enums.sql`, `..._core_org.sql` (departments, employees, profiles, helpers), `..._auth_support.sql` (tokens, rate limits, email log, auth RPCs), `..._attendance.sql`, `..._tasks.sql`, `..._leave.sql` (+ storage bucket & policies), `..._announcements.sql`; `supabase/seed.sql`; `supabase/provision/001_initial_accounts.sql`; `supabase/tests/*.test.sql`; `types/database.types.ts`.
- **Database changes:** all tables, enums, constraints, indexes, triggers, helper functions, RPCs, RLS, storage bucket and policies.
- **Dependencies:** Phase 1; Q2 (Employee ID format), Q3 (profile fields) can use placeholders.
- **Checklist:**
  - [ ] Migrations apply cleanly on an empty database (`supabase db reset`).
  - [ ] RLS enabled on every table; `revoke` on service-only tables.
  - [ ] Helper functions `security definer`, `search_path = ''`, wrapped in `(select …)` in policies.
  - [ ] pgTAP tests for employee, manager, other-department manager, disabled user, and `anon`.
  - [ ] `supabase gen types typescript` output committed.
  - [ ] Run Supabase advisors (security + performance) on the dev project and fix warnings.
- **Acceptance:** employee sees only own rows; manager sees only managed departments; other-department manager sees nothing; `anon` sees nothing; employee cannot change `tasks.status`, `leave_requests.status`, or HR columns; overlapping leave insert fails; storage path outside own folder is rejected.
- **Done when:** `supabase test db` is green and advisors show no security errors.

### Phase 3 — Authentication, activation, Brevo, protected routes

- **Objective:** complete auth lifecycle from Section 4.
- **Files:** `proxy.ts`, `lib/auth/{dal,tokens,rate-limit,redirects}.ts`, `lib/email/{brevo,send}.ts`, `lib/email/templates/{activation_verify,activation_already_active,password_reset,password_changed}.ts`, `features/auth/{actions,schemas}.ts`, `app/(auth)/**` pages, minimal `app/employee/page.tsx` and `app/manager/page.tsx` placeholders, shared `ChangePasswordForm`.
- **Database changes:** none expected (adjust auth RPCs if needed).
- **Dependencies:** Phase 2; Brevo sender verified (Q14) for real sends — use `EMAIL_DELIVERY_MODE=log` until then; Supabase Auth settings from 4.1.
- **Checklist:**
  - [ ] Activation request with generic response + rate limits.
  - [ ] Token generate/hash/expire/revoke/consume/release.
  - [ ] Verify page (non-consuming GET) + completion action with rollback on failure.
  - [ ] Username login with generic errors and timing equalization.
  - [ ] Role redirect; `?next=` validation.
  - [ ] Logout, forgot password, `/auth/confirm`, reset password, change password.
  - [ ] Proxy matcher excludes `_next/static`, `_next/image`, favicon, and public assets.
  - [ ] `email_log` rows written; no token in logs.
- **Acceptance:** both seeded accounts can activate, log in, reach only their own portal, log out, reset password, and change password. Expired, reused, and tampered tokens fail. Wrong Employee ID/email returns the same message as a correct one. Direct URL to the other role's portal redirects. 6th failed login within 15 min is blocked.
- **Done when:** manual test script for both roles passes and unit tests for token and validation utilities pass.

### Phase 4 — Shared layout, sidebar, components, dashboard foundation

- **Objective:** reusable UI kit and portal shells matching Figma.
- **Files:** `components/ui/*`, `components/layout/*`, `components/data/{StatCard,FilterBar,SearchInput}`, `app/employee/{layout,loading,error}.tsx`, `app/manager/{layout,loading,error}.tsx`, `app/not-found.tsx`, `app/global-error.tsx`, dashboard page skeletons with empty cards.
- **Database changes:** none.
- **Dependencies:** Phase 3; Figma frames (Q1).
- **Checklist:**
  - [ ] Sidebar with active state, keyboard navigation, mobile drawer.
  - [ ] Session-dependent UI inside `<Suspense>` (no `cacheComponents` build errors).
  - [ ] `StatusBadge` covers every enum value.
  - [ ] Toast, Dialog, ConfirmDialog accessible (focus trap via native dialog, Esc closes).
- **Acceptance:** both portals render with correct nav; layout works at 360 px, 768 px, 1280 px; Lighthouse accessibility ≥ 90 on dashboards.
- **Done when:** components are used by both portals with no duplicated page shells.

### Phase 5 — Employee profile and attendance (+ manager employees and attendance review)

- **Objective:** people and attendance data screens.
- **Files:** `features/profile/*`, `features/attendance/*` (`AttendanceCalendar`, stats), `features/employees/*`, pages `employee/profile`, `employee/attendance`, `manager/employees`, `manager/employees/[id]`, `manager/attendance`.
- **Database changes:** only if Q5 requires manager attendance entry (add insert/update policies).
- **Dependencies:** Phase 4; Q3, Q5, Q6.
- **Checklist:**
  - [ ] Profile view + edit with column-restricted update.
  - [ ] Month calendar and statistics with month navigation.
  - [ ] Manager employee list (search, filters, pagination) and detail.
  - [ ] Manager attendance review with filters and pagination.
- **Acceptance:** employee edits only allowed fields (attempting HR fields through a crafted request fails at DB); calendar counts match seed data; manager search returns only own-department employees.
- **Done when:** both roles tested against seed data and RLS fixtures.

### Phase 6 — Tasks (employee updates + manager management)

- **Objective:** full task lifecycle.
- **Files:** `features/tasks/*` (`TaskTable`, `TaskFilters`, `ProgressForm`, `ProgressTimeline`, `ReviewDialog`, `CreateTaskForm`), pages under `employee/tasks` and `manager/tasks`, `lib/email/templates/task_assigned.ts`.
- **Database changes:** none expected.
- **Dependencies:** Phase 4; Q9.
- **Checklist:**
  - [ ] Manager creates and assigns task (assignee list limited to managed departments).
  - [ ] Employee lists, filters, views, and updates progress with remarks.
  - [ ] Submit for review → manager approves or returns with feedback → employee sees feedback.
  - [ ] Overdue highlighting; status filters on both sides.
  - [ ] Optional assignment email behind flag.
- **Acceptance:** status transitions follow `todo → in_progress → for_review → completed | returned → in_progress …`; invalid transitions are rejected by the RPC; employee cannot update another employee's task; return without feedback is rejected.
- **Done when:** happy path and rejection paths pass for both roles.

### Phase 7 — Leave requests, approval workflow, attachments

- **Objective:** leave filing, attachments, and manager decisions.
- **Files:** `features/leave/*` (`LeaveForm`, `AttachmentUploader`, `LeaveTable`, `LeaveDetail`, `DecisionDialog`), `lib/utils/business-days.ts`, pages under `employee/leave` and `manager/leave`, `lib/email/templates/leave_decision.ts`.
- **Database changes:** none expected (adjust leave types/rules after Q7, Q8).
- **Dependencies:** Phase 4 (Phase 5 for `on_leave` calendar display); Q7, Q8, Q12.
- **Checklist:**
  - [ ] Duration preview (TS) matches DB function on test cases (weekends, single day, month boundary).
  - [ ] Direct browser upload to own folder; type/size errors shown; remove before submit.
  - [ ] Attachment-required rule enforced in the RPC.
  - [ ] Status tabs for both roles; detail with signed attachment links.
  - [ ] Approve/reject with confirmation; reject requires reason; reviewer + timestamp recorded; `on_leave` attendance rows created.
  - [ ] Optional decision email behind flag.
- **Acceptance:** overlapping request rejected; manager of another department cannot open the request or its files (signed URL generation fails); manager cannot decide own request; decided requests cannot be decided again.
- **Done when:** both roles tested including attachment edge cases.

### Phase 8 — Announcements and notification functionality

- **Objective:** department announcements with read receipts, plus in-app unread indicators.
- **Files:** `features/announcements/*` (`AnnouncementForm`, `AnnouncementList`, `AnnouncementCard`, `AudiencePicker`), pages under `employee/announcements` and `manager/announcements`, sidebar unread badges (announcements unread, tasks returned, leave decided — counts only).
- **Database changes:** drop `announcement_recipients` if Q10 = department-only.
- **Dependencies:** Phase 4; Q10, Q11.
- **Checklist:**
  - [ ] Manager drafts, publishes, views read counts.
  - [ ] Employee All/Unread tabs, mark as read (idempotent).
  - [ ] Selected-employee audience hidden from non-recipients (RLS).
  - [ ] Final review of email flags and `email_log` failures display (developer-only SQL query documented).
- **Acceptance:** draft invisible to employees; unread count updates after reading; employee in another department sees nothing.
- **Done when:** both roles tested.

### Phase 9 — Dashboard integration and UI refinement

- **Objective:** real data in both dashboards, Figma polish.
- **Files:** `features/dashboard/queries.ts` (parallel count queries), dashboard card components, adjustments across pages.
- **Database changes:** add indexes only if query plans show sequential scans on large seed data.
- **Dependencies:** Phases 5–8.
- **Checklist:**
  - [ ] All cards from 5.1/5.2 with skeletons and empty states.
  - [ ] Visual pass against every Figma frame.
  - [ ] Copy review (consistent labels, status names, date format).
  - [ ] Responsive and keyboard pass.
- **Acceptance:** dashboard numbers match module pages for the same user; no layout shift on load; client sign-off on visuals.
- **Done when:** client approves a demo of both portals.

### Phase 10 — Testing, security verification, performance, Vercel deployment

- **Objective:** production readiness.
- **Files:** `tests/e2e/*.spec.ts`, `playwright.config.ts`, `docs/DEPLOYMENT.md` (short runbook), `docs/TEST-CHECKLIST.md`.
- **Database changes:** apply migrations to production with `supabase db push` (run by the developer, after approval); run provisioning script.
- **Dependencies:** Phases 1–9; production Supabase project, Brevo domain, Vercel project, production domain (Q16).
- **Checklist:**
  - [ ] E2E: login → each module for both roles (seeded active users in local stack).
  - [ ] Manual: activation and reset with real inboxes via Brevo.
  - [ ] Security pass: RLS tests green, advisors clean, no secret in client bundle (search build output for `SUPABASE_SECRET_KEY` value and `BREVO_API_KEY` value), headers (`X-Frame-Options`/CSP frame-ancestors, `Referrer-Policy`) set in `next.config.ts`.
  - [ ] Performance: dashboards < 2 s on a cold Vercel function; indexes used (EXPLAIN on main lists).
  - [ ] Vercel env vars set per environment; Supabase Auth Site URL and redirect URLs updated; Brevo authorized IPs off.
  - [ ] Production smoke test with the two real accounts.
- **Acceptance:** all checklists pass; no critical findings; client completes UAT.
- **Done when:** production URL live and handed over with runbook.

---

## 11. Quality and security

- **TypeScript:** `strict` (already on); add `noUncheckedIndexedAccess`; generated DB types used by all Supabase calls; no `any` in feature code.
- **Validation:** zod schemas shared by client and server; server always re-validates; DB constraints are the final guard (lengths, ranges, enums, date order).
- **Authorization layers:** proxy (optimistic redirect) → DAL in every page/action (role + active status) → RLS + column grants + RPC checks in Postgres → storage policies.
- **Sanitization:** React escapes output; announcement bodies render as plain text with preserved line breaks (no HTML rendering); email templates escape values; file names sanitized; storage paths generated server-side, never from user file names.
- **Secrets:** only two `NEXT_PUBLIC_` vars; secret key and Brevo key only in `server-only` modules; `.env.local` never committed.
- **Errors:** `error.tsx` per portal, `global-error.tsx`; Server Actions never throw raw errors to the client; error IDs logged.
- **Loading:** `loading.tsx` per segment, Suspense skeletons, pending buttons, disabled double-submit.
- **Accessibility:** labeled inputs, `aria-invalid` + `aria-describedby` errors, focus moves to the first error, visible focus rings, WCAG AA contrast for badges, calendar cells with `aria-label` ("March 4, Present"), tables with `<th scope>`, skip-to-content link.
- **Migration strategy:** SQL migrations in `supabase/migrations/` are the only way to change the schema. Never edit an applied migration; add a new one. Test locally with `supabase db reset` + `supabase test db` before `supabase db push`. Regenerate types after each migration. Seeds are local-only; production data goes through reviewed provisioning scripts.
- **Test strategy (both roles):**
  - Unit (Vitest): zod schemas, business-days util, token hashing, redirect `next` validation, email template escaping.
  - Database (pgTAP): every policy for employee, manager, other-department manager, disabled user, anon; every RPC's allowed and forbidden paths.
  - E2E (Playwright): one journey per module per role; cross-role URL access redirects.
  - Manual checklist: activation/reset emails, attachments, responsive layout, keyboard-only use.

---

## 12. Contradictions and gaps found in the brief

1. **"Filter by department" (Attendance Review) vs. manager limited to one department.** Resolved by A3 (manager may manage several departments; filter shows only when there is more than one). Confirm (Q6).
2. **Attendance source is undefined.** Employees only read; managers only "review". Nothing creates records. Resolved for now by A4 (seed/import + automatic `on_leave` rows). Confirm (Q5).
3. **Brevo for password recovery vs. Supabase sending its own recovery email.** Resolved by generating the recovery link server-side and sending it through Brevo (4.6).
4. **"Account activation" and "Verification link" listed as separate emails.** The flow has one verification email. Plan adds an optional "activation complete" confirmation email (Q13).
5. **No admin portal, but accounts must be provisioned, disabled, and assigned to departments.** Resolved by developer-run SQL scripts (A2). The client must accept this operational process (Q13).
6. **Account Settings listed only for employees.** Managers also need password change (A8).
7. **"Upload supporting attachments when required"** — no rule for when they are required (Q8).
8. **"Approve or return task updates where required"** — unclear which updates need review (A6, Q9).
9. **Manager's own leave and attendance** — the manager portal has no leave request page, and no higher approver exists (Q12).
10. **"Edit permitted personal information"** — permitted fields not listed (Q3).

---

## 13. Final summaries

### 13.1 Complete feature checklist

**Authentication**
- [ ] Activate Account page (Employee ID + company email)
- [ ] Generic eligibility response, rate limiting
- [ ] Brevo verification email (single-use, 30-min token)
- [ ] Verify link page + set username/password
- [ ] Username + password login with role redirect
- [ ] Session persistence and refresh (proxy)
- [ ] Logout
- [ ] Forgot password (Brevo) + reset password
- [ ] Change password (both roles)
- [ ] Account status handling (pending, active, disabled)
- [ ] Protected routes + RBAC (proxy, DAL, RLS)

**Employee**
- [ ] Dashboard: welcome, task summary, task progress, leave summary, attendance overview, recent announcements
- [ ] Profile: view, edit permitted fields, feedback
- [ ] Attendance: monthly calendar, status indicators, monthly statistics, read-only
- [ ] Tasks: list, status filter, due dates, priorities, progress %, remarks, submit for review, review feedback, success/error states
- [ ] Announcements: All/Unread, mark as read
- [ ] Leave request: type, dates, auto duration, reason, attachments, submit
- [ ] Leave status: All/Pending/Approved/Rejected, manager decision + remarks
- [ ] Account settings: change password

**Department Manager**
- [ ] Dashboard: employee count, task overview, pending leave, attendance summary, recent announcements
- [ ] Employees: list, search, filters, details, employment + account status
- [ ] Attendance review: filters (department, employee, date range), status display
- [ ] Create and assign task with confirmation
- [ ] Task progress overview: filters, progress, remarks, approve/return with feedback
- [ ] Leave management: filters, details, attachments, approve, reject with reason, reviewer + timestamps
- [ ] Announcements: list, create, audience, publish, feedback
- [ ] Account settings: change password

**Email**
- [ ] Activation verification, already-active notice, password reset, password changed
- [ ] Optional: activation complete, task assigned, leave decision

### 13.2 Database table summary

| Table | Purpose | Written by |
|---|---|---|
| departments | Departments and their manager | Provisioning SQL |
| employees | Employee record, role, account link and status | Provisioning SQL, activation RPC |
| employee_profiles | Editable personal details | Employee (limited columns) |
| account_activation_tokens | Hashed single-use activation tokens | Server (service role) |
| rate_limit_events | Auth rate limiting | Server (service role) |
| email_log | Email delivery audit | Server (service role) |
| attendance_records | Daily attendance per employee | Seed/import, leave approval RPC |
| tasks | Assigned tasks | Manager |
| task_progress_updates | Progress history | Employee via RPC |
| task_reviews | Approve/return decisions | Manager via RPC |
| leave_types | Leave categories and attachment rules | Seed/provisioning |
| leave_requests | Leave applications and decisions | Employee via RPC, manager via RPC |
| leave_attachments | Attachment metadata (files in Storage) | Employee via RPC |
| announcements | Department announcements | Manager |
| announcement_recipients | Selected-employee audience (optional) | Manager |
| announcement_reads | Read receipts | Employee |

### 13.3 Authentication and activation flow (summary)

```
Provisioned employee (pending_activation, default username)
  → / redirects to /activate: Employee ID + company email
  → server validates (generic "check your email" state, rate limited); account NOT activated yet
  → Brevo email with link containing a 256-bit token (hash stored, 30-min expiry)
  → /activate/verify: token checked server-side (not consumed), moved to httpOnly cookie
  → /activate/credentials: current (default) username + new username + new password + confirm
  → token consumed atomically
  → Supabase Admin API creates auth user (password hashed by Supabase)
  → employee linked, status active
  → /login: username → server maps to company email → Supabase signInWithPassword
  → session cookies → DAL reads role → /employee or /manager
Forgot password: username/email → generateLink(recovery) → Brevo → /auth/confirm → verifyOtp → /reset-password
```

### 13.4 Phase dependency summary

```
P1 Foundation
 └─ P2 Schema + RLS
     └─ P3 Auth + Activation + Brevo
         └─ P4 Layout + Components
             ├─ P5 Profile + Attendance (+ manager employees/attendance)
             ├─ P6 Tasks
             ├─ P7 Leave (+ attachments)   ← uses P5 calendar for on_leave display
             └─ P8 Announcements + in-app indicators
                 └─ P9 Dashboards + UI polish   (needs P5–P8)
                     └─ P10 Testing, security, deployment
```

## 14. Pending client clarifications

| # | Question | Blocks |
|---|---|---|
| Q1 | Where are the Figma frames? Export PNGs to `docs/figma/`, or is `Desktop/EMS` the approved design? | P4, P9 |
| Q2 | Employee ID format (e.g. `EMP-0001`) and company email domain(s)? Real details for the two test accounts? | P2, P3 |
| Q3 | Which personal fields may employees edit? Which HR fields are shown (employment types, positions)? | P2, P5 |
| Q4 | Default username format given to new employees (e.g. `emp0001`)? Username rules OK (4–30, lowercase, digits, `._-`)? Password rules confirmed as 8+ chars, uppercase, number, special? Can a username be changed later? Login label: Figma export shows "Username/ Company Email" — should login accept email too? | P3 |
| Q5 | Where does attendance data come from (biometric export, CSV import, manual manager entry, or app clock-in)? Can managers correct records? | P5 |
| Q6 | Work schedule and "late" rule (shift start, grace period)? Can a manager manage more than one department? | P5 |
| Q7 | Leave duration: exclude weekends only, or also holidays? Half-day leave? Can leave be filed for past dates (e.g. sick leave)? | P7 |
| Q8 | Leave types, which ones require attachments and when, allowed file types, size and count limits? | P7 |
| Q9 | Which task updates need manager review? Can progress decrease? Can managers edit, reassign, or delete tasks? | P6 |
| Q10 | Announcement audience options: whole department only, or also selected employees? Do announcements need edit/delete after publishing? | P8 |
| Q11 | Should employees have "Mark all as read"? | P8 |
| Q12 | Can employees cancel a pending leave request? Who approves a manager's own leave (if managers file leave at all)? | P7 |
| Q13 | Who provisions new employees/departments and disables leavers after handover (developer SQL acceptable)? Send an "activation complete" email? | P2, P3 |
| Q14 | Sender email address and domain for Brevo; can the client add SPF/DKIM/DMARC DNS records? | P3, P10 |
| Q15 | Timezone `Asia/Manila` correct? | P2, P5 |
| Q16 | Company name, logo, production domain? | P4, P10 |
| Q17 | Supabase plan (Free pauses inactive projects and lacks leaked-password protection)? Session timeout requirement? | P3, P10 |
| Q18 | Enable optional emails for task assignment and leave decisions? | P6, P7 |

---

## 15. Recommended first implementation step

After approval, start **Phase 1** with this order:

1. Answer Q1, Q2, and Q14 (they gate design, seeds, and email).
2. Create a Supabase **development** project (or install Docker Desktop for the local stack) and a Brevo account; put keys in `.env.local` (not committed).
3. Install `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `server-only`, and dev `supabase`, `vitest`.
4. Add `lib/env.ts` and the three Supabase clients, run `supabase init`, and confirm `npm run build` passes.

Then move to Phase 2 and write the core-organization migration (`departments`, `employees`, `employee_profiles`, `private` helper functions) with its pgTAP tests first, because every other module's RLS depends on those helpers.
