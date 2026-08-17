import type { schema } from "@/db";

export type Role = "journaliste" | "admin" | "redac_chef";
export type UserRow = typeof schema.users.$inferSelect;

export function isAdmin(role: Role): boolean {
  return role === "admin" || role === "redac_chef";
}

export function isRedacChef(role: Role): boolean {
  return role === "redac_chef";
}

export function isBlockedByAdmin(user: Pick<UserRow, "adminFreezeActive">): boolean {
  return !!user.adminFreezeActive;
}

export const ACTIVE_STATUSES = ["en_cours", "en_validation", "a_corriger"] as const;

export const roleLabels: Record<Role, string> = {
  journaliste: "Journaliste",
  admin: "Administrateur",
  redac_chef: "Rédacteur en chef",
};

export const statusLabels: Record<string, { label: string; cls: string }> = {
  disponible: { label: "Disponible", cls: "tag-gold" },
  en_cours: { label: "En rédaction", cls: "tag-orange" },
  en_validation: { label: "En validation", cls: "tag-gray" },
  a_corriger: { label: "À corriger", cls: "tag-red" },
  valide: { label: "Validé", cls: "tag-green" },
};

export const GRADES = ["Journaliste stagiaire", "Journaliste", "Journaliste senior", "Rédacteur en chef"];
