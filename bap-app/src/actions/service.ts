"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { isBlockedByAdmin } from "@/lib/permissions";
import { sendServiceStartWebhook, sendServiceEndWebhook } from "@/lib/discord";

async function requireViewer() {
  const viewer = await getCurrentUser();
  if (!viewer) throw new Error("Non authentifié.");
  return viewer;
}

function displayName(user: { rpFirstName: string; rpLastName: string; robloxUsername: string }) {
  const name = `${user.rpFirstName} ${user.rpLastName}`.trim();
  return name || user.robloxUsername;
}

// Prise de service : le journaliste renseigne l'ID du serveur Roblox sur
// lequel il se déploie. Démarre le chronomètre côté site et notifie
// Discord via webhook (avec son nom et sa photo de profil).
export async function startService(formData: FormData) {
  const viewer = await requireViewer();
  if (isBlockedByAdmin(viewer)) throw new Error("Votre compte est gelé par un administrateur.");

  const serverId = String(formData.get("serverId") || "").trim();
  if (!serverId) throw new Error("Merci de renseigner l'ID du serveur.");

  const db = getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.robloxId, viewer.robloxId)).limit(1);
  if (!user) throw new Error("Utilisateur introuvable.");
  if (user.serviceActive) throw new Error("Un service est déjà en cours.");

  const now = new Date().toISOString();
  const startMessageId = await sendServiceStartWebhook({
    displayName: displayName(user),
    serverId,
    avatarUrl: user.robloxAvatarUrl,
  });

  await db
    .update(schema.users)
    .set({
      serviceActive: true,
      serviceServerId: serverId,
      serviceStartedAt: now,
      serviceStartMessageId: startMessageId,
      lastActivity: now,
    })
    .where(eq(schema.users.robloxId, viewer.robloxId));

  revalidatePath("/profil");
  revalidatePath(`/profil/${viewer.robloxId}`);
}

// Fin de service : cumule la durée dans les statistiques totales
// (heures de service, nombre de prises de service) et notifie Discord.
export async function endService(formData: FormData) {
  void formData;
  const viewer = await requireViewer();

  const db = getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.robloxId, viewer.robloxId)).limit(1);
  if (!user) throw new Error("Utilisateur introuvable.");
  if (!user.serviceActive || !user.serviceStartedAt) throw new Error("Aucun service en cours.");

  const endedAt = new Date().toISOString();
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - new Date(user.serviceStartedAt).getTime()) / 1000));

  await db
    .update(schema.users)
    .set({
      serviceActive: false,
      serviceStartedAt: null,
      serviceStartMessageId: null,
      totalServiceSeconds: user.totalServiceSeconds + elapsedSeconds,
      totalServiceCount: user.totalServiceCount + 1,
      lastActivity: endedAt,
    })
    .where(eq(schema.users.robloxId, viewer.robloxId));

  // Journal horodaté du service, indépendant des compteurs cumulés
  // ci-dessus — sert à calculer les statistiques "ce mois-ci" / archives
  // mensuelles sur la page /statistiques sans jamais réinitialiser de
  // compteur destructivement.
  await db.insert(schema.serviceLogs).values({
    userId: viewer.robloxId,
    serverId: user.serviceServerId,
    startedAt: user.serviceStartedAt,
    endedAt,
    durationSeconds: elapsedSeconds,
  });

  await sendServiceEndWebhook({
    displayName: displayName(user),
    avatarUrl: user.robloxAvatarUrl,
    startMessageId: user.serviceStartMessageId,
  });

  revalidatePath("/profil");
  revalidatePath(`/profil/${viewer.robloxId}`);
}
