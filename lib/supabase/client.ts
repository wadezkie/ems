import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client (publishable key + the user's session cookie, RLS applies).
 * Used only for direct file uploads to Storage, so large files never pass
 * through a server function.
 */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
