import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "employee" | "department_manager";

export type CurrentUser = {
  employeeRowId: string;
  employeeId: string;
  username: string;
  email: string;
  role: AppRole;
  departmentId: string;
  departmentName: string | null;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  avatarUrl: string | null;
};

export function roleHome(role: AppRole) {
  return role === "department_manager" ? "/manager" : "/employee";
}

/**
 * The signed-in, active employee, or null. Verifies the JWT (getClaims) and
 * reads the role from the employees table — never from user_metadata, which
 * users can edit themselves. Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const authUserId = claims?.claims?.sub;
  if (!authUserId) return null;

  const { data: row, error } = await supabase
    .from("employees")
    .select(
      "id, employee_id, username, email, role, department_id, first_name, last_name, position, avatar_url, activation_status, departments!employees_department_id_fkey(name)",
    )
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw new Error(`current user lookup failed: ${error.message}`);
  if (!row || row.activation_status !== "active") return null;

  const department = row.departments as unknown as { name: string } | null;
  return {
    employeeRowId: row.id,
    employeeId: row.employee_id,
    username: row.username,
    email: row.email,
    role: row.role,
    departmentId: row.department_id,
    departmentName: department?.name ?? null,
    firstName: row.first_name,
    lastName: row.last_name,
    position: row.position,
    avatarUrl: row.avatar_url,
  };
});

/** Use in every protected page and action. Wrong role goes to the user's own portal. */
export async function requireRole(role: AppRole): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(roleHome(user.role));
  return user;
}
