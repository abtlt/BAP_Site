import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { Shell } from "@/components/Shell";
import { isAdmin, isBlockedByAdmin, statusLabels } from "@/lib/permissions";
import { fmtDate } from "@/lib/dates";
import { formatFileSize } from "@/lib/uploads";
import { saveDraft, submitForValidation, uploadArticleFile, requestCancel } from "@/actions/articles";

export default async function RedactionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const db = getDb();
  const [article] = await db.select().from(schema.articles).where(eq(schema.articles.id, id)).limit(1);
  if (!article) notFound();

  const [files, comments, journalists] = await Promise.all([
    db.select().from(schema.articleFiles).where(eq(schema.articleFiles.articleId, id)),
    db.select().from(schema.articleComments).where(eq(schema.articleComments.articleId, id)),
    db.select().from(schema.users),
  ]);

  const journalistName = (jid: string | null) => {
    if (!jid) return "—";
    const j = journalists.find((x) => x.robloxId === jid);
    return j ? `${j.rpFirstName} ${j.rpLastName}`.trim() || j.robloxUsername : "—";
  };

  const isAdminViewer = isAdmin(user.role as "journaliste" | "admin" | "redac_chef");
  const isParticipant = article.mainJournalistId === user.robloxId || article.secondJournalistId === user.robloxId;
  const hasPendingCancel = !!article.cancelRequestJournalistId;
  const isBlocked = isBlockedByAdmin(user);
  const canEdit = isParticipant && ["en_cours", "a_corriger"].includes(article.status) && !hasPendingCancel && !isBlocked;
  const st = statusLabels[article.status];

  const backHref = isAdminViewer && !isParticipant ? "/admin?tab=overview" : "/articles";

  return (
    <Shell user={user} activePage="articles">
      <div className="page-header">
        <div>
          <div className="eyebrow ui-label">
            <a href={backHref}>← Retour</a>
          </div>
          <h1>{article.title}</h1>
          <div className="desc">
            {article.mainSubject}
            {article.secondSubject ? ` · ${article.secondSubject}` : ""}
          </div>
        </div>
        <span className={`tag ${st.cls}`}>{st.label}</span>
      </div>

      {hasPendingCancel ? (
        <div className="card" style={{ borderColor: "var(--orange)", background: "var(--orange-bg)", marginBottom: 16 }}>
          <p style={{ margin: 0 }}>
            Une demande d&apos;annulation est en attente de traitement par un administrateur. La rédaction est bloquée en
            attendant sa décision.
          </p>
        </div>
      ) : null}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">Informations du projet (préremplies par l&apos;administration)</div>
          <div className="grid grid-2">
            <div className="field">
              <label>Journaliste principal</label>
              <input type="text" defaultValue={journalistName(article.mainJournalistId)} disabled />
            </div>
            <div className="field">
              <label>Journaliste secondaire</label>
              <input type="text" defaultValue={article.secondJournalistId ? journalistName(article.secondJournalistId) : "Aucun"} disabled />
            </div>
            <div className="field">
              <label>Grade</label>
              <input type="text" defaultValue={article.grade} disabled />
            </div>
            <div className="field">
              <label>Destiné à la publication</label>
              <input type="text" defaultValue={article.forPublication ? "Oui" : "Non"} disabled />
            </div>
            <div className="field">
              <label>Sujet principal</label>
              <input type="text" defaultValue={article.mainSubject} disabled />
            </div>
            <div className="field">
              <label>Sujet secondaire</label>
              <input type="text" defaultValue={article.secondSubject || "—"} disabled />
            </div>
          </div>
          <div className="field">
            <label>Informations complémentaires</label>
            <input type="text" defaultValue={article.extraInfo || "—"} disabled />
          </div>
        </div>

        <div className="card">
          <div className="card-title">Fichiers joints</div>
          <div>
            {files.length ? (
              files.map((f) => (
                <a key={f.id} className="file-chip" href={f.url} target="_blank" rel="noreferrer">
                  📎 {f.filename} · {formatFileSize(f.size)}
                </a>
              ))
            ) : (
              <p style={{ color: "var(--text-faint)", fontSize: "12.5px" }}>Aucun fichier pour le moment.</p>
            )}
          </div>
          {canEdit ? (
            <form action={uploadArticleFile} style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input type="hidden" name="articleId" value={article.id} />
              <input
                type="file"
                name="file"
                required
                style={{ flex: 1, minWidth: 180, fontSize: 12, color: "var(--text-dim)" }}
              />
              <button type="submit" className="btn btn-ghost btn-sm">
                ＋ Ajouter le fichier
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {comments.length ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">Commentaires de la rédaction</div>
          {comments.map((c) => (
            <div key={c.id} className="comment">
              <div className="comment-head">
                <b>{c.authorName}</b>
                <span>{fmtDate(c.createdAt)}</span>
              </div>
              <div>{c.text}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Rédaction de l&apos;article</div>
        <form action={submitForValidation}>
          <input type="hidden" name="articleId" value={article.id} />
          <textarea
            className="editor-area"
            name="content"
            disabled={!canEdit}
            defaultValue={article.content}
            placeholder="Rédigez le contenu de l'article ici..."
          />
          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {canEdit ? (
              <>
                <button type="submit" formAction={saveDraft} className="btn btn-ghost">
                  Enregistrer le brouillon
                </button>
                <button type="submit" className="btn btn-primary">
                  Envoyer aux administrateurs pour validation
                </button>
              </>
            ) : (
              <p style={{ color: "var(--text-faint)", fontSize: "12.5px" }}>
                {isBlocked
                  ? "Votre compte est gelé par un administrateur : rédaction indisponible."
                  : hasPendingCancel
                    ? "Demande d'annulation en attente."
                    : article.status === "en_validation"
                      ? "Article envoyé, en attente de validation par la rédaction."
                      : article.status === "valide"
                        ? "Article validé."
                        : "Vous ne pouvez pas modifier cet article."}
              </p>
            )}
          </div>
        </form>

        {isParticipant && ["en_cours", "en_validation", "a_corriger"].includes(article.status) && !hasPendingCancel ? (
          <>
            <div className="divider" />
            <form action={requestCancel} className="cancel-form">
              <input type="hidden" name="articleId" value={article.id} />
              <input type="text" name="reason" placeholder="Raison de l'annulation (erreur, désistement...)" />
              <button type="submit" className="btn btn-danger btn-sm">
                Demander une annulation de prise en charge
              </button>
            </form>
          </>
        ) : null}
      </div>
    </Shell>
  );
}
