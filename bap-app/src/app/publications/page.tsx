import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { Shell } from "@/components/Shell";
import { isAdmin, type Role } from "@/lib/permissions";
import { fmtDate } from "@/lib/dates";
import { toggleArticleLike, addReaderComment, deleteReaderComment } from "@/actions/articles";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

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
  const [likes, comments, allUsers] = await Promise.all([
    articleIds.length
      ? db.select().from(schema.articleLikes).where(inArray(schema.articleLikes.articleId, articleIds))
      : Promise.resolve([]),
    articleIds.length
      ? db.select().from(schema.articleReaderComments).where(inArray(schema.articleReaderComments.articleId, articleIds))
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

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                <form action={toggleArticleLike}>
                  <input type="hidden" name="articleId" value={a.id} />
                  <button type="submit" className={`btn btn-sm ${viewerLiked ? "btn-primary" : "btn-ghost"}`}>
                    {viewerLiked ? "♥ J'aime" : "♡ J'aime"} ({articleLikes.length})
                  </button>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
                {articleComments.length ? (
                  articleComments.map((c) => {
                    const info = userInfo(c.userId);
                    return (
                      <div key={c.id} style={{ display: "flex", gap: 10 }}>
                        {info.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={info.avatar}
                            alt=""
                            style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }}
                          />
                        ) : (
                          <div
                            style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--panel-3)", flexShrink: 0 }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div className="comment-head">
                            <b>{info.name}</b>
                            <span>{fmtDate(c.createdAt)}</span>
                          </div>
                          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{c.text}</div>
                          {viewerIsAdmin ? (
                            <form style={{ marginTop: 4 }}>
                              <input type="hidden" name="id" value={c.id} />
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
                      </div>
                    );
                  })
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
