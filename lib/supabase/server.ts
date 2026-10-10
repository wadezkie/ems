import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { env } from "@/lib/env";

/**
 * User-scoped client for Server Components and Server Actions.
 * Uses the publishable key + the user's session cookies, so RLS applies.
 * Create one per request; never share it.
 */
export async function createClient() {
  const cookieStore = await cookies();
  // supabase-js checks token expiry against the clock, so never run during a
  // (runtime) prerender: Cache Components rejects Date.now() there.
  await connection();

  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}
