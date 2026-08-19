import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ===== Bureau Auxiliaire de Presse — Schéma de base de données =====
// SQLite via Cloudflare D1 (drizzle-orm/d1). Le dialecte SQLite de D1 est
// compatible avec ce schéma sans modification.

export const users = sqliteTable("users", {
  // On utilise l'ID Roblox (numérique, stable, ne change jamais même si
  // l'utilisateur change de pseudo) comme identifiant primaire.
  robloxId: text("roblox_id").primaryKey(),
  robloxUsername: text("roblox_username").notNull(),
  robloxAvatarUrl: text("roblox_avatar_url").notNull().default(""),

  rpFirstName: text("rp_first_name").notNull().default(""),
  rpLastName: text("rp_last_name").notNull().default(""),
  grade: text("grade").notNull().default("Analyste"),

  // Titre personnalisé affiché sur la fiche profil (à droite de la carte
  // photo/nom/grade) — défini par un administrateur, avec une couleur au
  // choix parmi celles du système d'étiquettes déjà existant.
  customTitle: text("custom_title").notNull().default(""),
  customTitleColor: text("custom_title_color").notNull().default("gold"),

  // 'journaliste' | 'admin' | 'redac_chef' | 'supervision' (droit de regard)
  role: text("role").notNull().default("journaliste"),

  // Immunité de deadline accordée manuellement par le rédacteur en chef à
  // n'importe qui (indépendamment du rôle) — le rôle "supervision" reste
  // par ailleurs toujours immunisé automatiquement.
  deadlineImmune: integer("deadline_immune", { mode: "boolean" }).notNull().default(false),

  arrivalDate: text("arrival_date").notNull(),
  lastActivity: text("last_activity").notNull(),
  articlesCount: integer("articles_count").notNull().default(0),

  // Expérience cumulée (75 xp par article validé) — voir lib/xp.ts pour
  // le calcul du niveau / de la progression à partir de ce total.
  xp: integer("xp").notNull().default(0),

  freezeDays: integer("freeze_days").notNull().default(0),
  deadlineDate: text("deadline_date").notNull(),

  // Service RP en cours (déploiement sur un serveur Roblox). Un seul
  // service actif à la fois par journaliste.
  serviceActive: integer("service_active", { mode: "boolean" }).notNull().default(false),
  serviceServerId: text("service_server_id").notNull().default(""),
  serviceStartedAt: text("service_started_at"),
  // Id du message Discord de prise de service — permet de faire référence
  // à ce message depuis l'embed de fin de service (les webhooks Discord
  // ne permettent pas de "répondre" nativement à un message).
  serviceStartMessageId: text("service_start_message_id"),

  // Statistiques cumulées de service, mises à jour à chaque fin de service.
  totalServiceSeconds: integer("total_service_seconds").notNull().default(0),
  totalServiceCount: integer("total_service_count").notNull().default(0),

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

  // Importance / urgence de l'article — 1 (vert, normal), 2 (orange,
  // à traiter bientôt), 3 (rouge, urgent pour la prochaine édition).
  priority: integer("priority").notNull().default(1),

  mainJournalistId: text("main_journalist_id"),
  secondJournalistId: text("second_journalist_id"),

  // 'proposition' | 'disponible' | 'en_cours' | 'en_validation' | 'a_corriger' | 'valide'
  status: text("status").notNull().default("disponible"),
  content: text("content").notNull().default(""),

  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  // Renseigné au moment de la validation par un administrateur.
  validatedAt: text("validated_at"),

  // Demande d'annulation en attente (une seule à la fois, comme dans le
  // prototype). null si aucune demande en cours.
  cancelRequestJournalistId: text("cancel_request_journalist_id"),
  cancelRequestReason: text("cancel_request_reason"),
  cancelRequestDate: text("cancel_request_date"),

  // Demande d'un journaliste (sans article actif) pour rejoindre cet
  // article en tant que journaliste secondaire. Le journaliste principal
  // accepte ou refuse. Une seule demande à la fois.
  secondRequestJournalistId: text("second_request_journalist_id"),

  // Archivage (admin uniquement) d'un article déjà validé — reste
  // consultable dans un onglet dédié, toujours supprimable.
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  archivedAt: text("archived_at"),
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

// "J'aime" sur un article validé (fil de publications, avant archivage).
export const articleLikes = sqliteTable("article_likes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleId: text("article_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: text("created_at").notNull(),
});

// Journal des services terminés (une ligne par service, horodatée) —
// permet de calculer des statistiques par mois (et archivées) sans avoir
// à réinitialiser destructivement des compteurs : "ce mois-ci" et les
// mois précédents se déduisent simplement d'un filtre sur endedAt.
export const serviceLogs = sqliteTable("service_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  serverId: text("server_id").notNull().default(""),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at").notNull(),
  durationSeconds: integer("duration_seconds").notNull().default(0),
});

// Commentaires de lecture sur un article validé — distincts des
// commentaires de validation (articleComments) qui restent internes à
// l'espace de rédaction. parentCommentId permet une réponse (un seul
// niveau d'imbrication : une réponse à une réponse est rattachée au
// commentaire racine).
export const articleReaderComments = sqliteTable("article_reader_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleId: text("article_id").notNull(),
  userId: text("user_id").notNull(),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
  parentCommentId: integer("parent_comment_id"),
});

// "J'aime" sur un commentaire de lecture.
export const commentLikes = sqliteTable("comment_likes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  commentId: integer("comment_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: text("created_at").notNull(),
});
