import type { schema } from "@/db";

export type Role = "journaliste" | "admin" | "redac_chef" | "supervision";
export type UserRow = typeof schema.users.$inferSelect;

export function isAdmin(role: Role): boolean {
  return role === "admin" || role === "redac_chef";
}

export function isRedacChef(role: Role): boolean {
  return role === "redac_chef";
}

// "Droit de regard" — rôle de direction locale : lecture seule sur
// l'effectif et les articles en cours, aucune capacité de gestion
// (pas de création/validation d'article, pas d'accès à la liste blanche).
export function isSupervision(role: Role): boolean {
  return role === "supervision";
}

// Peut ouvrir le panel administrateur (en lecture seule pour le rôle
// "droit de regard", en écriture complète pour admin/rédacteur en chef).
export function canAccessAdminPanel(role: Role): boolean {
  return isAdmin(role) || isSupervision(role);
}

export function isBlockedByAdmin(user: Pick<UserRow, "adminFreezeActive">): boolean {
  return !!user.adminFreezeActive;
}

export const ACTIVE_STATUSES = ["en_cours", "en_validation", "a_corriger"] as const;

export const roleLabels: Record<Role, string> = {
  journaliste: "Journaliste",
  admin: "Administrateur",
  redac_chef: "Rédacteur en chef",
  supervision: "Droit de regard",
};

export const statusLabels: Record<string, { label: string; cls: string }> = {
  disponible: { label: "Disponible", cls: "tag-gold" },
  en_cours: { label: "En rédaction", cls: "tag-orange" },
  en_validation: { label: "En validation", cls: "tag-gray" },
  a_corriger: { label: "À corriger", cls: "tag-red" },
  valide: { label: "Validé", cls: "tag-green" },
};

export const GRADES = [
  "Analyste",
  "Journaliste Junior",
  "Journaliste",
  "Journaliste Senior",
  "Adjoint au Rédacteur en Chef",
  "Rédacteur en Chef",
  "Direction Local",
  "Direction International",
];
