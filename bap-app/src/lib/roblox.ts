import "server-only";
import { randomBytes, createHash } from "node:crypto";

// ===== Intégration OAuth 2.0 / OpenID Connect officielle de Roblox =====
// Documentation : https://create.roblox.com/docs/cloud/open-cloud/oauth2-overview
//
// On ne demande que le strict nécessaire : les scopes "openid" (requis
// par OIDC pour identifier la personne) et "profile" (qui expose le nom
// d'utilisateur Roblox — c'est le scope le plus restreint proposé par
// Roblox permettant de récupérer le pseudo). Aucune autre information
// du compte (amis, avatars complets, jeux possédés, etc.) n'est demandée.

const AUTHORIZE_ENDPOINT = "https://apis.roblox.com/oauth/v1/authorize";
const TOKEN_ENDPOINT = "https://apis.roblox.com/oauth/v1/token";
const USERINFO_ENDPOINT = "https://apis.roblox.com/oauth/v1/userinfo";

export const OAUTH_STATE_COOKIE = "bap_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "bap_oauth_verifier";

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generatePkcePair() {
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function generateState() {
  return base64url(randomBytes(24));
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable d'environnement ${name} manquante. Consultez le README pour configurer l'application OAuth Roblox.`
    );
  }
  return value;
}

export function buildAuthorizeUrl(state: string, codeChallenge: string) {
  const clientId = getEnv("ROBLOX_CLIENT_ID");
  const redirectUri = getEnv("ROBLOX_REDIRECT_URI");

  const url = new URL(AUTHORIZE_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid profile");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export type RobloxTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token?: string;
};

export async function exchangeCodeForToken(code: string, verifier: string): Promise<RobloxTokenResponse> {
  const clientId = getEnv("ROBLOX_CLIENT_ID");
  const clientSecret = getEnv("ROBLOX_CLIENT_SECRET");
  const redirectUri = getEnv("ROBLOX_REDIRECT_URI");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Échec de l'échange du code OAuth Roblox (${res.status}) : ${text}`);
  }

  return res.json();
}

export type RobloxUserInfo = {
  sub: string; // ID Roblox, stable et unique
  preferred_username?: string;
  nickname?: string;
  name?: string;
  picture?: string;
};

export async function fetchUserInfo(accessToken: string): Promise<RobloxUserInfo> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Échec de récupération du profil Roblox (${res.status}) : ${text}`);
  }
  return res.json();
}
