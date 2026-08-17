import { and, eq, ne, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { Shell } from "@/components/Shell";
import { ACTIVE_STATUSES, isAdmin, isBlockedByAdmin, statusLabels } from "@/lib/permissions";
import { takeArticle, requestCancel, deleteArticle } from "@/actions/articles";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export default async function ArticlesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [mine, available, journalists] = await Promise.all([
    db
      .select()
      .from(schema.articles)
      .where(
        and(
          ne(schema.articles.status, "disponible"),
          or(eq(schema.articles.mainJournalistId, user.robloxId), eq(schema.articles.secondJournalistId, user.robloxId))
        )
      ),
    db.select().from(schema.articles).where(eq(schema.articles.status, "disponible")),
    db.select().from(schema.users),
  ]);

  const journalistName = (id: string | null) => {
    if (!id) return null;
    const j = journalists.find((x) => x.robloxId === id);
    return j ? `${j.rpFirstName} ${j.rpLastName}`.trim() || j.robloxUsername : "—";
  };

  const activeIds = new Set(ACTIVE_STATUSES as readonly string[]);
  const myActiveArticle = mine.find(
    (a) => activeIds.has(a.status) && (a.mainJournalistId === user.robloxId || a.secondJournalistId === user.robloxId)
  );
  const isBlocked = isBlockedByAdmin(user);
  const blockedFromTaking = !!myActiveArticle || isBlocked;
  const viewerIsAdmin = isAdmin(user.role as "journaliste" | "admin" | "redac_chef");

  return (
    <Shell user={user} activePage="articles">
      <div className="page-header">
        <div>
          <div className="eyebrow ui-label">Articles</div>
          <h1>Articles disponibles</h1>
          <div className="desc">Choisissez un projet d&apos;article à rédiger, ou reprenez un article en cours.</div>
        </div>
      </div>

      {myActiveArticle ? (
        <div className="card" style={{ borderColor: "var(--orange)", background: "var(--orange-bg)", marginBottom: 20 }}>
          <p style={{ margin: 0 }}>
            Vous avez déjà un article actif (<b>{myActiveArticle.title}</b>). Terminez-le avant d&apos;en prendre un nouveau, ou
            demandez son annulation à un administrateur si vous souhaitez vous désister.
          </p>
        </div>
      ) : null}

      {mine.length ? (
        <>
          <div className="card-title" style={{ marginBottom: 10 }}>
            Mes articles en cours
          </div>
          <div className="grid grid-auto" style={{ marginBottom: 26 }}>
            {mine.map((a) => {
              const st = statusLabels[a.status];
              const canRequestCancel = activeIds.has(a.status);
              const hasPendingCancel = !!a.cancelRequestJournalistId;
              return (
                <div key={a.id} className="card article-card">
                  <div className="art-tags">
                    <span className={`tag ${st.cls}`}>{st.label}</span>
                    {a.forPublication ? <span className="tag tag-gold">Pour publication</span> : <span className="tag tag-gray">Interne</span>}
                    {hasPendingCancel ? <span className="tag tag-orange">Annulation demandée</span> : null}
                  </div>
                  <div className="art-title">{a.title}</div>
                  <div className="art-meta">
                    {a.mainSubject}
                    {a.secondSubject ? ` · ${a.secondSubject}` : ""}
                  </div>
                  <div className="art-meta">
                    Journaliste principal : {journalistName(a.mainJournalistId) || "—"}
                    {a.secondJournalistId ? ` · Secondaire : ${journalistName(a.secondJournalistId)}` : ""}
                  </div>
                  <div className="art-actions">
                    <a className="btn btn-primary btn-sm" href={`/redaction/${a.id}`}>
                      Ouvrir l&apos;espace de rédaction
                    </a>
                    {viewerIsAdmin ? (
                      <form action={deleteArticle}>
                        <input type="hidden" name="articleId" value={a.id} />
                        <ConfirmSubmitButton
                          className="btn btn-danger btn-sm"
                          message={`Supprimer définitivement l'article « ${a.title} » ? Cette action est irréversible.`}
                        >
                          Supprimer
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                    {hasPendingCancel ? (
                      <span style={{ fontSize: "11.5px", color: "var(--text-faint)", alignSelf: "center" }}>
                        Annulation en attente de réponse d&apos;un administrateur
                      </span>
                    ) : null}
                  </div>
                  {canRequestCancel && !hasPendingCancel ? (
                    <form action={requestCancel} className="cancel-form">
                      <input type="hidden" name="articleId" value={a.id} />
                      <input type="text" name="reason" placeholder="Raison de l'annulation (erreur, désistement...)" />
                      <button type="submit" className="btn btn-danger btn-sm">
                        Demander une annulation
                      </button>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      <div className="card-title" style={{ marginBottom: 10 }}>
        Projets disponibles
      </div>
      {available.length ? (
        <div className="grid grid-auto">
          {available.map((a) => (
            <div key={a.id} className="card article-card">
              <div className="art-tags">
                <span className="tag tag-gold">Disponible</span>
                {a.forPublication ? <span className="tag tag-green">Pour publication</span> : <span className="tag tag-gray">Interne</span>}
              </div>
              <div className="art-title">{a.title}</div>
              <div className="art-meta">
                {a.mainSubject}
                {a.secondSubject ? ` · ${a.secondSubject}` : ""}
              </div>
              <div className="art-meta">Grade requis : {a.grade}</div>
              {a.extraInfo ? <div className="art-meta">{a.extraInfo}</div> : null}
              <div className="art-actions">
                <form action={takeArticle}>
                  <input type="hidden" name="articleId" value={a.id} />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={blockedFromTaking}>
                    Prendre cet article
                  </button>
                </form>
                {viewerIsAdmin ? (
                  <form action={deleteArticle}>
                    <input type="hidden" name="articleId" value={a.id} />
                    <ConfirmSubmitButton
                      className="btn btn-danger btn-sm"
                      message={`Supprimer définitivement le projet « ${a.title} » ? Cette action est irréversible.`}
                    >
                      Supprimer
                    </ConfirmSubmitButton>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card empty-state">Aucun article disponible pour le moment. Revenez plus tard.</div>
      )}
    </Shell>
  );
}
