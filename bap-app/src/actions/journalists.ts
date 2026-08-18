"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { isAdmin, isRedacChef, isBlockedByAdmin } from "@/lib/permissions";
import { addDays } from "@/lib/dates";

async function requireViewer() {
  const viewer = await getCurrentUser();
  if (!viewer) throw new Error("Non authentifié.");
  return viewer;
}

async function requireAdmin() {
  const viewer = await requireViewer();
  if (!isAdmin(viewer.role as "journaliste" | "admin" | "redac_chef")) throw new Error("Réservé aux administrateurs.");
  return viewer;
}

function viewerName(viewer: { rpFirstName: string; rpLastName: string; robloxUsername: string }) {
  const name = `${viewer.rpFirstName} ${viewer.rpLastName}`.trim();
  return name || viewer.robloxUsername;
}

// Un journaliste place lui-même un freeze sur sa propre deadline.
export async function placeFreeze(formData: FormData) {
  const viewer = await requireViewer();
  const amount = Math.max(1, parseInt(String(formData.get("amount") || "1"), 10));

  const db = getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.robloxId, viewer.robloxId)).limit(1);
  if (!user) throw new Error("Utilisateur introuvable.");
  if (isBlockedByAdmin(user)) throw new Error("Indisponible pendant un freeze administrateur.");
  if (amount > user.freezeDays) throw new Error("Vous n'avez pas assez de jours de freeze disponibles.");

  await db
    .update(schema.users)
    .set({
      freezeDays: user.freezeDays - amount,
      deadlineDate: addDays(user.deadlineDate, amount).toISOString(),
    })
    .where(eq(schema.users.robloxId, user.robloxId));

  await db.insert(schema.freezeEntries).values({
    userId: user.robloxId,
    days: amount,
    placedAt: new Date().toISOString(),
  });

  revalidatePath("/profil");
}

// Modification des informations administratives (nom RP, grade, date
// d'arrivée) — réservé aux administrateurs.
export async function updateAdminInfo(formData: FormData) {
  const viewer = await requireViewer();
  if (!isAdmin(viewer.role as "journaliste" | "admin" | "redac_chef")) throw new Error("Réservé aux administrateurs.");

  const userId = String(formData.get("userId"));
  const rpFirstName = String(formData.get("rpFirstName") || "").trim();
  const rpLastName = String(formData.get("rpLastName") || "").trim();
  const grade = String(formData.get("grade") || "");
  const arrivalDate = String(formData.get("arrivalDate") || "");

  const db = getDb();
  await db
    .update(schema.users)
    .set({ rpFirstName, rpLastName, grade, arrivalDate })
    .where(eq(schema.users.robloxId, userId));

  revalidatePath(`/profil/${userId}`);
  revalidatePath("/profil");
  revalidatePath("/admin");
}

// Crédite directement des jours supplémentaires sur la deadline —
// réservé aux administrateurs (ex : problème technique, erreur du Bureau).
export async function creditBonusDays(formData: FormData) {
  const viewer = await requireViewer();
  if (!isAdmin(viewer.role as "journaliste" | "admin" | "redac_chef")) throw new Error("Réservé aux administrateurs.");

  const userId = String(formData.get("userId"));
  const amount = Math.max(1, parseInt(String(formData.get("amount") || "1"), 10));
  const reason = String(formData.get("reason") || "").trim();

  const db = getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.robloxId, userId)).limit(1);
  if (!user) throw new Error("Journaliste introuvable.");

  await db
    .update(schema.users)
    .set({ deadlineDate: addDays(user.deadlineDate, amount).toISOString() })
    .where(eq(schema.users.robloxId, userId));

  await db.insert(schema.historyLogs).values({
    userId,
    adminName: viewerName(viewer),
    action: "Jours crédités",
    detail: `+${amount} jour(s) sur la deadline${reason ? " — " + reason : ""}.`,
    createdAt: new Date().toISOString(),
  });

  revalidatePath(`/profil/${userId}`);
  revalidatePath("/admin");
}

// Place un freeze administrateur : bloque totalement le compte
// (prise/rédaction/envoi d'articles) jusqu'à levée manuelle.
export async function placeAdminFreeze(formData: FormData) {
  const viewer = await requireViewer();
  if (!isAdmin(viewer.role as "journaliste" | "admin" | "redac_chef")) throw new Error("Réservé aux administrateurs.");

  const userId = String(formData.get("userId"));
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) throw new Error("Merci d'indiquer une raison pour ce freeze administrateur.");

  const db = getDb();
  const now = new Date().toISOString();
  await db
    .update(schema.users)
    .set({
      adminFreezeActive: true,
      adminFreezeReason: reason,
      adminFreezePlacedBy: viewerName(viewer),
      adminFreezePlacedDate: now,
    })
    .where(eq(schema.users.robloxId, userId));

  await db.insert(schema.historyLogs).values({
    userId,
    adminName: viewerName(viewer),
    action: "Freeze administrateur placé",
    detail: reason,
    createdAt: now,
  });

  revalidatePath(`/profil/${userId}`);
  revalidatePath("/admin");
}

