"use server";

import { eq, and, or, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { isAdmin, isBlockedByAdmin, ACTIVE_STATUSES } from "@/lib/permissions";
import { addDays, DEADLINE_CYCLE_DAYS } from "@/lib/dates";
import { saveUploadedFile, deleteArticleUploads } from "@/lib/uploads";

async function requireViewer() {
  const viewer = await getCurrentUser();
  if (!viewer) throw new Error("Non authentifié.");
  return viewer;
}

function viewerName(viewer: { rpFirstName: string; rpLastName: string; robloxUsername: string }) {
  const name = `${viewer.rpFirstName} ${viewer.rpLastName}`.trim();
  return name || viewer.robloxUsername;
}

async function findActiveArticleFor(journalistId: string) {
  const db = getDb();
  const [article] = await db
    .select()
    .from(schema.articles)
    .where(
      and(
        inArray(schema.articles.status, [...ACTIVE_STATUSES]),
        or(eq(schema.articles.mainJournalistId, journalistId), eq(schema.articles.secondJournalistId, journalistId))
      )
    )
    .limit(1);
  return article ?? null;
}

// Création d'un projet d'article — réservé aux administrateurs.
export async function createArticle(formData: FormData) {
  const viewer = await requireViewer();
  if (!isAdmin(viewer.role as "journaliste" | "admin" | "redac_chef")) throw new Error("Réservé aux administrateurs.");

  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Le titre est requis.");

  const mainJournalistId = String(formData.get("mainJournalistId") || "") || null;
  const secondJournalistId = String(formData.get("secondJournalistId") || "") || null;
  const hasPreassigned = !!mainJournalistId;

  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(schema.articles).values({
    id: randomUUID(),
    title,
    mainSubject: String(formData.get("mainSubject") || "").trim(),
    secondSubject: String(formData.get("secondSubject") || "").trim(),
    extraInfo: String(formData.get("extraInfo") || "").trim(),
    forPublication: String(formData.get("forPublication")) === "oui",
    grade: String(formData.get("grade") || "Journaliste"),
    mainJournalistId,
    secondJournalistId,
    status: hasPreassigned ? "en_cours" : "disponible",
    content: "",
    createdBy: viewer.robloxId,
    createdAt: now,
  });

  revalidatePath("/admin");
  revalidatePath("/articles");
}

// Un journaliste prend en charge un article disponible. Un seul article
// actif à la fois (il doit terminer ou faire annuler celui en cours).
export async function takeArticle(formData: FormData) {
  const viewer = await requireViewer();
  if (isBlockedByAdmin(viewer)) throw new Error("Votre compte est gelé par un administrateur : vous ne pouvez pas prendre d'article.");

  const articleId = String(formData.get("articleId"));

  const active = await findActiveArticleFor(viewer.robloxId);
  if (active) {
    throw new Error(
      "Vous avez déjà un article en cours. Terminez-le (ou demandez son annulation à un administrateur) avant d'en prendre un nouveau."
    );
  }

  const db = getDb();
  const [article] = await db.select().from(schema.articles).where(eq(schema.articles.id, articleId)).limit(1);
  if (!article) throw new Error("Article introuvable.");

  if (article.mainJournalistId) {
    throw new Error(
      "Cet article a déjà un journaliste principal. Vous pouvez demander à le rejoindre comme journaliste secondaire depuis la liste des articles en cours."
    );
  }

  await db
    .update(schema.articles)
    .set({ mainJournalistId: viewer.robloxId, status: "en_cours" })
    .where(eq(schema.articles.id, articleId));

  revalidatePath("/articles");
  revalidatePath(`/redaction/${articleId}`);
}

// Un journaliste sans article actif demande à rejoindre un article déjà
// en cours (avec un journaliste principal mais pas de secondaire) en
// tant que journaliste secondaire. Le journaliste principal doit ensuite
// accepter ou refuser.
export async function requestSecondSlot(formData: FormData) {
  const viewer = await requireViewer();
  if (isBlockedByAdmin(viewer)) throw new Error("Votre compte est gelé par un administrateur.");

  const articleId = String(formData.get("articleId"));

  const active = await findActiveArticleFor(viewer.robloxId);
  if (active) throw new Error("Vous avez déjà un article actif : impossible de demander à en rejoindre un autre.");

  const db = getDb();
  const [article] = await db.select().from(schema.articles).where(eq(schema.articles.id, articleId)).limit(1);
  if (!article) throw new Error("Article introuvable.");
  if (!article.mainJournalistId || article.mainJournalistId === viewer.robloxId) {
    throw new Error("Cet article n'est pas disponible pour une demande de journaliste secondaire.");
  }
  if (article.secondJournalistId) throw new Error("Cet article a déjà un journaliste secondaire.");
  if (article.secondRequestJournalistId) throw new Error("Une demande est déjà en attente sur cet article.");
  if (!(ACTIVE_STATUSES as readonly string[]).includes(article.status)) {
    throw new Error("Cet article n'accepte plus de nouvelle demande.");
  }

  await db
    .update(schema.articles)
    .set({ secondRequestJournalistId: viewer.robloxId })
    .where(eq(schema.articles.id, articleId));

  revalidatePath("/articles");
  revalidatePath(`/redaction/${articleId}`);
}

// Le journaliste principal accepte la demande : le demandeur devient
// journaliste secondaire de l'article.
export async function acceptSecondRequest(formData: FormData) {
  const viewer = await requireViewer();
  const articleId = String(formData.get("articleId"));

  const db = getDb();
  const [article] = await db.select().from(schema.articles).where(eq(schema.articles.id, articleId)).limit(1);
  if (!article || !article.secondRequestJournalistId) throw new Error("Aucune demande en attente.");
  if (article.mainJournalistId !== viewer.robloxId) throw new Error("Seul le journaliste principal peut répondre à cette demande.");

  await db
    .update(schema.articles)
    .set({ secondJournalistId: article.secondRequestJournalistId, secondRequestJournalistId: null })
    .where(eq(schema.articles.id, articleId));

  revalidatePath("/articles");
  revalidatePath(`/redaction/${articleId}`);
}

// Le journaliste principal refuse la demande.
export async function declineSecondRequest(formData: FormData) {
  const viewer = await requireViewer();
  const articleId = String(formData.get("articleId"));

  const db = getDb();
  const [article] = await db.select().from(schema.articles).where(eq(schema.articles.id, articleId)).limit(1);
  if (!article || !article.secondRequestJournalistId) throw new Error("Aucune demande en attente.");
  if (article.mainJournalistId !== viewer.robloxId) throw new Error("Seul le journaliste principal peut répondre à cette demande.");

  await db.update(schema.articles).set({ secondRequestJournalistId: null }).where(eq(schema.articles.id, articleId));

  revalidatePath("/articles");
  revalidatePath(`/redaction/${articleId}`);
}

async function assertCanEdit(articleId: string, viewerId: string) {
  const db = getDb();
  const [article] = await db.select().from(schema.articles).where(eq(schema.articles.id, articleId)).limit(1);
  if (!article) throw new Error("Article introuvable.");

  const isParticipant = article.mainJournalistId === viewerId || article.secondJournalistId === viewerId;
  if (!isParticipant) throw new Error("Vous n'êtes pas assigné à cet article.");
  if (!(["en_cours", "a_corriger"] as const).includes(article.status as "en_cours" | "a_corriger")) {
    throw new Error("Cet article n'est pas modifiable dans son état actuel.");
  }
  if (article.cancelRequestJournalistId) throw new Error("Une demande d'annulation est en attente sur cet article.");

  return article;
}

export async function saveDraft(formData: FormData) {
  const viewer = await requireViewer();
  if (isBlockedByAdmin(viewer)) throw new Error("Votre compte est gelé par un administrateur.");

  const articleId = String(formData.get("articleId"));
  const content = String(formData.get("content") || "");
  await assertCanEdit(articleId, viewer.robloxId);

  const db = getDb();
  await db.update(schema.articles).set({ content }).where(eq(schema.articles.id, articleId));
  revalidatePath(`/redaction/${articleId}`);
}

export async function submitForValidation(formData: FormData) {
  const viewer = await requireViewer();
  if (isBlockedByAdmin(viewer)) throw new Error("Votre compte est gelé par un administrateur.");

  const articleId = String(formData.get("articleId"));
  const content = String(formData.get("content") || "");
  await assertCanEdit(articleId, viewer.robloxId);

  const db = getDb();
  await db
    .update(schema.articles)
    .set({ content, status: "en_validation" })
    .where(eq(schema.articles.id, articleId));

  revalidatePath("/articles");
  revalidatePath(`/redaction/${articleId}`);
  revalidatePath("/admin");
}

export async function uploadArticleFile(formData: FormData) {
  const viewer = await requireViewer();
  if (isBlockedByAdmin(viewer)) throw new Error("Votre compte est gelé par un administrateur.");

  const articleId = String(formData.get("articleId"));
  await assertCanEdit(articleId, viewer.robloxId);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Aucun fichier sélectionné.");

  const saved = await saveUploadedFile(articleId, file);
  const db = getDb();
  await db.insert(schema.articleFiles).values({
    articleId,
    filename: saved.filename,
    url: saved.url,
    size: saved.size,
    uploadedAt: new Date().toISOString(),
  });

  revalidatePath(`/redaction/${articleId}`);
}

// Demande d'annulation de prise en charge (erreur, désistement...).
export async function requestCancel(formData: FormData) {
  const viewer = await requireViewer();
  const articleId = String(formData.get("articleId"));
  const reason = String(formData.get("reason") || "").trim() || "(aucune raison précisée)";

  const db = getDb();
  const [article] = await db.select().from(schema.articles).where(eq(schema.articles.id, articleId)).limit(1);
  if (!article) throw new Error("Article introuvable.");
  const isParticipant = article.mainJournalistId === viewer.robloxId || article.secondJournalistId === viewer.robloxId;
  if (!isParticipant) throw new Error("Vous n'êtes pas assigné à cet article.");
  if (!(ACTIVE_STATUSES as readonly string[]).includes(article.status)) throw new Error("Cet article ne peut plus être annulé.");

  await db
    .update(schema.articles)
    .set({
      cancelRequestJournalistId: viewer.robloxId,
      cancelRequestReason: reason,
      cancelRequestDate: new Date().toISOString(),
    })
    .where(eq(schema.articles.id, articleId));

  revalidatePath("/articles");
  revalidatePath(`/redaction/${articleId}`);
  revalidatePath("/admin");
}

async function requireAdmin() {
  const viewer = await requireViewer();
  if (!isAdmin(viewer.role as "journaliste" | "admin" | "redac_chef")) throw new Error("Réservé aux administrateurs.");
  return viewer;
}

export async function approveCancellation(formData: FormData) {
  const viewer = await requireAdmin();
  const articleId = String(formData.get("articleId"));

  const db = getDb();
  const [article] = await db.select().from(schema.articles).where(eq(schema.articles.id, articleId)).limit(1);
  if (!article || !article.cancelRequestJournalistId) throw new Error("Aucune demande d'annulation en attente.");

  const requesterId = article.cancelRequestJournalistId;
  const patch: Partial<typeof schema.articles.$inferInsert> = {
    cancelRequestJournalistId: null,
    cancelRequestReason: null,
    cancelRequestDate: null,
  };

  if (article.mainJournalistId === requesterId) {
    if (article.secondJournalistId) {
      patch.mainJournalistId = article.secondJournalistId;
      patch.secondJournalistId = null;
    } else {
      patch.mainJournalistId = null;
      patch.status = "disponible";
      patch.content = "";
    }
  } else if (article.secondJournalistId === requesterId) {
    patch.secondJournalistId = null;
  }

  await db.update(schema.articles).set(patch).where(eq(schema.articles.id, articleId));

  if (patch.status === "disponible") {
    // On supprime les fichiers déjà attachés puisque l'article repart de zéro.
    await db.delete(schema.articleFiles).where(eq(schema.articleFiles.articleId, articleId));
  }

  void viewer;
  revalidatePath("/articles");
  revalidatePath("/admin");
  revalidatePath(`/redaction/${articleId}`);
}

export async function declineCancellation(formData: FormData) {
  await requireAdmin();
  const articleId = String(formData.get("articleId"));

  const db = getDb();
  await db
    .update(schema.articles)
    .set({ cancelRequestJournalistId: null, cancelRequestReason: null, cancelRequestDate: null })
    .where(eq(schema.articles.id, articleId));

  revalidatePath("/articles");
  revalidatePath("/admin");
  revalidatePath(`/redaction/${articleId}`);
}

export async function validateArticle(formData: FormData) {
  const viewer = await requireAdmin();
  const articleId = String(formData.get("articleId"));
  const comment = String(formData.get("comment") || "").trim();

  const db = getDb();
  const [article] = await db.select().from(schema.articles).where(eq(schema.articles.id, articleId)).limit(1);
  if (!article) throw new Error("Article introuvable.");

  if (comment) {
    await db.insert(schema.articleComments).values({
      articleId,
      authorName: viewerName(viewer),
      text: comment,
      createdAt: new Date().toISOString(),
    });
  }

  await db.update(schema.articles).set({ status: "valide" }).where(eq(schema.articles.id, articleId));

  const participantIds = [article.mainJournalistId, article.secondJournalistId].filter(Boolean) as string[];
  const now = new Date().toISOString();
  for (const jid of participantIds) {
    const [j] = await db.select().from(schema.users).where(eq(schema.users.robloxId, jid)).limit(1);
    if (!j) continue;
    await db
      .update(schema.users)
      .set({
        articlesCount: j.articlesCount + 1,
        freezeDays: j.freezeDays + 5,
        deadlineDate: addDays(now, DEADLINE_CYCLE_DAYS).toISOString(),
        lastActivity: now,
      })
      .where(eq(schema.users.robloxId, jid));
  }

  revalidatePath("/admin");
  revalidatePath("/articles");
  revalidatePath(`/redaction/${articleId}`);
}

export async function rejectArticle(formData: FormData) {
  const viewer = await requireAdmin();
  const articleId = String(formData.get("articleId"));
  const comment = String(formData.get("comment") || "").trim();
  if (!comment) throw new Error("Merci d'ajouter un commentaire expliquant les modifications à apporter.");

  const db = getDb();
  await db.insert(schema.articleComments).values({
    articleId,
    authorName: viewerName(viewer),
    text: comment,
    createdAt: new Date().toISOString(),
  });

  await db.update(schema.articles).set({ status: "a_corriger" }).where(eq(schema.articles.id, articleId));

  revalidatePath("/admin");
  revalidatePath("/articles");
  revalidatePath(`/redaction/${articleId}`);
}

// Suppression définitive d'un article — réservé aux administrateurs,
// quel que soit son statut (projet disponible non pertinent, brouillon
// créé par erreur, article validé à archiver...). Contrairement à la
// demande d'annulation, ceci ne notifie personne et supprime tout de
// suite le projet, ses commentaires et ses fichiers joints.
export async function deleteArticle(formData: FormData) {
  await requireAdmin();
  const articleId = String(formData.get("articleId"));

  const db = getDb();
  const [article] = await db.select().from(schema.articles).where(eq(schema.articles.id, articleId)).limit(1);
  if (!article) throw new Error("Article introuvable.");

  await db.delete(schema.articleComments).where(eq(schema.articleComments.articleId, articleId));
  await db.delete(schema.articleFiles).where(eq(schema.articleFiles.articleId, articleId));
  await db.delete(schema.articles).where(eq(schema.articles.id, articleId));
  await deleteArticleUploads(articleId);

  revalidatePath("/admin");
  revalidatePath("/articles");
  revalidatePath(`/redaction/${articleId}`);
}

// Retire de force un journaliste (principal ou secondaire) d'un article
// en cours — réservé aux administrateurs, sans passer par une demande
// du journaliste concerné. Si le journaliste principal est retiré, le
// secondaire (s'il y en a un) devient principal ; sinon l'article
// redevient disponible (comme pour une annulation approuvée).
export async function forceRemoveJournalist(formData: FormData) {
  await requireAdmin();
  const articleId = String(formData.get("articleId"));
  const journalistId = String(formData.get("journalistId"));

  const db = getDb();
  const [article] = await db.select().from(schema.articles).where(eq(schema.articles.id, articleId)).limit(1);
  if (!article) throw new Error("Article introuvable.");

  const patch: Partial<typeof schema.articles.$inferInsert> = {
    cancelRequestJournalistId: null,
    cancelRequestReason: null,
    cancelRequestDate: null,
    secondRequestJournalistId: null,
  };

  if (article.mainJournalistId === journalistId) {
    if (article.secondJournalistId) {
      patch.mainJournalistId = article.secondJournalistId;
      patch.secondJournalistId = null;
    } else {
      patch.mainJournalistId = null;
      patch.status = "disponible";
      patch.content = "";
    }
  } else if (article.secondJournalistId === journalistId) {
    patch.secondJournalistId = null;
  } else {
    throw new Error("Ce journaliste n'est pas assigné à cet article.");
  }

  await db.update(schema.articles).set(patch).where(eq(schema.articles.id, articleId));

  if (patch.status === "disponible") {
    await db.delete(schema.articleFiles).where(eq(schema.articleFiles.articleId, articleId));
  }

  revalidatePath("/articles");
  revalidatePath("/admin");
  revalidatePath(`/redaction/${articleId}`);
}

// Archive un article déjà validé — réservé aux administrateurs. L'article
// reste consultable dans l'onglet Archives et peut toujours être
// supprimé définitivement.
export async function archiveArticle(formData: FormData) {
  await requireAdmin();
  const articleId = String(formData.get("articleId"));

  const db = getDb();
  const [article] = await db.select().from(schema.articles).where(eq(schema.articles.id, articleId)).limit(1);
  if (!article) throw new Error("Article introuvable.");
  if (article.status !== "valide") throw new Error("Seul un article validé peut être archivé.");

  await db
    .update(schema.articles)
    .set({ archived: true, archivedAt: new Date().toISOString() })
    .where(eq(schema.articles.id, articleId));

  revalidatePath("/admin");
}
