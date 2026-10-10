import type { Metadata } from "next";
import { Suspense } from "react";
import { Avatar, Badge, DataTable, EmptyState, PageBody, PageHeader, PageSkeleton, STATUS_TONE } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { listDepartmentEmployees } from "@/lib/data/portal";
import { fullName, titleCase, todayIso } from "@/lib/format";

export const metadata: Metadata = { title: "Employees" };

const ACCOUNT_LABEL = { pending_activation: "Pending Activation", active: "Active", disabled: "Disabled" } as const;

export default function EmployeesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Employees />
    </Suspense>
  );
}

async function Employees() {
  const user = await requireRole("department_manager");
  const employees = await listDepartmentEmployees(user);

  return (
    <PageBody>
      <PageHeader title="Employees" today={todayIso()} />
      <p className="mt-4 text-f18 text-subtle">
        {employees.length} {employees.length === 1 ? "person" : "people"} in {user.departmentName ?? "your department"}
      </p>

      {employees.length === 0 ? (
        <EmptyState>No employees in your department yet.</EmptyState>
      ) : (
        <DataTable head={["Employee ID", "Name", "Position", "Department", "Email", "Account", "Status"]}>
          {employees.map((e) => {
            const name = fullName(e);
            return (
              <tr key={e.id}>
                <td className="font-medium whitespace-nowrap text-ink">{e.employee_id}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar name={name} src={e.avatar_url} className="size-10 border border-card-border/40 text-f14" />
                    <span className="whitespace-nowrap">{name}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap">
                  {e.position ?? (e.role === "department_manager" ? "Department Manager" : "—")}
                </td>
                <td>{e.department?.name ?? "—"}</td>
                <td className="break-all">{e.email}</td>
                <td>
                  <Badge tone={STATUS_TONE[e.activation_status] ?? "gray"}>{ACCOUNT_LABEL[e.activation_status]}</Badge>
                </td>
                <td>
                  <Badge tone={STATUS_TONE[e.employment_status] ?? "gray"}>{titleCase(e.employment_status)}</Badge>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </PageBody>
  );
}
