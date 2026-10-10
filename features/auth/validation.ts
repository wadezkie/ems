/**
 * Field rules shared by the auth forms (instant client feedback) and the
 * Server Actions (authoritative check). Pure functions only, so this file is
 * safe to import from both sides.
 */

export type PasswordRule = { label: string; test: (value: string) => boolean };

// TODO(figma): confirm these match the Change Default Credentials frame.
export const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "One number", test: (v) => /\d/.test(v) },
  { label: "One special character", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const EMPLOYEE_ID = /^[A-Za-z0-9-]{3,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = /^[a-z][a-z0-9._-]{3,29}$/;

export function normalizeEmployeeId(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export type ActivationErrors = { employeeId?: string; companyEmail?: string };

export function validateActivation(employeeId: string, companyEmail: string): ActivationErrors {
  const errors: ActivationErrors = {};
  const id = employeeId.trim();
  const email = companyEmail.trim();

  if (!id) errors.employeeId = "Please enter your employee ID.";
  else if (!EMPLOYEE_ID.test(id)) errors.employeeId = "Enter a valid employee ID.";

  if (!email) errors.companyEmail = "Please enter your company email.";
  else if (!EMAIL.test(email)) errors.companyEmail = "Enter a valid email address.";

  return errors;
}

export type CredentialsInput = {
  currentUsername: string;
  newUsername: string;
  newPassword: string;
  confirmPassword: string;
};

export type CredentialsErrors = Partial<Record<keyof CredentialsInput, string>>;

export function validateCredentials(input: CredentialsInput): CredentialsErrors {
  const errors: CredentialsErrors = {};
  const current = normalizeUsername(input.currentUsername);
  const next = normalizeUsername(input.newUsername);

  if (!current) errors.currentUsername = "Please enter your current username.";

  if (!next) errors.newUsername = "Please enter a new username.";
  else if (!USERNAME.test(next))
    errors.newUsername = "Use 4–30 characters: letters, numbers, dot, dash, or underscore. Start with a letter.";
  else if (next === current) errors.newUsername = "New username must be different from your current username.";

  if (!input.newPassword) errors.newPassword = "Please enter a new password.";
  else if (!PASSWORD_RULES.every((r) => r.test(input.newPassword)))
    errors.newPassword = "Password does not meet all requirements.";

  if (!input.confirmPassword) errors.confirmPassword = "Please confirm your new password.";
  else if (input.confirmPassword !== input.newPassword) errors.confirmPassword = "Passwords do not match.";

  return errors;
}

export function hasErrors(errors: object) {
  return Object.values(errors).some(Boolean);
}
