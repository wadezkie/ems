import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/** 256-bit URL-safe random token. */
export function generateToken() {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex. Only token hashes are stored in the database. */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Keyed hash for rate-limit identifiers, so raw IPs and emails are never stored. */
export function hashIdentifier(value: string) {
  return createHmac("sha256", env.rateLimitSecret).update(value.trim().toLowerCase()).digest("hex");
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

type Limit = { action: string; key: string; max: number; windowMinutes: number };

/**
 * Records an attempt for every limit and returns false if any is exceeded.
 * Fails closed: a database error counts as "blocked".
 */
export async function checkRateLimits(limits: Limit[]) {
  const admin = createAdminClient();
  const results = await Promise.all(
    limits.map(({ action, key, max, windowMinutes }) =>
      admin.rpc("check_rate_limit", {
        p_action: action,
        p_key_hash: hashIdentifier(key),
        p_max: max,
        p_window: `${windowMinutes} minutes`,
      }),
    ),
  );
  return results.every(({ data, error }) => {
    if (error) console.error("check_rate_limit failed", error.message);
    return !error && data === true;
  });
}
