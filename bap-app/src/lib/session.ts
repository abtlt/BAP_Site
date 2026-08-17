import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

const SESSION_COOKIE = "bap_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 jours

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET manquant ou trop court. Définissez une variable d'environnement AUTH_SECRET (chaîne aléatoire d'au moins 32 caractères)."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(robloxId: string) {
  const token = await new SignJWT({ sub: robloxId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionRobloxId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

// Renvoie l'utilisateur connecté (avec ses données à jour en base), ou
// null s'il n'y a pas de session valide ou si le compte n'existe plus.
export async function getCurrentUser() {
  const robloxId = await getSessionRobloxId();
  if (!robloxId) return null;
  const [user] = await db.select().from(schema.users).where(eq(schema.users.robloxId, robloxId)).limit(1);
  return user ?? null;
}

// Variante qui redirige vers /login si non connecté — à utiliser dans
// les pages/layouts qui exigent une session active.
export async function requireUser() {
  const user = await getCurrentUser();
  return user;
}
