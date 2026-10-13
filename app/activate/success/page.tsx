import type { Metadata } from "next";
import Link from "next/link";
import { SuccessScreen, successButtonClass } from "@/components/employee/ui";

export const metadata: Metadata = { title: "Account Activated" };

/** Figma "Account Activated Successfully" (after Change Default Credentials). */
export default function ActivationSuccessPage() {
  return (
    <SuccessScreen
      title={
        <>
          Account Activated
          <br />
          Successfully.
        </>
      }
      action={
        <Link href="/login" className={successButtonClass}>
          OK
        </Link>
      }
    >
      <p>
        You can now login using your
        <br />
        username and password.
      </p>
    </SuccessScreen>
  );
}
