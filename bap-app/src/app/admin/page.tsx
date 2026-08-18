import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { Shell } from "@/components/Shell";
import {
  ACTIVE_STATUSES,
  GRADES,
  canAccessAdminPanel,
  isAdmin,
  isBlockedByAdmin,
  isRedacChef,
  roleLabels,
  statusLabels,
  type Role,
} from "@/lib/permissions";
import { fmtDate, fmtDateShort, deadlineInfo } from "@/lib/dates";
import {
  createArticle,
  validateArticle,
  rejectArticle,
  approveCancellation,
  declineCancellation,
  deleteArticle,
  archiveArticle,
  forceRemoveJournalist,
} from "@/actions/articles";
import { addAuthorizedUser, removeAuthorizedUser } from "@/actions/access";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

const ALL_TABS = [
  { key: "overview", label: "Vue d'ensemble", adminOnly: false },
  { key: "new", label: "Nouveau projet", adminOnly: true },
  { key: "validation", label: "Validation", adminOnly: true },
  { key: "cancellations", label: "Annulations", adminOnly: true },
  { key: "history", label: "Historique", adminOnly: true },
  { key: "archives", label: "Archives", adminOnly: true },
  { key: "journalists", label: "Journalistes", adminOnly: false },
  { key: "access", label: "Accès", adminOnly: true },
] as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");
  const viewerRole = viewer.role as Role;
  if (!canAccessAdminPanel(viewerRole)) redirect("/profil");

  const viewerIsAdmin = isAdmin(viewerRole);
  const TABS = ALL_TABS.filter((t) => viewerIsAdmin || !t.adminOnly);

  const { tab: tabParam } = await searchParams;
  const activeTab = (TABS.find((t) => t.key === tabParam)?.key ?? "overview") as (typeof ALL_TABS)[number]["key"];
  const isRedacChefViewer = isRedacChef(viewerRole);

  const db = getDb();
  const [allArticles, journalists, authorizedUsers] = await Promise.all([
    db.select().from(schema.articles),
    db.select().from(schema.users),
    viewerIsAdmin
      ? db.select().from(schema.authorizedRobloxUsers).orderBy(desc(schema.authorizedRobloxUsers.addedAt))
      : Promise.resolve([]),
  ]);

  const activeSet = new Set(ACTIVE_STATUSES as readonly string[]);
  const inProgress = allArticles.filter((a) => activeSet.has(a.status));
  const pendingValidation = allArticles.filter((a) => a.status === "en_validation");
  const pendingCancellations = allArticles.filter((a) => !!a.cancelRequestJournalistId);
  const history = allArticles.filter((a) => a.status === "valide" && !a.archived);
  const archives = allArticles.filter((a) => a.status === "valide" && a.archived);

  const journalistName = (id: string | null) => {
    if (!id) return "—";
    const j = journalists.find((x) => x.robloxId === id);
    return j ? `${j.rpFirstName} ${j.rpLastName}`.trim() || j.robloxUsername : "—";
  };

  return (
    <Shell user={viewer} activePage="admin">
      <div className="page-header">
        <div>
          <div className="eyebrow ui-label">Administration</div>
          <h1>Panel administrateur</h1>
          <div className="desc">
            {viewerIsAdmin
              ? "Gestion des journalistes, des projets d'articles et des validations."
              : "Vue d'ensemble en lecture seule de l'effectif et des articles en cours."}
          </div>
        </div>
        <span className={`role-badge ${isRedacChefViewer ? "redac-chef" : viewerRole}`}>{roleLabels[viewerRole]}</span>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <a key={t.key} href={`/admin?tab=${t.key}`} className={`tab-link ${activeTab === t.key ? "active" : ""}`}>
            {t.label}
            {t.key === "validation" && pendingValidation.length ? (
              <span className="tag tag-red" style={{ marginLeft: 4 }}>
                {pendingValidation.length}
              </span>
            ) : null}
            {t.key === "cancellations" && pendingCancellations.length ? (
              <span className="tag tag-orange" style={{ marginLeft: 4 }}>
                {pendingCancellations.length}
              </span>
            ) : null}
          </a>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="card">
          <div className="card-title">Articles en cours de traitement ({inProgress.length})</div>
          {inProgress.length ? (
            inProgress.map((a) => {
              const st = statusLabels[a.status];
              return (
                <div key={a.id} className="card" style={{ background: "var(--panel-2)", marginBottom: 12 }}>
                  <div className="art-tags">
                    <span className={`tag ${st.cls}`}>{st.label}</span>
                    {a.cancelRequestJournalistId ? <span className="tag tag-orange">Annulation demandée</span> : null}
                    {a.secondRequestJournalistId ? <span className="tag tag-blue">Demande de journaliste secondaire</span> : null}
                  </div>
                  <div className="art-title">{a.title}</div>
                  <div className="art-meta" style={{ marginBottom: 10 }}>
                    {a.mainSubject}
                    {a.secondSubject ? ` · ${a.secondSubject}` : ""} — créé le {fmtDateShort(a.createdAt)}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="art-meta" style={{ margin: 0 }}>
                        Principal : {journalistName(a.mainJournalistId)}
                      </span>
                      {viewerIsAdmin && a.mainJournalistId ? (
                        <form action={forceRemoveJournalist}>
                          <input type="hidden" name="articleId" value={a.id} />
                          <input type="hidden" name="journalistId" value={a.mainJournalistId} />
                          <ConfirmSubmitButton
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "2px 8px", fontSize: 11 }}
                            message={`Retirer de force ${journalistName(a.mainJournalistId)} de « ${a.title} » ?`}
                          >
                            Retirer
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                    </div>
                    {a.secondJournalistId ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="art-meta" style={{ margin: 0 }}>
                          Secondaire : {journalistName(a.secondJournalistId)}
                        </span>
                        {viewerIsAdmin ? (
                          <form action={forceRemoveJournalist}>
                            <input type="hidden" name="articleId" value={a.id} />
                            <input type="hidden" name="journalistId" value={a.secondJournalistId} />
                            <ConfirmSubmitButton
                              className="btn btn-ghost btn-sm"
                              style={{ padding: "2px 8px", fontSize: 11 }}
                              message={`Retirer de force ${journalistName(a.secondJournalistId)} de « ${a.title} » ?`}
                            >
                              Retirer
                            </ConfirmSubmitButton>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--text-dim)",
                      whiteSpace: "pre-wrap",
                      maxHeight: 120,
                      overflow: "auto",
                      background: "var(--panel)",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      marginBottom: 10,
                    }}
                  >
                    {(a.content || "(brouillon vide)").slice(0, 500)}
                  </p>

                  <a className="btn btn-ghost btn-sm" href={`/redaction/${a.id}`}>
                    Voir en entier
                  </a>
                </div>
              );
            })
          ) : (
            <div className="empty-state">Aucun article en cours actuellement.</div>
          )}
        </div>
      ) : null}

      {activeTab === "new" && viewerIsAdmin ? (
        <div className="card">
          <div className="card-title">Créer un projet d&apos;article</div>
          <form action={createArticle}>
            <div className="grid grid-2">
              <div className="field">
                <label>Titre</label>
                <input type="text" name="title" placeholder="Titre de l'article" required />
              </div>
              <div className="field">
                <label>Grade requis</label>
                <select name="grade" defaultValue="Journaliste">
                  {GRADES.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
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
                <label>Journaliste principal (optionnel)</label>
                <select name="mainJournalistId" defaultValue="">
                  <option value="">— Laisser au choix des journalistes —</option>
                  {journalists.map((j) => (
                    <option key={j.robloxId} value={j.robloxId}>
                      {`${j.rpFirstName} ${j.rpLastName}`.trim() || j.robloxUsername}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Journaliste secondaire (optionnel)</label>
                <select name="secondJournalistId" defaultValue="">
                  <option value="">— Aucun —</option>
                  {journalists.map((j) => (
                    <option key={j.robloxId} value={j.robloxId}>
                      {`${j.rpFirstName} ${j.rpLastName}`.trim() || j.robloxUsername}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Informations complémentaires</label>
              <textarea name="extraInfo" placeholder="Optionnel" style={{ minHeight: 70 }} />
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
            <button type="submit" className="btn btn-primary">
              Créer le projet
            </button>
          </form>
        </div>
      ) : null}

      {activeTab === "validation" && viewerIsAdmin ? (
        <div className="card">
          <div className="card-title">Articles en attente de validation ({pendingValidation.length})</div>
          {pendingValidation.length ? (
            pendingValidation.map((a) => (
              <div key={a.id} className="card" style={{ background: "var(--panel-2)", marginBottom: 12 }}>
                <div className="art-title">{a.title}</div>
                <div className="art-meta" style={{ marginBottom: 10 }}>
                  {journalistName(a.mainJournalistId)}
                  {a.secondJournalistId ? ` · ${journalistName(a.secondJournalistId)}` : ""} — {a.mainSubject}
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-dim)",
                    whiteSpace: "pre-wrap",
                    maxHeight: 120,
                    overflow: "auto",
                    background: "var(--panel)",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                >
                  {(a.content || "(vide)").slice(0, 500)}
                </p>
                <form>
                  <input type="hidden" name="articleId" value={a.id} />
                  <div className="field" style={{ marginTop: 12 }}>
                    <label>Commentaire (requis pour un renvoi)</label>
                    <textarea name="comment" style={{ minHeight: 60 }} placeholder="Ex : merci d'ajouter une source pour le second paragraphe" />
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="submit" formAction={validateArticle} className="btn btn-primary btn-sm">
                      ✓ Valider l&apos;article
                    </button>
                    <button type="submit" formAction={rejectArticle} className="btn btn-danger btn-sm">
                      Renvoyer avec commentaires
                    </button>
                    <a className="btn btn-ghost btn-sm" href={`/redaction/${a.id}`}>
                      Voir en entier
                    </a>
                  </div>
                </form>
              </div>
            ))
          ) : (
            <div className="empty-state">Aucun article en attente de validation.</div>
          )}
        </div>
      ) : null}

      {activeTab === "cancellations" && viewerIsAdmin ? (
        <div className="card">
          <div className="card-title">Demandes d&apos;annulation ({pendingCancellations.length})</div>
          {pendingCancellations.length ? (
            pendingCancellations.map((a) => {
              const otherJournalistId = a.mainJournalistId === a.cancelRequestJournalistId ? a.secondJournalistId : a.mainJournalistId;
              const willBecomeAvailable = !otherJournalistId;
              return (
                <div key={a.id} className="card" style={{ background: "var(--panel-2)", marginBottom: 12 }}>
                  <div className="art-title">{a.title}</div>
                  <div className="art-meta" style={{ marginBottom: 10 }}>
                    Demandé par <b style={{ color: "var(--text-dim)" }}>{journalistName(a.cancelRequestJournalistId)}</b> le{" "}
                    {a.cancelRequestDate ? fmtDate(a.cancelRequestDate) : ""}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-dim)", background: "var(--panel)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                    {a.cancelRequestReason}
                  </p>
                  <p style={{ fontSize: "11.5px", color: "var(--text-faint)", marginTop: 10 }}>
                    {willBecomeAvailable
                      ? "Si approuvée, l'article redeviendra disponible pour tous les journalistes."
                      : `Si approuvée, ${journalistName(otherJournalistId)} restera seul(e) en charge de l'article.`}
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <form action={approveCancellation}>
                      <input type="hidden" name="articleId" value={a.id} />
                      <button type="submit" className="btn btn-primary btn-sm">
                        ✓ Approuver l&apos;annulation
                      </button>
                    </form>
                    <form action={declineCancellation}>
                      <input type="hidden" name="articleId" value={a.id} />
                      <button type="submit" className="btn btn-ghost btn-sm">
                        Refuser la demande
                      </button>
                    </form>
                    <a className="btn btn-ghost btn-sm" href={`/redaction/${a.id}`}>
                      Voir l&apos;article
                    </a>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-state">Aucune demande d&apos;annulation en attente.</div>
          )}
        </div>
      ) : null}

      {activeTab === "history" && viewerIsAdmin ? (
        <div className="card">
          <div className="card-title">Historique des articles validés ({history.length})</div>
          {history.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Titre</th>
                  <th>Journaliste(s)</th>
                  <th>Sujet</th>
                  <th>Publication</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.map((a) => (
                  <tr key={a.id}>
                    <td style={{ color: "var(--text)" }}>{a.title}</td>
                    <td>
                      {journalistName(a.mainJournalistId)}
                      {a.secondJournalistId ? ` · ${journalistName(a.secondJournalistId)}` : ""}
                    </td>
                    <td>{a.mainSubject}</td>
                    <td>{a.forPublication ? <span className="tag tag-green">Oui</span> : <span className="tag tag-gray">Non</span>}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <form action={archiveArticle}>
                        <input type="hidden" name="articleId" value={a.id} />
                        <button type="submit" className="btn btn-ghost btn-sm">
                          Archiver
                        </button>
                      </form>
                      <form>
                        <input type="hidden" name="articleId" value={a.id} />
                        <ConfirmSubmitButton
                          formAction={deleteArticle}
                          className="btn btn-danger btn-sm"
                          message={`Supprimer définitivement l'article « ${a.title} » ? Cette action est irréversible.`}
                        >
                          Supprimer
                        </ConfirmSubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">Aucun article validé pour le moment.</div>
          )}
        </div>
      ) : null}

      {activeTab === "archives" && viewerIsAdmin ? (
        <div className="card">
          <div className="card-title">Articles archivés ({archives.length})</div>
          {archives.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Titre</th>
                  <th>Journaliste(s)</th>
                  <th>Sujet</th>
                  <th>Archivé le</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {archives.map((a) => (
                  <tr key={a.id}>
                    <td style={{ color: "var(--text)" }}>{a.title}</td>
                    <td>
                      {journalistName(a.mainJournalistId)}
                      {a.secondJournalistId ? ` · ${journalistName(a.secondJournalistId)}` : ""}
                    </td>
                    <td>{a.mainSubject}</td>
                    <td>{a.archivedAt ? fmtDateShort(a.archivedAt) : "—"}</td>
                    <td>
                      <form>
                        <input type="hidden" name="articleId" value={a.id} />
                        <ConfirmSubmitButton
                          formAction={deleteArticle}
                          className="btn btn-danger btn-sm"
                          message={`Supprimer définitivement l'article archivé « ${a.title} » ? Cette action est irréversible.`}
                        >
                          Supprimer
                        </ConfirmSubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">Aucun article archivé pour le moment.</div>
          )}
        </div>
      ) : null}

      {activeTab === "journalists" ? (
        <div className="card">
          <div className="card-title">Journalistes ({journalists.length})</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom RP</th>
                <th>Roblox</th>
                <th>Grade</th>
                <th>Rôle</th>
                <th>Statut compte</th>
                <th>Deadline</th>
                <th>Articles</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {journalists.map((j) => {
                const jRole = j.role as Role;
                const immune = jRole === "supervision";
                const dInfo = deadlineInfo(j.deadlineDate);
                const blocked = isBlockedByAdmin(j);
                const roleClass = j.role === "redac_chef" ? "redac-chef" : j.role;
                return (
                  <tr key={j.robloxId}>
                    <td style={{ color: "var(--text)" }}>{`${j.rpFirstName} ${j.rpLastName}`.trim() || "—"}</td>
                    <td>@{j.robloxUsername}</td>
                    <td>{j.grade}</td>
                    <td>
                      <span className={`role-badge ${roleClass}`} style={{ fontSize: 10 }}>
                        {roleLabels[jRole]}
                      </span>
                    </td>
                    <td>{blocked ? <span className="tag tag-red">🔒 Gelé</span> : <span className="tag tag-green">Actif</span>}</td>
                    <td>
                      {immune ? (
                        <span className="tag tag-blue">Immunisé</span>
                      ) : (
                        <span className={`tag ${dInfo.isGreen ? "tag-green" : "tag-red"}`}>{dInfo.remaining < 0 ? "Retard" : `${dInfo.remaining} j`}</span>
                      )}
                    </td>
                    <td>{j.articlesCount}</td>
                    <td>
                      <a className="btn btn-ghost btn-sm" href={`/profil/${j.robloxId}`}>
                        Voir la fiche
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!isRedacChefViewer ? (
            <p style={{ fontSize: "11.5px", color: "var(--text-faint)", marginTop: 12 }}>
              Seul le rédacteur en chef peut nommer ou retirer des administrateurs ou le droit de regard (depuis la fiche du
              journaliste).
            </p>
          ) : null}
        </div>
      ) : null}

      {activeTab === "access" && viewerIsAdmin ? (
        <div className="card">
          <div className="card-title">Liste blanche d&apos;accès au site</div>
          <p style={{ fontSize: "12.5px", color: "var(--text-faint)", marginBottom: 16 }}>
            Se connecter avec Roblox ne suffit pas à obtenir un compte : seules les personnes ci-dessous (identifiées par leur
            ID ou leur nom d&apos;utilisateur Roblox) pourront accéder au site lors de leur première connexion.
          </p>

          <form action={addAuthorizedUser} style={{ marginBottom: 20 }}>
            <div className="grid grid-3">
              <div className="field">
                <label>ID Roblox (recommandé)</label>
                <input type="text" name="robloxId" placeholder="Ex : 123456789" />
              </div>
              <div className="field">
                <label>Nom d&apos;utilisateur Roblox</label>
                <input type="text" name="robloxUsername" placeholder="Ex : Prenom_RP" />
              </div>
              <div className="field">
                <label>Note (optionnel)</label>
                <input type="text" name="note" placeholder="Ex : recrue prévue le 20/08" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm">
              Ajouter à la liste blanche
            </button>
          </form>

          {authorizedUsers.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID Roblox</th>
                  <th>Nom d&apos;utilisateur</th>
                  <th>Note</th>
                  <th>Ajouté par</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {authorizedUsers.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.robloxId || "—"}</td>
                    <td>{entry.robloxUsername ? `@${entry.robloxUsername}` : "—"}</td>
                    <td>{entry.note || "—"}</td>
                    <td>
                      {entry.addedBy}
                      <br />
                      <span style={{ fontSize: 11 }}>{fmtDateShort(entry.addedAt)}</span>
                    </td>
                    <td>
                      {entry.claimedByRobloxId ? <span className="tag tag-green">Compte créé</span> : <span className="tag tag-gray">En attente</span>}
                    </td>
                    <td>
                      <form action={removeAuthorizedUser}>
                        <input type="hidden" name="id" value={entry.id} />
                        <button type="submit" className="btn btn-ghost btn-sm">
                          Retirer
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">Aucune entrée dans la liste blanche pour le moment.</div>
          )}
        </div>
      ) : null}
    </Shell>
  );
}
