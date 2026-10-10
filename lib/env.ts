import "server-only";

/**
 * Server environment. Read lazily so a missing value fails the request that
 * needs it with a clear message instead of crashing the build.
 * Only NEXT_PUBLIC_* values may ever reach the browser.
 */

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable ${name}. Add it to .env.local.`);
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabasePublishableKey() {
    return required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  },
  get supabaseSecretKey() {
    return required("SUPABASE_SECRET_KEY");
  },
  get appUrl() {
    return required("APP_URL").replace(/\/$/, "");
  },
  get rateLimitSecret() {
    const value = required("RATE_LIMIT_SECRET");
    if (value.length < 32 && process.env.NODE_ENV === "production") {
      throw new Error("RATE_LIMIT_SECRET must be at least 32 characters in production.");
    }
    return value;
  },
  get brevoApiKey() {
    return required("BREVO_API_KEY");
  },
  get brevoSenderEmail() {
    return required("BREVO_SENDER_EMAIL");
  },
  get brevoSenderName() {
    return required("BREVO_SENDER_NAME");
  },
};
