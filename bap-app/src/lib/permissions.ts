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

// Immunité de deadline : automatique pour le rôle "supervision" (droit de
// regard), ou accordée manuellement par le rédacteur en chef à n'importe
// qui via le flag deadlineImmune.
export function isImmuneFromDeadline(user: Pick<UserRow, "role" | "deadlineImmune">): boolean {
  return user.role === "supervision" || !!user.deadlineImmune;
}

export const ACTIVE_STATUSES = ["en_cours", "en_validation", "a_corriger"] as const;

export const roleLabels: Record<Role, string> = {
  journaliste: "Journaliste",
  admin: "Administrateur",
  redac_chef: "Rédacteur en chef",
  supervision: "Droit de regard",
};

export const statusLabels: Record<string, { label: string; cls: string }> = {
  proposition: { label: "Proposition", cls: "tag-blue" },
  disponible: { label: "Disponible", cls: "tag-gold" },
  en_cours: { label: "En rédaction", cls: "tag-orange" },
  en_validation: { label: "En validation", cls: "tag-gray" },
  a_corriger: { label: "À corriger", cls: "tag-red" },
  valide: { label: "Validé", cls: "tag-green" },
};

// Étiquette d'importance/urgence d'un article disponible : 1 (vert,
// normal), 2 (orange, à traiter bientôt), 3 (rouge, urgent).
export const PRIORITY_LEVELS = [1, 2, 3] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export function priorityTag(level: number): { label: string; cls: string } {
  if (level >= 3) return { label: "Urgent — Niveau 3", cls: "tag-red" };
  if (level === 2) return { label: "À traiter bientôt — Niveau 2", cls: "tag-orange" };
  return { label: "Normal — Niveau 1", cls: "tag-green" };
}

// Couleurs disponibles pour le titre personnalisé d'un profil — mêmes
// teintes que le système d'étiquettes (.tag-{couleur}) déjà en place.
export const TITLE_COLORS = [
  { value: "gold", label: "Or" },
  { value: "green", label: "Vert" },
  { value: "red", label: "Rouge" },
  { value: "blue", label: "Bleu" },
  { value: "orange", label: "Orange" },
  { value: "gray", label: "Gris" },
] as const;

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
