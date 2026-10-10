import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client. BYPASSES RLS.
 * Only for auth flows (activation, username lookup, rate limits, email log).
 * Never import from a Client Component — `server-only` fails the build if you do.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
