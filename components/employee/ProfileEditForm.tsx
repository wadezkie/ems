"use client";

import { useRouter } from "next/navigation";
import { useActionState, type ReactNode } from "react";
import { updateMyProfile, type ProfileState } from "@/features/portal/actions";
import { outlineButtonClass, SuccessScreen, successButtonClass } from "./ui";

type Row = { label: string; value: string };

const initial: ProfileState = { status: "idle", errors: {} };

const inputClass =
  "w-full rounded-md border border-transparent bg-[#f0f0f3] px-2.5 py-1.5 text-sm text-heading outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15 aria-invalid:border-danger";

/**
 * Figma EDIT PROFILE: same table, editable rows on a gray field with a red
 * asterisk. Department stays read-only because it decides which manager can
 * see this employee's records.
 */
export function ProfileEditForm({
  before,
  after,
  values,
}: {
  before: Row[];
  after: Row[];
  values: { position: string; phone: string; address: string };
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateMyProfile, initial);
  const v = state.values ?? values;

  return (
    <form action={action} noValidate className="flex flex-1 flex-col">
      {state.message && (
        <p role="alert" className="mb-3 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {state.message}
        </p>
      )}
      <dl className="rounded-lg border border-line px-2 py-1">
        {before.map((r) => (
          <StaticRow key={r.label} {...r} />
        ))}
        <EditRow label="Position" error={state.errors.position}>
          {(id, invalid) => (
            <input id={id} name="position" defaultValue={v.position} maxLength={120} required aria-invalid={invalid || undefined} className={inputClass} />
          )}
        </EditRow>
        {after.slice(0, 1).map((r) => (
          <StaticRow key={r.label} {...r} />
        ))}
        <EditRow label="Phone" error={state.errors.phone}>
          {(id, invalid) => (
            <input id={id} name="phone" type="tel" inputMode="tel" defaultValue={v.phone} maxLength={20} placeholder="e.g. 0917 123 4567" aria-invalid={invalid || undefined} className={inputClass} />
          )}
        </EditRow>
        {after.slice(1).map((r) => (
          <StaticRow key={r.label} {...r} />
        ))}
        <EditRow label="Address" error={state.errors.address} last>
          {(id, invalid) => (
            <input id={id} name="address" defaultValue={v.address} maxLength={300} placeholder="Street, City, Province" aria-invalid={invalid || undefined} className={inputClass} />
          )}
        </EditRow>
      </dl>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={() => router.push("/employee/profile")} className={`${outlineButtonClass} border-line text-muted`}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={outlineButtonClass}>
          {pending ? "Saving…" : "Save Profile"}
        </button>
      </div>

      {state.status === "saved" && (
        <SuccessScreen
          title={
            <>
              You Have Successfully Updated
              <br />
              Your Personal Information.
            </>
          }
          action={
            <button
              type="button"
              autoFocus
              className={successButtonClass}
              onClick={() => {
                router.push("/employee/profile");
                router.refresh();
              }}
            >
              OK
            </button>
          }
        />
      )}
    </form>
  );
}

export function StaticRow({ label, value, last = false }: Row & { last?: boolean }) {
  return (
    <div className={`grid grid-cols-1 gap-x-4 gap-y-0.5 px-2 py-2 sm:grid-cols-[minmax(0,32%)_1fr] ${last ? "" : "border-b border-line"}`}>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium break-words text-heading">{value}</dd>
    </div>
  );
}

function EditRow({
  label,
  error,
  last = false,
  children,
}: {
  label: string;
  error?: string;
  last?: boolean;
  children: (id: string, invalid: boolean) => ReactNode;
}) {
  const id = `profile-${label.toLowerCase()}`;
  return (
    <div className={`grid grid-cols-1 gap-x-4 gap-y-1 px-2 py-1.5 sm:grid-cols-[minmax(0,32%)_1fr] sm:items-center ${last ? "" : "border-b border-line"}`}>
      <dt>
        <label htmlFor={id} className="text-sm text-muted">
          {label}
        </label>
      </dt>
      <dd className="flex items-start gap-1.5">
        <span aria-hidden className="pt-1.5 text-sm text-danger">
          *
        </span>
        <div className="min-w-0 flex-1">
          {children(id, Boolean(error))}
          {error && (
            <p role="alert" className="mt-1 text-caption text-danger">
              {error}
            </p>
          )}
        </div>
      </dd>
    </div>
  );
}
