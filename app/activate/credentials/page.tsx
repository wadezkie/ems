import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { CredentialsForm } from "@/components/auth/CredentialsForm";
import { ACTIVATION_COOKIE, getActivationLinkStatus } from "@/lib/auth/activation";

export const metadata: Metadata = { title: "Change Default Credentials" };

/**
 * Step 3 of activation. Reachable only with a verified, unexpired token in the
 * httpOnly cookie set by /activate/verify; otherwise back to Activate Account.
 */
export default function CredentialsPage() {
  return (
    <AuthLayout
      panelTitle="Almost There!"
      panelText={
        <>
          Replace your default credentials
          <br />
          to secure your account
        </>
      }
      title="Change Default Credentials"
      subtitle="Your email is verified. Set a new username and password to finish activating your account."
    >
      <Suspense fallback={<p className="mt-16 text-f20 text-muted">Checking your verification link…</p>}>
        <VerifiedCredentialsForm />
      </Suspense>
    </AuthLayout>
  );
}

async function VerifiedCredentialsForm() {
  const token = (await cookies()).get(ACTIVATION_COOKIE)?.value ?? "";
  // Token expiry compares against the current time, so never run this in a prefetch.
  await connection();
  const link = await getActivationLinkStatus(token).catch(() => ({ valid: false }) as const);
  if (!link.valid) redirect("/activate?link=expired");
  return <CredentialsForm />;
}
