import { NextResponse, type NextRequest } from "next/server";
import { ACTIVATION_COOKIE, ACTIVATION_COOKIE_PATH, getActivationLinkStatus } from "@/lib/auth/activation";

/**
 * Target of the emailed verification link.
 *
 * Checks the token on the server without consuming it, moves it into a
 * short-lived httpOnly cookie, and redirects to Change Default Credentials so
 * the token leaves the address bar. The token is consumed only when the new
 * credentials are saved.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";

  let link;
  try {
    link = await getActivationLinkStatus(token);
  } catch (error) {
    console.error("activation verify failed", error);
    link = { valid: false } as const;
  }

  if (!link.valid) {
    return NextResponse.redirect(new URL("/activate?link=expired", request.url));
  }

  const response = NextResponse.redirect(new URL("/activate/credentials", request.url));
  response.cookies.set(ACTIVATION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: ACTIVATION_COOKIE_PATH,
    expires: new Date(link.expiresAt),
  });
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
