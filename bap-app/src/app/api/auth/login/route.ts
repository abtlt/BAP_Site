import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildAuthorizeUrl, generatePkcePair, generateState, OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from "@/lib/roblox";

// Démarre le flux OAuth2 / PKCE vers la connexion officielle Roblox.
export async function GET() {
  const state = generateState();
  const { verifier, challenge } = generatePkcePair();

  const cookieStore = await cookies();
  const oauthCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10, // 10 minutes, le temps du flux OAuth
  };
  cookieStore.set(OAUTH_STATE_COOKIE, state, oauthCookieOptions);
  cookieStore.set(OAUTH_VERIFIER_COOKIE, verifier, oauthCookieOptions);

  const authorizeUrl = buildAuthorizeUrl(state, challenge);
  return NextResponse.redirect(authorizeUrl);
}
