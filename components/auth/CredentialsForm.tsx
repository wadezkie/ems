"use client";

import { useActionState, useState, type FormEvent } from "react";
import { updateDefaultCredentials, type CredentialsState } from "@/features/auth/actions";
import {
  hasErrors,
  PASSWORD_RULES,
  validateCredentials,
  type CredentialsErrors,
  type CredentialsInput,
} from "@/features/auth/validation";
import { Field, Notice, PasswordInput, PrimaryButton, TextInput } from "./fields";
import { CheckIcon, DotIcon, PersonIcon } from "./icons";

type FieldName = keyof CredentialsInput;

const initialState: CredentialsState = { errors: {}, values: { currentUsername: "", newUsername: "" } };

/**
 * Step 3 of activation. The server reads the verified token from an httpOnly
 * cookie; nothing here proves verification on its own.
 */
export function CredentialsForm() {
  const [state, formAction, pending] = useActionState(updateDefaultCredentials, initialState);
  const [values, setValues] = useState<CredentialsInput>({
    currentUsername: "",
    newUsername: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [clientErrors, setClientErrors] = useState<CredentialsErrors>({});
  const [edited, setEdited] = useState<FieldName[]>([]);

  const errorFor = (name: FieldName) => clientErrors[name] ?? (edited.includes(name) ? undefined : state.errors[name]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const errors = validateCredentials(values);
    if (hasErrors(errors)) {
      e.preventDefault();
      setClientErrors(errors);
      return;
    }
    setClientErrors({});
    setEdited([]);
  }

  function bind(name: FieldName) {
    return {
      name,
      value: values[name],
      onChange: (e: { target: { value: string } }) => {
        const value = e.target.value;
        setValues((v) => ({ ...v, [name]: value }));
        setClientErrors((v) => ({ ...v, [name]: undefined }));
        setEdited((v) => (v.includes(name) ? v : [...v, name]));
      },
    };
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="mt-16 flex flex-col">
      {state.message && (
        <Notice tone="error" className="mb-10">
          {state.message}
        </Notice>
      )}

      <Field label="Current Username" error={errorFor("currentUsername")}>
        {(props) => (
          <TextInput
            {...props}
            {...bind("currentUsername")}
            icon={<PersonIcon />}
            placeholder="Enter your default username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        )}
      </Field>

      <Field label="New Username" error={errorFor("newUsername")} className="mt-14">
        {(props) => (
          <TextInput
            {...props}
            {...bind("newUsername")}
            icon={<PersonIcon />}
            placeholder="Enter a new username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        )}
      </Field>

      <Field label="New Password" error={errorFor("newPassword")} className="mt-14">
        {(props) => (
          <PasswordInput
            {...props}
            {...bind("newPassword")}
            aria-describedby={[props["aria-describedby"], "password-rules"].filter(Boolean).join(" ")}
            placeholder="Enter a new password"
            autoComplete="new-password"
          />
        )}
      </Field>
      <PasswordRules password={values.newPassword} />

      <Field label="Confirm New Password" error={errorFor("confirmPassword")} className="mt-10">
        {(props) => (
          <PasswordInput
            {...props}
            {...bind("confirmPassword")}
            placeholder="Re-enter your new password"
            autoComplete="new-password"
          />
        )}
      </Field>

      <PrimaryButton type="submit" disabled={pending} className="mt-16">
        {pending ? "Updating…" : "Update Credentials"}
      </PrimaryButton>
    </form>
  );
}

function PasswordRules({ password }: { password: string }) {
  return (
    <ul id="password-rules" aria-label="Password requirements" className="mt-10 grid grid-cols-2 gap-x-6 gap-y-2">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li
            key={rule.label}
            className={`flex items-center gap-2 text-f18 leading-[1.3] ${met ? "text-success" : "text-muted"}`}
          >
            {met ? <CheckIcon className="size-5 shrink-0" /> : <DotIcon className="size-5 shrink-0" />}
            {rule.label}
            <span className="sr-only">{met ? "(met)" : "(not met)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
