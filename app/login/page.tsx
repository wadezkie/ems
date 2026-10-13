import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import { QueryNotice } from "@/components/auth/QueryNotice";

export const metadata: Metadata = { title: "Login" };

export default function LoginPage() {
  return (
    <AuthLayout
      illustration="login"
      panelTitle="Welcome Back!"
      panelText={
        <>
          Please login using
          <br />
          your username and password
        </>
      }
      title="Login to Your Account"
      subtitle="Use your username and password to login."
    >
      <Suspense fallback={null}>
        <QueryNotice param="activated" value="1" tone="success">
          Your account is activated. Log in with your new username and password.
        </QueryNotice>
        <QueryNotice param="password" value="changed" tone="success">
          Your password was changed. Log in with your new password.
        </QueryNotice>
      </Suspense>
      <LoginForm />
    </AuthLayout>
  );
}
