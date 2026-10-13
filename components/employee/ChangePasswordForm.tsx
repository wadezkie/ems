"use client";

import { useActionState, useId, useState, type ChangeEvent } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/auth/icons";
import { PASSWORD_RULES } from "@/features/auth/validation";
import { changePassword, signOutAfterPasswordChange, type ChangePasswordState } from "@/features/portal/actions";
import { SuccessScreen, successButtonClass } from "./ui";

const initial: ChangePasswordState = { errors: {} };

/**
 * Figma CHANGE PASSWORD (+ error states), then "Password Changed" →
 * "Credentials Updated Successfully" → sign out and log in again.
 */
export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initial);
  const [step, setStep] = useState<"form" | "credentials">("form");
  const [next, setNext] = useState("");
  const { errors } = state;

  return (
    <>
      <form action={action} noValidate className="mt-9 flex max-w-169 flex-col">
        {state.message && (
          <p role="alert" className="mb-5 rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-f16 text-danger">
            {state.message}
          </p>
        )}

        <PasswordField name="currentPassword" label="Current password" placeholder="Enter current password" autoComplete="current-password" error={errors.currentPassword} />
        <PasswordField
          name="newPassword"
          label="New password"
          placeholder="Enter new password"
          autoComplete="new-password"
          error={errors.newPassword}
          value={next}
          onChange={setNext}
          className="mt-5"
        />
        <PasswordField
          name="confirmPassword"
          label="Confirm New password"
          placeholder="Confirm new password"
          autoComplete="new-password"
          error={errors.confirmPassword}
          className="mt-5"
        />

        <div className="mt-2" aria-live="polite">
          <p className="text-f12 font-semibold text-ink">Password must:</p>
          <ul className="mt-1 space-y-0.5 pl-4 text-f12">
            {PASSWORD_RULES.map((r) => {
              const ok = r.test(next);
              return (
                <li key={r.label} className={`list-disc ${ok ? "text-success" : "text-ink"}`}>
                  {r.label}
                  {ok && <span className="sr-only"> (met)</span>}
                </li>
              );
            })}
          </ul>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mx-auto mt-9 flex h-14 w-full max-w-146 items-center justify-center rounded-[calc(var(--spacing)*3.5)] bg-primary text-f28 font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Changing…" : "Change Password"}
        </button>
      </form>

      {state.success && step === "form" && (
        <SuccessScreen
          title="Password Changed"
          action={
            <button type="button" autoFocus className={successButtonClass} onClick={() => setStep("credentials")}>
              Continue
            </button>
          }
        />
      )}

      {state.success && step === "credentials" && (
        <SuccessScreen
          title={
            <>
              Credentials Updated
              <br />
              Successfully.
            </>
          }
          action={
            <form action={signOutAfterPasswordChange}>
              <button type="submit" autoFocus className={successButtonClass}>
                OK
              </button>
            </form>
          }
        >
          <p>You will be logged out.</p>
          <p>
            Please login again using
            <br />
            your new credentials.
          </p>
        </SuccessScreen>
      )}
    </>
  );
}

function PasswordField({
  name,
  label,
  placeholder,
  autoComplete,
  error,
  value,
  onChange,
  className,
}: {
  name: string;
  label: string;
  placeholder: string;
  autoComplete: string;
  error?: string;
  value?: string;
  onChange?: (v: string) => void;
  className?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className={className}>
      <label htmlFor={id} className="text-f20 text-ink">
        {label}
      </label>
      <div className="relative mt-2.5">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          {...(onChange ? { value, onChange: (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value) } : {})}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`h-15 w-full rounded-[calc(var(--spacing)*1)] border-[1.5px] bg-[#f8f8f8] pr-16 pl-6 text-f18 text-body outline-none transition-[border-color,box-shadow] placeholder:text-[#9a9a9a] focus:ring-3 ${
            error ? "border-[#ff2b2b] focus:ring-danger/15" : "border-line focus:border-primary focus:ring-primary/15"
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute top-1/2 right-4 flex -translate-y-1/2 rounded-sm p-1 text-[#5a5a5a] hover:text-black focus-visible:outline-2 focus-visible:outline-primary [&_svg]:size-7"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-right text-f12 text-[#ff2b2b]">
          {error}
        </p>
      )}
    </div>
  );
}
