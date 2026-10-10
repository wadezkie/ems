import "server-only";
import type { CurrentUser } from "@/lib/auth/dal";
import { todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/**
 * Portal reads. Every query uses the user-scoped client, so RLS limits rows
 * to the user's own records (employee) or managed departments (manager).
 * Callers must have passed requireRole() first.
 */

export type LeaveType = "vacation" | "sick" | "emergency" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type TaskStatus = "pending" | "in_progress" | "completed";
export type AttendanceStatus = "present" | "late" | "absent" | "on_leave";

type PersonRef = { first_name: string | null; last_name: string | null; username: string } | null;

export type LeaveRow = {
  id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveStatus;
  review_note: string | null;
  created_at: string;
  employee: PersonRef;
};

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  progress: number;
  due_date: string | null;
  assignee: PersonRef;
};

export type AttendanceRow = {
  id: string;
  work_date: string;
  status: AttendanceStatus;
  time_in: string | null;
  time_out: string | null;
  employee: PersonRef;
};

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  published_at: string;
  author: PersonRef;
};

export type EmployeeRow = {
  id: string;
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string;
  email: string;
  position: string | null;
  avatar_url: string | null;
  role: "employee" | "department_manager";
  activation_status: "pending_activation" | "active" | "disabled";
  employment_status: "active" | "on_leave" | "resigned" | "terminated";
  department: { name: string } | null;
};

const PERSON = "first_name, last_name, username";
const LEAVE_COLUMNS = `id, leave_type, start_date, end_date, reason, status, review_note, created_at, employee:employees!leave_requests_employee_id_fkey(${PERSON})`;
const TASK_COLUMNS = `id, title, description, status, priority, progress, due_date, assignee:employees!tasks_assigned_to_fkey(${PERSON})`;
const ATTENDANCE_COLUMNS = `id, work_date, status, time_in, time_out, employee:employees!attendance_employee_id_fkey(${PERSON})`;
const ANNOUNCEMENT_COLUMNS = `id, title, body, published_at, author:employees!announcements_author_id_fkey(${PERSON})`;

function must<T>(result: { data: T | null; error: { message: string } | null }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data as T;
}

function countOf(result: { count: number | null; error: { message: string } | null }, label: string) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.count ?? 0;
}

/* ------------------------------ Employee ------------------------------ */

export async function getEmployeeDashboard(user: CurrentUser) {
  const supabase = await createClient();
  const today = todayIso();
  const me = user.employeeRowId;

  const [tasks, inProgress, pendingLeave, attendance, upcoming, announcement] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assigned_to", me),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assigned_to", me).eq("status", "in_progress"),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("employee_id", me).eq("status", "pending"),
    supabase.from("attendance").select("status").eq("employee_id", me).eq("work_date", today).maybeSingle(),
    supabase
      .from("leave_requests")
      .select(LEAVE_COLUMNS)
      .eq("employee_id", me)
      .in("status", ["pending", "approved"])
      .gte("end_date", today)
      .order("start_date")
      .limit(10),
    supabase.from("announcements").select(ANNOUNCEMENT_COLUMNS).order("published_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return {
    today,
    taskCount: countOf(tasks, "task count"),
    inProgressCount: countOf(inProgress, "in-progress count"),
    pendingLeaveCount: countOf(pendingLeave, "pending leave count"),
    attendanceToday: (must(attendance, "attendance today") as { status: AttendanceStatus } | null)?.status ?? null,
    upcomingLeave: must(upcoming, "upcoming leave") as unknown as LeaveRow[],
    latestAnnouncement: must(announcement, "latest announcement") as unknown as AnnouncementRow | null,
  };
}

export async function listMyTasks(user: CurrentUser) {
  const supabase = await createClient();
  const result = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("assigned_to", user.employeeRowId)
    .order("status")
    .order("due_date", { ascending: true, nullsFirst: false });
  return must(result, "my tasks") as unknown as TaskRow[];
}

export async function listMyAttendance(user: CurrentUser) {
  const supabase = await createClient();
  const result = await supabase
    .from("attendance")
    .select(ATTENDANCE_COLUMNS)
    .eq("employee_id", user.employeeRowId)
    .order("work_date", { ascending: false })
    .limit(60);
  return must(result, "my attendance") as unknown as AttendanceRow[];
}

export async function listMyLeave(user: CurrentUser) {
  const supabase = await createClient();
  const result = await supabase
    .from("leave_requests")
    .select(LEAVE_COLUMNS)
    .eq("employee_id", user.employeeRowId)
    .order("start_date", { ascending: false });
  return must(result, "my leave") as unknown as LeaveRow[];
}

/* ------------------------------ Manager ------------------------------- */

