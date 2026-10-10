import "server-only";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [500, 1500];

export type EmailMessage = {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
  /** Template name for email_log, e.g. "activation_verify". */
  template: string;
  related?: { table: string; id: string };
};

/**
 * Sends one transactional email through Brevo. Server-only: the API key never
 * reaches the browser. Retries network errors, 429, and 5xx; every outcome is
 * written to email_log (without the message body or links).
 */
export async function sendEmail(message: EmailMessage): Promise<{ ok: boolean }> {
  let attempts = 0;
  let lastError: string | null = null;
  let messageId: string | null = null;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    try {
      const res = await fetch(BREVO_URL, {
        method: "POST",
        headers: { "api-key": env.brevoApiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { email: env.brevoSenderEmail, name: env.brevoSenderName },
          to: [message.to],
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
          tags: [message.template],
        }),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });

      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { messageId?: string };
        messageId = body.messageId ?? null;
        lastError = null;
        break;
      }

      const detail = await res.text().catch(() => "");
      lastError = `HTTP ${res.status} ${detail}`.slice(0, 500);
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable) break;
    } catch (error) {
      lastError = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    }

    if (attempts < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, BACKOFF_MS[attempts - 1]));
  }

  const ok = lastError === null;
  if (!ok) console.error(`[email] ${message.template} failed after ${attempts} attempt(s): ${lastError}`);

  const { error } = await createAdminClient()
    .from("email_log")
    .insert({
      template: message.template,
      recipient_email: message.to.email,
      status: ok ? "sent" : "failed",
      attempts,
      provider_message_id: messageId,
      last_error: lastError,
      related_table: message.related?.table ?? null,
      related_id: message.related?.id ?? null,
    });
  if (error) console.error("[email] email_log insert failed", error.message);

  return { ok };
}
