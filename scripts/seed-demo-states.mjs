// Development sample data so every employee screen state has real rows:
// a task For Review, a task Needs Revision (with manager feedback), an approved
// and a declined leave reviewed by the manager, weekday attendance since the
// start of last month, and a third announcement.
//
//   node --env-file=.env.local scripts/seed-demo-states.mjs
//
// Run after scripts/provision-initial-users.mjs and supabase/seed.sql.
// Safe to re-run: every step checks before writing.

import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

const manilaToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
const day = (offset) => {
  const d = new Date(`${manilaToday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const ago = (hours) => new Date(Date.now() - hours * 3_600_000).toISOString();
const manilaTime = (date, hhmm) => new Date(`${date}T${hhmm}:00+08:00`).toISOString();

const people = await must(admin.from("employees").select("id, employee_id, department_id").in("employee_id", ["MGR-0001", "EMP-0001"]), "employees");
const mgr = people.find((p) => p.employee_id === "MGR-0001");
const emp = people.find((p) => p.employee_id === "EMP-0001");
if (!mgr || !emp) throw new Error("Run scripts/provision-initial-users.mjs first");

/* Tasks */
await must(
  admin
    .from("tasks")
    .update({
      status: "for_review",
      progress: 90,
      employee_remarks: "Diagram updated for the 3rd floor; server room section added.",
      progress_updated_at: ago(24),
    })
    .eq("assigned_to", emp.id)
    .eq("title", "Document current network topology")
    .eq("status", "in_progress"),
  "task for review",
);
await must(
  admin
    .from("tasks")
    .update({
      status: "needs_revision",
      progress: 70,
      employee_remarks: "Closed 18 old tickets.",
      progress_updated_at: ago(48),
      manager_feedback:
        "Please also reassign the remaining printer tickets to the facilities queue and add a short summary of what was closed before resubmitting.",
      reviewed_at: ago(24),
    })
    .eq("assigned_to", emp.id)
    .eq("title", "Review helpdesk ticket backlog")
    .eq("status", "in_progress"),
  "task needs revision",
);
await must(
  admin.from("tasks").update({ reviewed_at: ago(48) }).eq("assigned_to", emp.id).eq("status", "completed").is("reviewed_at", null),
  "task reviewed",
);

/* Leave */
const leave = await must(admin.from("leave_requests").select("status").eq("employee_id", emp.id), "leave");
if (!leave.some((l) => l.status === "approved")) {
  await must(
    admin.from("leave_requests").insert({
      employee_id: emp.id,
      leave_type: "sick",
      start_date: day(-20),
      end_date: day(-19),
      reason: "I am not feeling well and need to rest and recover.",
      status: "approved",
      reviewed_by: mgr.id,
      reviewed_at: ago(21 * 24),
      review_note: "Get well soon!",
      created_at: ago(22 * 24),
    }),
    "approved leave",
  );
}
if (!leave.some((l) => l.status === "rejected")) {
  await must(
    admin.from("leave_requests").insert({
      employee_id: emp.id,
      leave_type: "emergency",
      start_date: day(-8),
      end_date: day(-8),
      reason: "Family matter that needs my attendance.",
      status: "rejected",
      reviewed_by: mgr.id,
      reviewed_at: ago(9 * 24),
      review_note: "Please provide a supporting document or schedule it after the system rollout. You may submit a new request.",
      created_at: ago(10 * 24),
    }),
    "declined leave",
  );
}

/* Attendance: weekdays from the 1st of last month to today */
const rows = [];
const start = new Date(`${manilaToday}T00:00:00Z`);
start.setUTCMonth(start.getUTCMonth() - 1, 1);
for (let d = start; d.toISOString().slice(0, 10) <= manilaToday; d.setUTCDate(d.getUTCDate() + 1)) {
  const iso = d.toISOString().slice(0, 10);
  const weekday = d.getUTCDay();
  if (weekday === 0 || weekday === 6) continue;
  const dom = d.getUTCDate();
  const status = iso === day(-20) || iso === day(-19) ? "on_leave" : dom === 7 || dom === 22 ? "late" : dom === 15 ? "absent" : "present";
  const worked = status === "present" || status === "late";
  rows.push({
    employee_id: emp.id,
    work_date: iso,
    status,
    time_in: worked ? manilaTime(iso, status === "late" ? "08:20" : "07:55") : null,
    time_out: worked && iso < manilaToday ? manilaTime(iso, "17:05") : null,
  });
}
await must(admin.from("attendance").upsert(rows, { onConflict: "employee_id,work_date", ignoreDuplicates: true }), "attendance");

/* Announcement */
const existing = await must(admin.from("announcements").select("id").eq("title", "New Attendance Policy"), "announcement lookup");
if (existing.length === 0) {
  await must(
    admin.from("announcements").insert({
      department_id: mgr.department_id,
      author_id: mgr.id,
      title: "New Attendance Policy",
      body: "Please review the new attendance policy starting next month. Time-in after 8:15 AM will be marked as late.",
      published_at: ago(6),
    }),
    "announcement",
  );
}

console.log(`Seeded demo states (attendance rows considered: ${rows.length}).`);
