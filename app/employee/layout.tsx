import { PortalShell } from "@/components/portal/PortalShell";

export default function EmployeeLayout({ children }: LayoutProps<"/employee">) {
  return <PortalShell role="employee">{children}</PortalShell>;
}
