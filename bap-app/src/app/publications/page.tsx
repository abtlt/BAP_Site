import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { Shell } from "@/components/Shell";
import { isAdmin, type Role } from "@/lib/permissions";
import { fmtDate } from "@/lib/dates";
import { formatFileSize, isImageFile } from "@/lib/uploads";
import { toggleArticleLike, addReaderComment, deleteReaderComment, toggleCommentLike } from "@/actions/articles";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

type ReaderComment = typeof schema.articleReaderComments.$inferSelect;
type CommentLike = typeof schema.commentLikes.$inferSelect;

// Une ligne de commentaire (racine ou réponse) — le formulaire de
// réponse est un simple <details>/<summary> natif, sans JS, pour ne pas
// avoir à transformer la page en composant client.
function CommentRow({
  comment,
  replies,
  allLikes,
  userInfo,
  viewerId,
  viewerIsAdmin,
  isReply = false,
}: {
  comment: ReaderComment;
  replies: ReaderComment[];
  allLikes: CommentLike[];
  userInfo: (id: string) => { name: string; avatar: string };
  viewerId: string;
  viewerIsAdmin: boolean;
  isReply?: boolean;
}) {
  const info = userInfo(comment.userId);
  const commentLikes = allLikes.filter((l) => l.commentId === comment.id);
  const viewerLiked = commentLikes.some((l) => l.userId === viewerId);
  const separator = String.fromCharCode(160, 160, 45, 160, 160); // "  -  " (espaces insécables)

  return (
    <div style={{ display: "flex", gap: 10, marginLeft: isReply ? 42 : 0 }}>
      {info.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={info.avatar} alt="" style={{ width: isReply ? 28 : 32, height: isReply ? 28 : 32, borderRadius: "50%", flexShrink: 0 }} />
      ) : (
        <div style={{ width: isReply ? 28 : 32, height: isReply ? 28 : 32, borderRadius: "50%", background: "var(--panel-3)", flexShrink: 0 }} />
      )}
      <div style={{ flex: 1 }}>
        <div className="comment-head" style={{ justifyContent: "flex-start", gap: 0 }}>
          <b>{info.name}</b>
          <span>{separator}</span>
          <span>{fmtDate(comment.createdAt)}</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{comment.text}</div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
          <form action={toggleCommentLike} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input type="hidden" name="commentId" value={comment.id} />
            <button
              type="submit"
              className="like-btn"
              style={{ fontSize: 15 }}
              aria-label={viewerLiked ? "Retirer le j'aime" : "J'aime"}
              title={viewerLiked ? "Retirer le j'aime" : "J'aime"}
            >
              {viewerLiked ? "❤" : "♡"}
            </button>
            {commentLikes.length ? <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{commentLikes.length}</span> : null}
          </form>

          {!isReply ? (
            <details>
              <summary style={{ cursor: "pointer", fontSize: 11.5, color: "var(--text-faint)" }}>Répondre</summary>
              <form action={addReaderComment} style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input type="hidden" name="articleId" value={comment.articleId} />
                <input type="hidden" name="parentCommentId" value={comment.id} />
                <input type="text" name="text" placeholder="Répondre..." style={{ flex: 1, fontSize: 12 }} required />
                <button type="submit" className="btn btn-primary btn-sm">
                  Envoyer
                </button>
              </form>
            </details>
          ) : null}

          {viewerIsAdmin ? (
            <form>
              <input type="hidden" name="id" value={comment.id} />
              <ConfirmSubmitButton
                formAction={deleteReaderComment}
                className="btn btn-ghost btn-sm"
                style={{ padding: "2px 8px", fontSize: 11 }}
                message="Supprimer ce commentaire ?"
              >
                Supprimer
              </ConfirmSubmitButton>
            </form>
          ) : null}
        </div>

        {!isReply && replies.length ? (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {replies.map((r) => (
              <CommentRow
                key={r.id}
                comment={r}
                replies={[]}
                allLikes={allLikes}
                userInfo={userInfo}
                viewerId={viewerId}
                viewerIsAdmin={viewerIsAdmin}
                isReply
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Fil des articles validés (avant archivage) : les journalistes et les
// "droit de regard" peuvent liker et commenter le travail de la
// rédaction. Les avatars/prénom-nom des personnes ayant liké ou
// commenté sont affichés.
export default async function PublicationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = getDb();
  const articles = await db
    .select()
    .from(schema.articles)
    .where(and(eq(schema.articles.status, "valide"), eq(schema.articles.archived, false)));

  const articleIds = articles.map((a) => a.id);
  const [likes, comments, commentLikes, files, allUsers] = await Promise.all([
    articleIds.length
      ? db.select().from(schema.articleLikes).where(inArray(schema.articleLikes.articleId, articleIds))
      : Promise.resolve([]),
    articleIds.length
      ? db.select().from(schema.articleReaderComments).where(inArray(schema.articleReaderComments.articleId, articleIds))
      : Promise.resolve([]),
    db.select().from(schema.commentLikes),
    articleIds.length
      ? db.select().from(schema.articleFiles).where(inArray(schema.articleFiles.articleId, articleIds))
      : Promise.resolve([]),
    db.select().from(schema.users),
  ]);

  const userInfo = (id: string) => {
    const u = allUsers.find((x) => x.robloxId === id);
    return {
      name: u ? `${u.rpFirstName} ${u.rpLastName}`.trim() || u.robloxUsername : "Utilisateur inconnu",
      avatar: u?.robloxAvatarUrl || "",
    };
  };

  const journalistName = (id: string | null) => (id ? userInfo(id).name : "—");
  const viewerIsAdmin = isAdmin(user.role as Role);

  const sorted = [...articles].sort((a, b) =>
    (b.validatedAt || b.createdAt).localeCompare(a.validatedAt || a.createdAt)
  );

  return (
    <Shell user={user} activePage="publications">
      <div className="page-header">
        <div>
          <div className="eyebrow ui-label">Publications</div>
          <h1>Articles publiés</h1>
          <div className="desc">Articles validés, avant archivage — likez et commentez le travail de la rédaction.</div>
        </div>
      </div>

      {sorted.length ? (
        sorted.map((a) => {
          const articleLikes = likes.filter((l) => l.articleId === a.id);
          const articleComments = comments
            .filter((c) => c.articleId === a.id)
            .sort((x, y) => x.createdAt.localeCompare(y.createdAt));
          const topLevelComments = articleComments.filter((c) => !c.parentCommentId);
          const articleAttachments = files.filter((f) => f.articleId === a.id);
          const images = articleAttachments.filter((f) => isImageFile(f.filename));
          const otherFiles = articleAttachments.filter((f) => !isImageFile(f.filename));
          const viewerLiked = articleLikes.some((l) => l.userId === user.robloxId);

          return (
            <div key={a.id} className="card" style={{ marginBottom: 20 }}>
              <div className="art-title">{a.title}</div>
              <div className="art-meta" style={{ marginBottom: 10 }}>
                {journalistName(a.mainJournalistId)}
                {a.secondJournalistId ? ` · ${journalistName(a.secondJournalistId)}` : ""} — validé le{" "}
                {fmtDate(a.validatedAt || a.createdAt)}
              </div>
              <p
                style={{
                  fontSize: 13.5,
                  color: "var(--text-dim)",
                  whiteSpace: "pre-wrap",
                  background: "var(--panel)",
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  marginBottom: 14,
                }}
              >
                {a.content || "(article sans contenu)"}
              </p>

              {images.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {images.map((f) => (
                    <a key={f.id} href={f.url} target="_blank" rel="noreferrer" title={f.filename}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={f.url}
                        alt={f.filename}
                        style={{
                          width: 140,
                          height: 140,
                          objectFit: "cover",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                        }}
                      />
                    </a>
                  ))}
                </div>
              ) : null}

              {otherFiles.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {otherFiles.map((f) => (
                    <a key={f.id} className="file-chip" href={f.url} target="_blank" rel="noreferrer">
                      📎 {f.filename} · {formatFileSize(f.size)}
                    </a>
                  ))}
                </div>
              ) : null}

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                <form action={toggleArticleLike} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="hidden" name="articleId" value={a.id} />
                  <button
                    type="submit"
                    className="like-btn"
                    aria-label={viewerLiked ? "Retirer le j'aime" : "J'aime"}
                    title={viewerLiked ? "Retirer le j'aime" : "J'aime"}
                  >
                    {viewerLiked ? "❤" : "♡"}
                  </button>
                  {articleLikes.length ? (
                    <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{articleLikes.length}</span>
                  ) : null}
                </form>
                {articleLikes.length ? (
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {articleLikes.slice(0, 10).map((l, i) => {
                      const info = userInfo(l.userId);
                      const style: React.CSSProperties = {
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        border: "2px solid var(--panel)",
                        marginLeft: i === 0 ? 0 : -8,
                        background: "var(--panel-3)",
                      };
                      return info.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={l.id} src={info.avatar} alt={info.name} title={info.name} style={style} />
                      ) : (
                        <div key={l.id} title={info.name} style={style} />
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="divider" />

              <div className="ui-label" style={{ marginBottom: 8 }}>
                Commentaires ({articleComments.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 14 }}>
                {topLevelComments.length ? (
                  topLevelComments.map((c) => (
                    <CommentRow
                      key={c.id}
                      comment={c}
                      replies={articleComments
                        .filter((r) => r.parentCommentId === c.id)
                        .sort((x, y) => x.createdAt.localeCompare(y.createdAt))}
                      allLikes={commentLikes}
                      userInfo={userInfo}
                      viewerId={user.robloxId}
                      viewerIsAdmin={viewerIsAdmin}
                    />
                  ))
                ) : (
                  <p style={{ fontSize: "12.5px", color: "var(--text-faint)" }}>Aucun commentaire pour le moment.</p>
                )}
              </div>

              <form action={addReaderComment} style={{ display: "flex", gap: 8 }}>
                <input type="hidden" name="articleId" value={a.id} />
                <input type="text" name="text" placeholder="Ajouter un commentaire..." style={{ flex: 1 }} required />
                <button type="submit" className="btn btn-primary btn-sm">
                  Envoyer
                </button>
              </form>
            </div>
          );
        })
      ) : (
        <div className="card empty-state">Aucun article publié pour le moment.</div>
      )}
    </Shell>
  );
}
