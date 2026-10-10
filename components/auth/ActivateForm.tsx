"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { requestActivation, type ActivationState } from "@/features/auth/actions";
import { hasErrors, validateActivation, type ActivationErrors } from "@/features/auth/validation";
import { Field, linkClass, Notice, PrimaryButton, TextInput } from "./fields";
import { IdCardIcon, MailCheckIcon, MailIcon } from "./icons";

type FieldName = keyof ActivationErrors;

/**
 * Step 1 of activation. Submitting valid details never activates the account;
 * it only asks the server to email a verification link.
 */
export function ActivateForm() {
  const [state, formAction, pending] = useActionState<ActivationState, FormData>(requestActivation, { status: "idle" });
  const [employeeId, setEmployeeId] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [clientErrors, setClientErrors] = useState<ActivationErrors>({});
  // Server errors stay visible until the user edits that field.
  const [edited, setEdited] = useState<FieldName[]>([]);
  const [showForm, setShowForm] = useState(false);

  const serverErrors = state.status === "error" ? state.errors : {};
  const errorFor = (name: FieldName) => clientErrors[name] ?? (edited.includes(name) ? undefined : serverErrors[name]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const errors = validateActivation(employeeId, companyEmail);
    if (hasErrors(errors)) {
      e.preventDefault();
      setClientErrors(errors);
      return;
    }
    setClientErrors({});
    setEdited([]);
    setShowForm(false);
  }

  function onEdit(name: FieldName) {
    setClientErrors((v) => ({ ...v, [name]: undefined }));
    setEdited((v) => (v.includes(name) ? v : [...v, name]));
  }

  if (state.status === "sent" && !showForm && !pending) {
    return (
      <div className="mt-14 flex flex-col items-center text-center">
        <MailCheckIcon className="size-24 text-primary" />
        <h2 className="mt-6 text-f32 leading-[1.2] font-semibold text-ink">Check your email</h2>
        <p role="status" className="mt-5 text-f20 leading-[1.5] text-body">
          If the details match an employee record that still needs activation, we sent a verification link to{" "}
          <strong className="font-semibold break-all text-ink">{state.email}</strong>. The link expires in 30 minutes.
        </p>
        <p className="mt-8 text-f18 leading-[1.5] text-muted">
          Didn&apos;t get it? Check your spam folder, or{" "}
          <button type="button" onClick={() => setShowForm(true)} className={`text-f18 ${linkClass}`}>
            send a new link
          </button>
          .
        </p>
        <LoginFooter />
      </div>
    );
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="mt-19.5 flex flex-col">
      {state.status === "error" && state.message && (
        <Notice tone="error" className="mb-10">
          {state.message}
        </Notice>
      )}

      <Field label="Employee ID" error={errorFor("employeeId")}>
        {(props) => (
          <TextInput
            {...props}
            name="employeeId"
            icon={<IdCardIcon />}
            placeholder="Enter your employee ID"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={employeeId}
            onChange={(e) => {
              setEmployeeId(e.target.value);
              onEdit("employeeId");
            }}
          />
        )}
      </Field>

      <Field label="Company Email" error={errorFor("companyEmail")} className="mt-14">
        {(props) => (
          <TextInput
            {...props}
            name="companyEmail"
            type="email"
            icon={<MailIcon />}
            placeholder="Enter your company email"
            autoComplete="email"
            spellCheck={false}
            value={companyEmail}
            onChange={(e) => {
              setCompanyEmail(e.target.value);
              onEdit("companyEmail");
            }}
          />
        )}
      </Field>

      <PrimaryButton type="submit" disabled={pending} className="mt-16">
        {pending ? "Sending link…" : "Activate Account"}
      </PrimaryButton>

      <LoginFooter />
    </form>
  );
}

function LoginFooter() {
  return (
    <p className="mt-10 text-center text-f14 text-body">
      Already activated?
      <Link href="/login" prefetch={false} className={`ml-3.5 ${linkClass}`}>
        Login here
      </Link>
    </p>
  );
}
