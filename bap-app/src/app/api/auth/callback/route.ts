import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { exchangeCodeForToken, fetchUserInfo, OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from "@/lib/roblox";
import { createSession } from "@/lib/session";
import { DEADLINE_CYCLE_DAYS, addDays } from "@/lib/dates";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  const verifier = cookieStore.get(OAUTH_VERIFIER_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);
  cookieStore.delete(OAUTH_VERIFIER_COOKIE);

  if (oauthError) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(oauthError)}`, request.url));
  }
  if (!code || !state || !verifier || state !== expectedState) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", request.url));
  }

  let robloxId: string;
  let robloxUsername: string;
  let robloxAvatarUrl: string;

  try {
    const tokens = await exchangeCodeForToken(code, verifier);
    const info = await fetchUserInfo(tokens.access_token);
    robloxId = info.sub;
    robloxUsername = info.preferred_username || info.nickname || info.name || `roblox_${info.sub}`;
    robloxAvatarUrl = info.picture || "";
  } catch (err) {
    console.error("Erreur OAuth Roblox :", err);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }

  // L'utilisateur a-t-il déjà un compte ? (première connexion validée
  // par le passé, ou compte créé manuellement)
  const [existingUser] = await db.select().from(schema.users).where(eq(schema.users.robloxId, robloxId)).limit(1);

  if (!existingUser) {
    // Pas encore de compte : il faut être dans la liste blanche pour en
    // obtenir un. On cherche une correspondance par ID Roblox (fiable)
    // ou par nom d'utilisateur (insensible à la casse).
    const usernameLower = robloxUsername.toLowerCase();
    const [authorized] = await db
      .select()
      .from(schema.authorizedRobloxUsers)
      .where(
        sql`${schema.authorizedRobloxUsers.robloxId} = ${robloxId} OR lower(${schema.authorizedRobloxUsers.robloxUsername}) = ${usernameLower}`
      )
      .limit(1);

    if (!authorized) {
      return NextResponse.redirect(new URL("/access-denied", request.url));
    }

    // Amorçage : si c'est le tout premier compte jamais créé sur le
    // site, il devient automatiquement rédacteur en chef. Il suffit donc
    // au propriétaire du site d'ajouter son propre identifiant Roblox à
    // la liste blanche (voir README / script de seed) et de se connecter
    // en premier. Toute personne suivante devient journaliste par
    // défaut ; seul le rédacteur en chef peut ensuite promouvoir des
    // administrateurs.
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
    const isFirstEverAccount = count === 0;

    const now = new Date().toISOString();
    await db.insert(schema.users).values({
      robloxId,
      robloxUsername,
      robloxAvatarUrl,
      rpFirstName: "",
      rpLastName: "",
      grade: isFirstEverAccount ? "Rédacteur en chef" : "Journaliste stagiaire",
      role: isFirstEverAccount ? "redac_chef" : "journaliste",
      arrivalDate: now,
      lastActivity: now,
      articlesCount: 0,
      freezeDays: 0,
      deadlineDate: addDays(now, DEADLINE_CYCLE_DAYS).toISOString(),
      adminFreezeActive: false,
      createdAt: now,
    });

    await db
      .update(schema.authorizedRobloxUsers)
      .set({ claimedByRobloxId: robloxId })
      .where(eq(schema.authorizedRobloxUsers.id, authorized.id));
  } else {
    // Compte déjà existant : on rafraîchit le pseudo/avatar et la
    // dernière activité, sans revérifier la liste blanche (la retirer
    // n'entraîne pas la suppression rétroactive d'un compte déjà créé).
    await db
      .update(schema.users)
      .set({ robloxUsername, robloxAvatarUrl, lastActivity: new Date().toISOString() })
      .where(eq(schema.users.robloxId, robloxId));
  }

  await createSession(robloxId);
  return NextResponse.redirect(new URL("/profil", request.url));
}
