import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PORTALS = { employee: "/employee", department_manager: "/manager" } as const;
type Role = keyof typeof PORTALS;

/** Pages a signed-in, active user has no reason to see. */
const SIGNED_OUT_ONLY = ["/", "/login", "/activate"];

function under(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Refreshes the Supabase session cookie on every matched request, then routes
 * by role before anything renders:
 * - signed-out visitors to /employee/* or /manager/* go to /login
 * - an active user in the other role's portal goes to their own portal
 * - an active user on /, /login, or /activate goes to their portal
 * Pages and actions still re-check the user and role (lib/auth/dal.ts).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    },
  );

  // Validates the JWT and refreshes it when needed. Do not run code between
  // client creation and this call.
  const { data } = await supabase.auth.getClaims();
  const authUserId = data?.claims?.sub;

  const { pathname } = request.nextUrl;
  const inPortal = Object.values(PORTALS).some((p) => under(pathname, p));
  const signedOutOnly = SIGNED_OUT_ONLY.includes(pathname);

  const redirectTo = (target: string) => {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (!inPortal && !signedOutOnly) return response;
  if (!authUserId) return inPortal ? redirectTo("/login") : response;

  // Role comes from the employees table (RLS: a user can read their own row).
  const { data: employee } = await supabase
    .from("employees")
    .select("role, activation_status")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  const role = employee?.activation_status === "active" ? (employee.role as Role) : null;

  if (!role) return inPortal ? redirectTo("/login") : response;

  const home = PORTALS[role];
  if (signedOutOnly || (inPortal && !under(pathname, home))) return redirectTo(home);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
