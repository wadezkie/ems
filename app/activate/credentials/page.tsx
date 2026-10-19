import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { CredentialsForm } from "@/components/auth/CredentialsForm";
import { getPendingActivationSession } from "@/lib/auth/activation";

export const metadata: Metadata = { title: "Change Default Credentials" };

/**
 * Step 2 of activation. Reachable only while signed in with a still-valid
 * temporary password (see signIn); otherwise back to Login.
 */
export default function CredentialsPage() {
  return (
    <AuthLayout
      illustration="change"
      panelTitle="Almost There!"
      panelText={
        <>
          Replace your default credentials
          <br />
          to secure your account
        </>
      }
      title="Change Default Credentials"
      subtitle="You logged in with temporary credentials. Set a new username and password to finish activating your account."
    >
      <Suspense fallback={<p className="mt-16 text-f20 text-muted">Checking your session…</p>}>
        <VerifiedCredentialsForm />
      </Suspense>
    </AuthLayout>
  );
}

async function VerifiedCredentialsForm() {
  // Expiry compares against the current time, so never run this in a prefetch.
  await connection();
  const pending = await getPendingActivationSession().catch(() => null);
  if (!pending) redirect("/login?activation=expired");
  return <CredentialsForm />;
}
