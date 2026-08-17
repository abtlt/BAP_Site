import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Shell } from "@/components/Shell";
import { DeadlineRing } from "@/components/DeadlineRing";
import { deadlineInfo, fmtDate, fmtDateShort, seniority, lastActivityLabel } from "@/lib/dates";
import { GRADES, isAdmin, isBlockedByAdmin, isRedacChef, roleLabels, type UserRow } from "@/lib/permissions";
import {
  placeFreeze,
  updateAdminInfo,
  creditBonusDays,
  removeDays,
  placeAdminFreeze,
  liftAdminFreeze,
  toggleAdminRole,
  deleteHistoryLog,
  deleteFreezeEntry,
} from "@/actions/journalists";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export async function ProfileView({ viewer, target }: { viewer: UserRow; target: UserRow }) {
  const isOwn = target.robloxId === viewer.robloxId;
  const viewerIsAdmin = isAdmin(viewer.role as "journaliste" | "admin" | "redac_chef");
  const blocked = isBlockedByAdmin(target);
  const dInfo = deadlineInfo(target.deadlineDate);
  const roleClass = target.role === "redac_chef" ? "redac-chef" : target.role;
  const displayName = `${target.rpFirstName} ${target.rpLastName}`.trim() || target.robloxUsername;

  const freezeEntries = await db
    .select()
    .from(schema.freezeEntries)
    .where(eq(schema.freezeEntries.userId, target.robloxId))
    .orderBy(desc(schema.freezeEntries.placedAt));

  const history = await db
    .select()
    .from(schema.historyLogs)
    .where(eq(schema.historyLogs.userId, target.robloxId))
    .orderBy(desc(schema.historyLogs.createdAt));

  return (
    <Shell user={viewer} activePage="profil">
      <div className="page-header">
        <div>
          {!isOwn ? (
            <div className="ui-label" style={{ marginBottom: 6 }}>
              <a href="/admin?tab=journalists">← Retour au panel</a>
            </div>
          ) : null}
          <div className="eyebrow ui-label">{isOwn ? "Mon profil" : "Fiche journaliste"}</div>
          <h1>{displayName}</h1>
          <div className="desc">
            @{target.robloxUsername} · {target.grade}
          </div>
        </div>
        <span className={`role-badge ${roleClass}`}>{roleLabels[target.role as "journaliste" | "admin" | "redac_chef"]}</span>
      </div>

      {blocked ? (
        <div className="card" style={{ borderColor: "var(--red)", background: "var(--red-bg)", marginBottom: 16 }}>
          <p style={{ margin: 0 }}>
            🔒 <b>Compte gelé par un administrateur</b> — {target.adminFreezeReason}
            <br />
            <span style={{ color: "var(--text-dim)", fontSize: "11.5px" }}>
              Placé par {target.adminFreezePlacedBy} le {target.adminFreezePlacedDate ? fmtDate(target.adminFreezePlacedDate) : ""}.{" "}
              {displayName} ne peut ni prendre, ni rédiger, ni envoyer d&apos;article tant que ce freeze n&apos;est pas levé.
            </span>
          </p>
        </div>
      ) : null}

      <div className="card">
        <div className="profile-header">
          {target.robloxAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="profile-avatar" src={target.robloxAvatarUrl} alt="Avatar Roblox" />
          ) : (
            <div className="profile-avatar" style={{ background: "var(--panel-3)" }} />
          )}
          <div>
            <div className="profile-name">{displayName}</div>
            <div className="profile-meta">Nom Roblox : @{target.robloxUsername}</div>
            <div className="profile-meta">Grade : {target.grade}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-title">Deadline actuelle</div>
          <DeadlineRing remaining={dInfo.remaining} isGreen={dInfo.isGreen} />
          <div className="divider" />
          <div className="ui-label" style={{ marginBottom: 8 }}>
            Jours de freeze disponibles : <b style={{ color: "var(--gold-light)" }}>{target.freezeDays}</b>
          </div>
          {isOwn ? (
            <form action={placeFreeze} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="number"
                name="amount"
                min={1}
                max={target.freezeDays}
                defaultValue={1}
                disabled={target.freezeDays < 1 || blocked}
                style={{
                  width: 70,
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  color: "var(--text)",
                }}
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={target.freezeDays < 1 || blocked}>
                Placer un freeze
              </button>
            </form>
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-faint)" }}>Seul le journaliste concerné peut placer ses jours de freeze.</p>
          )}
          {isOwn ? (
            <p style={{ fontSize: "11.5px", color: "var(--text-faint)", marginTop: 8 }}>
              {blocked ? "Indisponible pendant un freeze administrateur." : "Un freeze met en pause votre deadline pour le nombre de jours choisi."}
            </p>
          ) : null}
          {freezeEntries.length ? (
            <>
              <div className="divider" />
              <div className="ui-label" style={{ marginBottom: 6 }}>
                Freeze programmés
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {freezeEntries.map((f) => (
                  <span key={f.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span className="tag tag-gray">
                      {f.days} j — {fmtDateShort(f.placedAt)}
                    </span>
                    {viewerIsAdmin ? (
                      <form action={deleteFreezeEntry} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="userId" value={target.robloxId} />
                        <button
                          type="submit"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: "2px 6px", fontSize: 11 }}
                          title="Retirer cette entrée de l'historique"
                        >
                          ✕
                        </button>
                      </form>
                    ) : null}
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="card">
          <div className="card-title">Statistiques</div>
          <div className="grid grid-2">
            <div className="stat-box">
              <div className="stat-label">Ancienneté</div>
              <div className="stat-value" style={{ fontSize: 16 }}>
                {seniority(target.arrivalDate)}
              </div>
              <div className="stat-sub">Arrivé le {fmtDate(target.arrivalDate)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Dernière activité</div>
              <div className="stat-value" style={{ fontSize: 16 }}>
                {lastActivityLabel(target.lastActivity)}
              </div>
              <div className="stat-sub">{fmtDate(target.lastActivity)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Articles réalisés</div>
              <div className="stat-value">{target.articlesCount}</div>
              <div className="stat-sub">depuis son arrivée</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Jours de freeze</div>
              <div className="stat-value">{target.freezeDays}</div>
              <div className="stat-sub">disponibles</div>
            </div>
          </div>
        </div>
      </div>

      {viewerIsAdmin ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">Informations administratives {isOwn ? "" : "— modifiable par un administrateur"}</div>
          <form action={updateAdminInfo}>
            <input type="hidden" name="userId" value={target.robloxId} />
            <div className="grid grid-2">
              <div className="field">
                <label>Prénom RP</label>
                <input type="text" name="rpFirstName" defaultValue={target.rpFirstName} />
              </div>
              <div className="field">
                <label>Nom RP</label>
                <input type="text" name="rpLastName" defaultValue={target.rpLastName} />
              </div>
              <div className="field">
                <label>Grade</label>
                <select name="grade" defaultValue={target.grade}>
                  {GRADES.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Date d&apos;arrivée</label>
                <input type="date" name="arrivalDate" defaultValue={target.arrivalDate.slice(0, 10)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm">
              Enregistrer les modifications
            </button>
          </form>
        </div>
      ) : null}

      {viewerIsAdmin ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">Actions administratives</div>
          <div className="grid grid-2">
            <div>
              <div className="ui-label" style={{ marginBottom: 8 }}>
                Créditer des jours supplémentaires
              </div>
              <p style={{ fontSize: "11.5px", color: "var(--text-faint)", marginBottom: 10 }}>
                Ajoute directement des jours à la deadline actuelle (ex : problème technique, erreur de notre part).
              </p>
              <form action={creditBonusDays}>
                <input type="hidden" name="userId" value={target.robloxId} />
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <input
                    type="number"
                    name="amount"
                    min={1}
                    defaultValue={2}
                    style={{ width: 70, background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text)" }}
                  />
                  <span style={{ fontSize: "12.5px", color: "var(--text-faint)" }}>jour(s)</span>
                </div>
                <input
                  type="text"
                  name="reason"
                  placeholder="Raison (optionnel)"
                  style={{ width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", color: "var(--text)", fontSize: 13, marginBottom: 10 }}
                />
                <button type="submit" className="btn btn-primary btn-sm">
                  Créditer les jours
                </button>
              </form>

              <div className="divider" />

              <div className="ui-label" style={{ marginBottom: 8 }}>
                Retirer des jours
              </div>
              <p style={{ fontSize: "11.5px", color: "var(--text-faint)", marginBottom: 10 }}>
                Retire des jours de la deadline actuelle (ex : correction d&apos;une erreur, sanction).
              </p>
              <form action={removeDays}>
                <input type="hidden" name="userId" value={target.robloxId} />
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <input
                    type="number"
                    name="amount"
                    min={1}
                    defaultValue={2}
                    style={{ width: 70, background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text)" }}
                  />
                  <span style={{ fontSize: "12.5px", color: "var(--text-faint)" }}>jour(s)</span>
                </div>
                <input
                  type="text"
                  name="reason"
                  placeholder="Raison (optionnel)"
                  style={{ width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", color: "var(--text)", fontSize: 13, marginBottom: 10 }}
                />
                <button type="submit" className="btn btn-danger btn-sm">
                  Retirer les jours
                </button>
              </form>
            </div>

            <div>
              <div className="ui-label" style={{ marginBottom: 8 }}>
                Freeze administrateur
              </div>
              {blocked ? (
                <>
                  <p style={{ fontSize: "12.5px", color: "var(--text-dim)", marginBottom: 10 }}>
                    Actif depuis le {target.adminFreezePlacedDate ? fmtDate(target.adminFreezePlacedDate) : ""}, placé par {target.adminFreezePlacedBy}.
                    <br />
                    Raison : {target.adminFreezeReason}
                  </p>
                  <form action={liftAdminFreeze}>
                    <input type="hidden" name="userId" value={target.robloxId} />
                    <button type="submit" className="btn btn-danger btn-sm">
                      Lever le freeze administrateur
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <p style={{ fontSize: "11.5px", color: "var(--text-faint)", marginBottom: 10 }}>
                    Bloque totalement le compte (prise et rédaction d&apos;articles) jusqu&apos;à levée manuelle. À utiliser pour une suspension ou une absence prolongée.
                  </p>
                  <form action={placeAdminFreeze}>
                    <input type="hidden" name="userId" value={target.robloxId} />
                    <input
                      type="text"
                      name="reason"
                      placeholder="Raison du freeze (requise)"
                      required
                      style={{ width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", color: "var(--text)", fontSize: 13, marginBottom: 10 }}
                    />
                    <button type="submit" className="btn btn-danger btn-sm">
                      Placer un freeze administrateur
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {history.length ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">Historique administratif</div>
          {history.map((h) => (
            <div key={h.id} className="comment">
              <div className="comment-head">
                <b>{h.action}</b>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {fmtDate(h.createdAt)} · {h.adminName}
                  {viewerIsAdmin ? (
                    <form action={deleteHistoryLog}>
                      <input type="hidden" name="id" value={h.id} />
                      <input type="hidden" name="userId" value={target.robloxId} />
                      <ConfirmSubmitButton
                        className="btn btn-ghost btn-sm"
                        style={{ padding: "2px 6px", fontSize: 11 }}
                        message="Retirer cette entrée de l'historique ? Cela ne modifie pas les jours/deadline déjà appliqués, seule la trace est supprimée."
                      >
                        ✕
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </span>
              </div>
              <div>{h.detail}</div>
            </div>
          ))}
        </div>
      ) : null}

      {isRedacChef(viewer.role as "journaliste" | "admin" | "redac_chef") && !isOwn ? (
        <div className="card" style={{ marginTop: 16, borderColor: "var(--gold-dark)" }}>
          <div className="card-title">Droits d&apos;administration — Rédacteur en chef uniquement</div>
          {target.role === "admin" ? (
            <>
              <p style={{ fontSize: 13, color: "var(--text-dim)" }}>{target.rpFirstName || target.robloxUsername} est actuellement administrateur.</p>
              <form action={toggleAdminRole}>
                <input type="hidden" name="userId" value={target.robloxId} />
                <input type="hidden" name="makeAdmin" value="false" />
                <button type="submit" className="btn btn-danger btn-sm">
                  Retirer les droits d&apos;administration
                </button>
              </form>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--text-dim)" }}>{target.rpFirstName || target.robloxUsername} est actuellement journaliste.</p>
              <form action={toggleAdminRole}>
                <input type="hidden" name="userId" value={target.robloxId} />
                <input type="hidden" name="makeAdmin" value="true" />
                <button type="submit" className="btn btn-primary btn-sm">
                  Promouvoir administrateur
                </button>
              </form>
            </>
          )}
        </div>
      ) : null}
    </Shell>
  );
}
