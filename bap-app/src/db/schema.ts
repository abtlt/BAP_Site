import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ===== Bureau Auxiliaire de Presse — Schéma de base de données =====
// SQLite (via better-sqlite3) pour le développement / auto-hébergement.
// Pour un déploiement serverless (Vercel, etc.), remplacez le driver
// SQLite par un driver Postgres (drizzle-orm supporte les deux avec une
// syntaxe très proche) car le système de fichiers y est éphémère.

export const users = sqliteTable("users", {
  // On utilise l'ID Roblox (numérique, stable, ne change jamais même si
  // l'utilisateur change de pseudo) comme identifiant primaire.
  robloxId: text("roblox_id").primaryKey(),
  robloxUsername: text("roblox_username").notNull(),
  robloxAvatarUrl: text("roblox_avatar_url").notNull().default(""),

  rpFirstName: text("rp_first_name").notNull().default(""),
  rpLastName: text("rp_last_name").notNull().default(""),
  grade: text("grade").notNull().default("Journaliste stagiaire"),

  // 'journaliste' | 'admin' | 'redac_chef'
  role: text("role").notNull().default("journaliste"),

  arrivalDate: text("arrival_date").notNull(),
  lastActivity: text("last_activity").notNull(),
  articlesCount: integer("articles_count").notNull().default(0),

  freezeDays: integer("freeze_days").notNull().default(0),
  deadlineDate: text("deadline_date").notNull(),

  // Freeze administrateur : bloque totalement le compte tant qu'actif.
  adminFreezeActive: integer("admin_freeze_active", { mode: "boolean" }).notNull().default(false),
  adminFreezeReason: text("admin_freeze_reason"),
  adminFreezePlacedBy: text("admin_freeze_placed_by"),
  adminFreezePlacedDate: text("admin_freeze_placed_date"),

  createdAt: text("created_at").notNull(),
});

// Liste blanche des personnes autorisées à accéder au site. Un
// administrateur y ajoute l'ID ou le nom d'utilisateur Roblox d'une
// personne AVANT même qu'elle se connecte. Se connecter avec Roblox est
// ouvert à tous, mais seules les personnes présentes ici obtiennent un
// compte actif sur le site (journaliste par défaut).
export const authorizedRobloxUsers = sqliteTable("authorized_roblox_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  robloxId: text("roblox_id"),
  // Stocké en minuscules pour une comparaison insensible à la casse.
  robloxUsername: text("roblox_username"),
  note: text("note"),
  addedBy: text("added_by").notNull(),
  addedAt: text("added_at").notNull(),
  // Renseigné automatiquement dès que la personne s'est connectée au
  // moins une fois (permet de savoir si l'entrée a été "consommée").
  claimedByRobloxId: text("claimed_by_roblox_id"),
});

export const articles = sqliteTable("articles", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  mainSubject: text("main_subject").notNull().default(""),
  secondSubject: text("second_subject").notNull().default(""),
  extraInfo: text("extra_info").notNull().default(""),
  forPublication: integer("for_publication", { mode: "boolean" }).notNull().default(true),
  grade: text("grade").notNull().default("Journaliste"),

  mainJournalistId: text("main_journalist_id"),
  secondJournalistId: text("second_journalist_id"),

  // 'disponible' | 'en_cours' | 'en_validation' | 'a_corriger' | 'valide'
  status: text("status").notNull().default("disponible"),
  content: text("content").notNull().default(""),

  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),

  // Demande d'annulation en attente (une seule à la fois, comme dans le
  // prototype). null si aucune demande en cours.
  cancelRequestJournalistId: text("cancel_request_journalist_id"),
  cancelRequestReason: text("cancel_request_reason"),
  cancelRequestDate: text("cancel_request_date"),
});

export const articleFiles = sqliteTable("article_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleId: text("article_id").notNull(),
  filename: text("filename").notNull(),
  url: text("url").notNull(),
  size: integer("size").notNull().default(0),
  uploadedAt: text("uploaded_at").notNull(),
});

export const articleComments = sqliteTable("article_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleId: text("article_id").notNull(),
  authorName: text("author_name").notNull(),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
});

// Journal des jours de freeze placés par les journalistes eux-mêmes.
export const freezeEntries = sqliteTable("freeze_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  days: integer("days").notNull(),
  placedAt: text("placed_at").notNull(),
});

// Historique des actions administratives sur un journaliste (jours
// crédités, freeze admin placé/levé).
export const historyLogs = sqliteTable("history_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  adminName: text("admin_name").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull(),
  createdAt: text("created_at").notNull(),
});
