"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/permissions";

async function requireAdmin() {
  const viewer = await getCurrentUser();
  if (!viewer) throw new Error("Non authentifié.");
  if (!isAdmin(viewer.role as "journaliste" | "admin" | "redac_chef")) throw new Error("Réservé aux administrateurs.");
  return viewer;
}

// Ajoute une personne à la liste blanche par ID Roblox et/ou nom
// d'utilisateur Roblox. Au moins l'un des deux est requis. L'ID est plus
// fiable (il ne change jamais), le nom d'utilisateur est plus simple à
// connaître pour un administrateur.
export async function addAuthorizedUser(formData: FormData) {
  const viewer = await requireAdmin();

  const robloxIdRaw = String(formData.get("robloxId") || "").trim();
  const robloxUsernameRaw = String(formData.get("robloxUsername") || "").trim();
  const note = String(formData.get("note") || "").trim();

  if (!robloxIdRaw && !robloxUsernameRaw) {
    throw new Error("Merci de renseigner au moins l'ID ou le nom d'utilisateur Roblox.");
  }
  if (robloxIdRaw && !/^\d+$/.test(robloxIdRaw)) {
    throw new Error("L'ID Roblox doit être numérique.");
  }

  const viewerName = `${viewer.rpFirstName} ${viewer.rpLastName}`.trim() || viewer.robloxUsername;

  const db = getDb();
  await db.insert(schema.authorizedRobloxUsers).values({
    robloxId: robloxIdRaw || null,
    robloxUsername: robloxUsernameRaw || null,
    note: note || null,
    addedBy: viewerName,
    addedAt: new Date().toISOString(),
  });

  revalidatePath("/admin");
}

export async function removeAuthorizedUser(formData: FormData) {
  await requireAdmin();
  const id = parseInt(String(formData.get("id")), 10);
  const db = getDb();
  await db.delete(schema.authorizedRobloxUsers).where(eq(schema.authorizedRobloxUsers.id, id));
  revalidatePath("/admin");
}