// Lève un freeze administrateur : repousse la deadline du nombre de
// jours passés sous freeze pour ne pas pénaliser le journaliste.
export async function liftAdminFreeze(formData: FormData) {
  const viewer = await requireViewer();
  if (!isAdmin(viewer.role as "journaliste" | "admin" | "redac_chef")) throw new Error("Réservé aux administrateurs.");

  const userId = String(formData.get("userId"));
  const db = getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.robloxId, userId)).limit(1);
  if (!user || !user.adminFreezeActive || !user.adminFreezePlacedDate) throw new Error("Aucun freeze administrateur actif.");

  const elapsed = Math.max(0, Math.round((Date.now() - new Date(user.adminFreezePlacedDate).getTime()) / (1000 * 60 * 60 * 24)));
  const reason = user.adminFreezeReason || "";

  await db
    .update(schema.users)
    .set({
      deadlineDate: addDays(user.deadlineDate, elapsed).toISOString(),
      adminFreezeActive: false,
      adminFreezeReason: null,
      adminFreezePlacedBy: null,
      adminFreezePlacedDate: null,
    })
    .where(eq(schema.users.robloxId, userId));

  await db.insert(schema.historyLogs).values({
    userId,
    adminName: viewerName(viewer),
    action: "Freeze administrateur levé",
    detail: `Fin du freeze (${reason}). Deadline repoussée de ${elapsed} jour(s).`,
    createdAt: new Date().toISOString(),
  });

  revalidatePath(`/profil/${userId}`);
  revalidatePath("/admin");
}

// Retire directement des jours de la deadline — réservé aux
// administrateurs (ex : correction d'une erreur, sanction). Symétrique
// de creditBonusDays.
export async function removeDays(formData: FormData) {
  const viewer = await requireAdmin();

  const userId = String(formData.get("userId"));
  const amount = Math.max(1, parseInt(String(formData.get("amount") || "1"), 10));
  const reason = String(formData.get("reason") || "").trim();

  const db = getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.robloxId, userId)).limit(1);
  if (!user) throw new Error("Journaliste introuvable.");

  await db
    .update(schema.users)
    .set({ deadlineDate: addDays(user.deadlineDate, -amount).toISOString() })
    .where(eq(schema.users.robloxId, userId));

  await db.insert(schema.historyLogs).values({
    userId,
    adminName: viewerName(viewer),
    action: "Jours retirés",
    detail: `-${amount} jour(s) sur la deadline${reason ? " — " + reason : ""}.`,
    createdAt: new Date().toISOString(),
  });

  revalidatePath(`/profil/${userId}`);
  revalidatePath("/admin");
}

// Retire une ligne de l'historique administratif (nettoyage). Ne
// modifie pas les jours/deadline déjà appliqués : supprime uniquement
// la trace, pas l'effet.
export async function deleteHistoryLog(formData: FormData) {
  await requireAdmin();
  const id = parseInt(String(formData.get("id")), 10);
  const userId = String(formData.get("userId"));

  const db = getDb();
  await db.delete(schema.historyLogs).where(eq(schema.historyLogs.id, id));

  revalidatePath(`/profil/${userId}`);
  revalidatePath("/profil");
}

// Retire une ligne de freeze programmé (nettoyage). Ne restitue pas les
// jours de freeze ni ne modifie la deadline déjà appliqués.
export async function deleteFreezeEntry(formData: FormData) {
  await requireAdmin();
  const id = parseInt(String(formData.get("id")), 10);
  const userId = String(formData.get("userId"));

  const db = getDb();
  await db.delete(schema.freezeEntries).where(eq(schema.freezeEntries.id, id));

  revalidatePath(`/profil/${userId}`);
  revalidatePath("/profil");
}

// Promotion / rétrogradation administrateur — réservé au rédacteur en chef.
export async function toggleAdminRole(formData: FormData) {
  const viewer = await requireViewer();
  if (!isRedacChef(viewer.role as "journaliste" | "admin" | "redac_chef" | "supervision")) {
    throw new Error("Seul le rédacteur en chef peut gérer les droits d'administration.");
  }

  const userId = String(formData.get("userId"));
  const makeAdmin = String(formData.get("makeAdmin")) === "true";
  if (userId === viewer.robloxId) throw new Error("Vous ne pouvez pas modifier vos propres droits.");

  const db = getDb();
  await db
    .update(schema.users)
    .set({ role: makeAdmin ? "admin" : "journaliste" })
    .where(eq(schema.users.robloxId, userId));

  revalidatePath(`/profil/${userId}`);
  revalidatePath("/admin");
}

// Attribution / retrait du rôle "droit de regard" (direction locale) —
// réservé au rédacteur en chef. Ne peut être accordé qu'à un simple
// journaliste (il faut d'abord retirer un autre rôle le cas échéant).
export async function toggleSupervisionRole(formData: FormData) {
  const viewer = await requireViewer();
  if (!isRedacChef(viewer.role as "journaliste" | "admin" | "redac_chef" | "supervision")) {
    throw new Error("Seul le rédacteur en chef peut gérer le droit de regard.");
  }

  const userId = String(formData.get("userId"));
  const makeSupervision = String(formData.get("makeSupervision")) === "true";
  if (userId === viewer.robloxId) throw new Error("Vous ne pouvez pas modifier vos propres droits.");

  const db = getDb();
  const [target] = await db.select().from(schema.users).where(eq(schema.users.robloxId, userId)).limit(1);
  if (!target) throw new Error("Utilisateur introuvable.");

  if (makeSupervision && target.role !== "journaliste") {
    throw new Error("Seul un journaliste peut recevoir le droit de regard (retirez d'abord son rôle actuel).");
  }
  if (!makeSupervision && target.role !== "supervision") {
    throw new Error("Cet utilisateur n'a pas le droit de regard.");
  }

  await db
    .update(schema.users)
    .set({ role: makeSupervision ? "supervision" : "journaliste" })
    .where(eq(schema.users.robloxId, userId));

  revalidatePath(`/profil/${userId}`);
  revalidatePath("/admin");
}
