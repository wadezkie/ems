import type { Metadata } from "next";
import { ActivateForm } from "@/components/auth/ActivateForm";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const metadata: Metadata = { title: "Activate Account" };

/** Entry point for newly provisioned employees (step 1 of activation). */
export default function ActivatePage() {
  return (
    <AuthLayout
      illustration="activate"
      panelTitle="Get Started!"
      panelText={
        <>
          Activate your account using
          <br />
          your employee ID and company email
        </>
      }
      title="Activate Your Account"
      subtitle="Enter your details to activate your account."
    >
      <ActivateForm />
    </AuthLayout>
  );
}
