import { and, eq, inArray, ne, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { Shell } from "@/components/Shell";
import { ACTIVE_STATUSES, isAdmin, isBlockedByAdmin, priorityTag, statusLabels, type Role } from "@/lib/permissions";
import { takeArticle, requestCancel, deleteArticle, requestSecondSlot, proposeArticle } from "@/actions/articles";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export default async function ArticlesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = getDb();
  const [mine, available, activeElsewhereRaw, myProposals, journalists] = await Promise.all([
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
    // Tous les articles en cours de traitement par d'autres journalistes,
    // qu'ils cherchent ou non un journaliste secondaire — juste pour
    // visibilité (le brouillon lui-même reste inaccessible ici) afin
    // d'éviter qu'un sujet déjà en cours soit reproposé.
    db.select().from(schema.articles).where(inArray(schema.articles.status, [...ACTIVE_STATUSES])),
    db
      .select()
      .from(schema.articles)
      .where(and(eq(schema.articles.status, "proposition"), eq(schema.articles.createdBy, user.robloxId))),
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
  const viewerIsAdmin = isAdmin(user.role as Role);

  // Articles en cours de traitement par d'autres journalistes (le
  // viewer n'y participe pas) — la demande de rejoindre en secondaire
  // n'est proposée que si le poste est ouvert.
  const otherActive = activeElsewhereRaw.filter(
    (a) => a.mainJournalistId !== user.robloxId && a.secondJournalistId !== user.robloxId
  );

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
              const isMainHere = a.mainJournalistId === user.robloxId;
              return (
                <div key={a.id} className="card article-card">
                  <div className="art-tags">
                    <span className={`tag ${st.cls}`}>{st.label}</span>
                    {a.forPublication ? <span className="tag tag-gold">Pour publication</span> : <span className="tag tag-gray">Interne</span>}
                    {hasPendingCancel ? <span className="tag tag-orange">Annulation demandée</span> : null}
                    {isMainHere && a.secondRequestJournalistId ? <span className="tag tag-blue">Demande de journaliste secondaire</span> : null}
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

      {otherActive.length ? (
        <>
          <div className="card-title" style={{ marginBottom: 10 }}>
            Articles en cours de traitement
          </div>
          <div className="grid grid-auto" style={{ marginBottom: 26 }}>
            {otherActive.map((a) => {
              const st = statusLabels[a.status];
              const slotOpen = !!a.mainJournalistId && !a.secondJournalistId;
              const hasPendingRequest = !!a.secondRequestJournalistId;
              const isMyOwnRequest = a.secondRequestJournalistId === user.robloxId;
              return (
                <div key={a.id} className="card article-card">
                  <div className="art-tags">
                    <span className={`tag ${st.cls}`}>{st.label}</span>
                    {a.forPublication ? <span className="tag tag-gold">Pour publication</span> : <span className="tag tag-gray">Interne</span>}
                    {slotOpen ? <span className="tag tag-blue">Cherche un secondaire</span> : null}
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
                  <p style={{ fontSize: "11.5px", color: "var(--text-faint)", marginTop: 4 }}>
                    Brouillon non consultable — visible uniquement pour éviter les doublons.
                  </p>
                  {slotOpen && !myActiveArticle ? (
                    <div className="art-actions">
                      {isMyOwnRequest ? (
                        <span style={{ fontSize: "11.5px", color: "var(--text-faint)", alignSelf: "center" }}>
                          Demande envoyée, en attente de réponse du journaliste principal
                        </span>
                      ) : hasPendingRequest ? (
                        <span style={{ fontSize: "11.5px", color: "var(--text-faint)", alignSelf: "center" }}>
                          Une demande d&apos;un autre journaliste est déjà en attente
                        </span>
                      ) : (
                        <form action={requestSecondSlot}>
                          <input type="hidden" name="articleId" value={a.id} />
                          <button type="submit" className="btn btn-primary btn-sm">
                            Demander à devenir journaliste secondaire
                          </button>
                        </form>
                      )}
                    </div>
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
        <div className="grid grid-auto" style={{ marginBottom: 26 }}>
          {available.map((a) => {
            const pTag = priorityTag(a.priority);
            return (
              <div key={a.id} className="card article-card">
                <div className="art-tags">
                  <span className="tag tag-gold">Disponible</span>
                  <span className={`tag ${pTag.cls}`}>{pTag.label}</span>
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
            );
          })}
        </div>
      ) : (
        <div className="card empty-state" style={{ marginBottom: 26 }}>
          Aucun article disponible pour le moment. Revenez plus tard.
        </div>
      )}

      <div className="card-title" style={{ marginBottom: 10 }}>
        Proposer une idée d&apos;article
      </div>
      <div className="card" style={{ marginBottom: 26 }}>
        <p style={{ fontSize: "12.5px", color: "var(--text-faint)", marginBottom: 14 }}>
          Vous pensez à un sujet qui mérite d&apos;être traité ? Proposez-le : un administrateur le validera avant qu&apos;il
          n&apos;apparaisse dans les projets disponibles.
        </p>
        <form action={proposeArticle}>
          <div className="grid grid-2">
            <div className="field">
              <label>Titre</label>
              <input type="text" name="title" placeholder="Titre de l'article" required />
            </div>
            <div className="field">
              <label>Sujet principal</label>
              <input type="text" name="mainSubject" placeholder="Ex : Politique institutionnelle" />
            </div>
            <div className="field">
              <label>Sujet secondaire</label>
              <input type="text" name="secondSubject" placeholder="Optionnel" />
            </div>
            <div className="field">
              <label>Destiné à la publication</label>
              <div className="radio-row">
                <label>
                  <input type="radio" name="forPublication" value="oui" defaultChecked /> Oui
                </label>
                <label>
                  <input type="radio" name="forPublication" value="non" /> Non
                </label>
              </div>
            </div>
          </div>
          <div className="field">
            <label>Informations complémentaires</label>
            <textarea name="extraInfo" placeholder="Optionnel" style={{ minHeight: 60 }} />
          </div>
          <button type="submit" className="btn btn-primary btn-sm">
            Envoyer la proposition
          </button>
        </form>

        {myProposals.length ? (
          <>
            <div className="divider" />
            <div className="ui-label" style={{ marginBottom: 8 }}>
              Mes propositions en attente
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myProposals.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span className="tag tag-blue">En attente de validation</span>
                  <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{p.title}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </Shell>
  );
}
