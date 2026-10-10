import { PortalShell } from "@/components/portal/PortalShell";

export default function ManagerLayout({ children }: LayoutProps<"/manager">) {
  return <PortalShell role="department_manager">{children}</PortalShell>;
}