async function managedDepartmentIds(user: CurrentUser) {
  const supabase = await createClient();
  const rows = must(
    await supabase.from("departments").select("id").eq("manager_id", user.employeeRowId),
    "managed departments",
  ) as { id: string }[];
  return rows.map((r) => r.id);
}

async function departmentEmployeeIds(departmentIds: string[]) {
  if (departmentIds.length === 0) return [];
  const supabase = await createClient();
  const rows = must(
    await supabase.from("employees").select("id").in("department_id", departmentIds).eq("role", "employee"),
    "department employees",
  ) as { id: string }[];
  return rows.map((r) => r.id);
}

export async function getManagerDashboard(user: CurrentUser) {
  const supabase = await createClient();
  const today = todayIso();
  const departmentIds = await managedDepartmentIds(user);
  const employeeIds = await departmentEmployeeIds(departmentIds);
  // `in` with an empty list matches nothing, which is the correct result.
  const none = ["00000000-0000-0000-0000-000000000000"];
  const staff = employeeIds.length ? employeeIds : none;
  const depts = departmentIds.length ? departmentIds : none;

  const [inProgress, pendingLeave, onLeaveRows, upcoming, announcement] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).in("department_id", depts).eq("status", "in_progress"),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).in("employee_id", staff).eq("status", "pending"),
    supabase
      .from("leave_requests")
      .select("employee_id")
      .in("employee_id", staff)
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today),
    supabase
      .from("leave_requests")
      .select(LEAVE_COLUMNS)
      .in("employee_id", staff)
      .in("status", ["pending", "approved"])
      .gte("end_date", today)
      .order("start_date")
      .limit(10),
    supabase
      .from("announcements")
      .select(ANNOUNCEMENT_COLUMNS)
      .in("department_id", depts)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const onLeave = new Set((must(onLeaveRows, "on leave") as { employee_id: string }[]).map((r) => r.employee_id));

  return {
    today,
    totalEmployees: employeeIds.length,
    inProgressCount: countOf(inProgress, "in-progress count"),
    pendingLeaveCount: countOf(pendingLeave, "pending leave count"),
    onLeaveCount: onLeave.size,
    upcomingLeave: must(upcoming, "upcoming leave") as unknown as LeaveRow[],
    latestAnnouncement: must(announcement, "latest announcement") as unknown as AnnouncementRow | null,
  };
}

export async function listDepartmentEmployees(user: CurrentUser) {
  const supabase = await createClient();
  const departmentIds = await managedDepartmentIds(user);
  if (departmentIds.length === 0) return [];
  const result = await supabase
    .from("employees")
    .select(
      "id, employee_id, first_name, last_name, username, email, position, avatar_url, role, activation_status, employment_status, department:departments!employees_department_id_fkey(name)",
    )
    .in("department_id", departmentIds)
    .order("role", { ascending: false })
    .order("employee_id");
  return must(result, "department employees") as unknown as EmployeeRow[];
}

export async function listDepartmentTasks(user: CurrentUser) {
  const supabase = await createClient();
  const departmentIds = await managedDepartmentIds(user);
  if (departmentIds.length === 0) return [];
  const result = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .in("department_id", departmentIds)
    .order("status")
    .order("due_date", { ascending: true, nullsFirst: false });
  return must(result, "department tasks") as unknown as TaskRow[];
}

export async function listDepartmentAttendance(user: CurrentUser) {
  const supabase = await createClient();
  const employeeIds = await departmentEmployeeIds(await managedDepartmentIds(user));
  if (employeeIds.length === 0) return [];
  const result = await supabase
    .from("attendance")
    .select(ATTENDANCE_COLUMNS)
    .in("employee_id", employeeIds)
    .order("work_date", { ascending: false })
    .limit(100);
  return must(result, "department attendance") as unknown as AttendanceRow[];
}

export async function listDepartmentLeave(user: CurrentUser) {
  const supabase = await createClient();
  const employeeIds = await departmentEmployeeIds(await managedDepartmentIds(user));
  if (employeeIds.length === 0) return [];
  const result = await supabase
    .from("leave_requests")
    .select(LEAVE_COLUMNS)
    .in("employee_id", employeeIds)
    .order("created_at", { ascending: false });
  return must(result, "department leave") as unknown as LeaveRow[];
}

/* ------------------------------- Shared ------------------------------- */

/** Announcements visible to the user (RLS: own or managed department). */
export async function listAnnouncements() {
  const supabase = await createClient();
  const result = await supabase.from("announcements").select(ANNOUNCEMENT_COLUMNS).order("published_at", { ascending: false }).limit(50);
  return must(result, "announcements") as unknown as AnnouncementRow[];
}
