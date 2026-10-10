"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { EyeIcon, EyeOffIcon, LockIcon } from "./icons";

/* ------------------------------ Field ------------------------------- */

export interface ControlProps {
  id: string;
  invalid: boolean;
  "aria-describedby"?: string;
}

export function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: (props: ControlProps) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={`flex flex-col ${className ?? ""}`}>
      <label htmlFor={id} className="text-f20 leading-[1.4] text-ink">
        {label}
      </label>
      <div className="relative mt-4.5">
        {children({ id, invalid: Boolean(error), "aria-describedby": error ? errorId : undefined })}
        {/* Sits in the gap below the input (as in Figma), so the layout does not shift. */}
        {error && (
          <p id={errorId} role="alert" className="absolute top-full right-3.5 mt-1.5 text-f18 leading-none text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- TextInput ----------------------------- */

export interface TextInputProps extends Omit<ComponentProps<"input">, "id"> {
  id: string;
  icon: ReactNode;
  invalid: boolean;
  /** Control pinned to the right edge (password toggle). */
  end?: ReactNode;
}

export function TextInput({ icon, invalid, end, className, ...props }: TextInputProps) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className={`pointer-events-none absolute top-1/2 left-6.5 -translate-y-1/2 [&_svg]:size-7 ${invalid ? "text-danger" : "text-muted"}`}
      >
        {icon}
      </span>
      <input
        aria-invalid={invalid || undefined}
        className={`h-20 w-full rounded-[calc(var(--spacing)*0.5)] border-2 bg-field pl-18.5 text-f20 text-body outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:ring-3 ${
          invalid
            ? "border-danger focus:ring-danger/15"
            : "border-field-border hover:border-[#bdbdbd] focus:border-primary focus:ring-primary/15"
        } ${end ? "pr-18" : "pr-6"} ${className ?? ""}`}
        {...props}
      />
      {end}
    </div>
  );
}

export function PasswordInput(props: Omit<TextInputProps, "type" | "icon" | "end">) {
  const [visible, setVisible] = useState(false);
  return (
    <TextInput
      {...props}
      type={visible ? "text" : "password"}
      icon={<LockIcon />}
      end={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute top-1/2 right-6.5 flex -translate-y-1/2 rounded-sm p-0.5 text-body hover:text-black focus-visible:outline-2 focus-visible:outline-primary [&_svg]:size-8.75"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  );
}

/* ----------------------------- Buttons ------------------------------ */

const primaryButton =
  "mx-auto h-20 w-151 max-w-full rounded-[calc(var(--spacing)*4.5)] bg-primary text-f32 font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-70";

export function PrimaryButton({ className, ...props }: ComponentProps<"button">) {
  return <button className={`${primaryButton} ${className ?? ""}`} {...props} />;
}

export const linkClass =
  "rounded-sm text-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link";

/* ------------------------------ Notice ------------------------------ */

/** Inline banner for form-level success or error messages. */
export function Notice({ tone, children, className }: { tone: "success" | "error"; children: ReactNode; className?: string }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-[calc(var(--spacing)*2)] border-2 px-6 py-4 text-f18 leading-[1.4] ${
        tone === "error" ? "border-danger/40 bg-danger/5 text-danger" : "border-success/40 bg-success/5 text-success"
      } ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
