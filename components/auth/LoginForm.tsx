"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { signIn, type LoginState } from "@/features/auth/actions";
import { Field, linkClass, Notice, PasswordInput, PrimaryButton, TextInput } from "./fields";
import { PersonIcon } from "./icons";

type FieldErrors = LoginState["errors"];

const initialState: LoginState = { errors: {}, username: "" };

/**
 * Username + password login. The server maps the username to the Supabase
 * Auth email, signs in, checks the account is active, and redirects by role.
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  // Server errors stay visible until the user edits a field.
  const [dirty, setDirty] = useState(false);

  const errors: FieldErrors = {
    username: clientErrors.username ?? (dirty ? undefined : state.errors.username),
    password: clientErrors.password ?? (dirty ? undefined : state.errors.password),
  };

  function submit(e: FormEvent<HTMLFormElement>) {
    const missing: FieldErrors = {
      username: username.trim() ? undefined : "Please enter your username.",
      password: password ? undefined : "Please enter your password.",
    };
    if (missing.username || missing.password) {
      e.preventDefault();
      setClientErrors(missing);
      return;
    }
    setClientErrors({});
    setDirty(false);
  }

  function edited() {
    setDirty(true);
    setClientErrors({});
  }

  return (
    <form action={formAction} onSubmit={submit} noValidate className="mt-19.5 flex flex-col">
      {state.message && !dirty && (
        <Notice tone="error" className="mb-10">
          {state.message}
          {state.needsActivation && (
            <>
              {" "}
              <Link href="/activate" prefetch={false} className="font-semibold underline">
                Activate Account
              </Link>
            </>
          )}
        </Notice>
      )}

      <Field label="Username" error={errors.username}>
        {(props) => (
          <TextInput
            {...props}
            name="username"
            icon={<PersonIcon />}
            placeholder="Enter your username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              edited();
            }}
          />
        )}
      </Field>

      <Field label="Password" error={errors.password} className="mt-14">
        {(props) => (
          <PasswordInput
            {...props}
            name="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              edited();
            }}
          />
        )}
      </Field>

      <div className="mt-8 flex items-center justify-between gap-4">
        <label className="flex cursor-pointer items-center gap-3 text-f12 font-semibold text-body">
          <input
            type="checkbox"
            name="remember"
            className="size-6.5 cursor-pointer rounded-sm border-field-border accent-primary"
          />
          Remember me
        </label>
        <Link
          href="/forgot-password"
          prefetch={false}
          className="rounded-sm text-f20 text-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
        >
          Forgot Password?
        </Link>
      </div>

      <PrimaryButton type="submit" disabled={pending} className="mt-10">
        {pending ? "Logging in…" : "Login"}
      </PrimaryButton>

      <p className="mt-10 text-center text-f14 text-body">
        Account not activated?
        <Link
          href="/activate"
          prefetch={false}
          className={`ml-3.5 ${linkClass}`}
        >
          Activate Account
        </Link>
      </p>
    </form>
  );
}
