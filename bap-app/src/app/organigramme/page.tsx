import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { Shell } from "@/components/Shell";
import { GRADES, isBlockedByAdmin, isImmuneFromDeadline } from "@/lib/permissions";
import { deadlineInfo } from "@/lib/dates";

type UserRow = typeof schema.users.$inferSelect;

// Couleur du contour de la carte : rouge en cas de freeze administratif,
// bleu si la deadline est immunisée, sinon la même couleur que l'anneau
// de deadline du profil (vert confortable / rouge proche ou dépassée).
function cardBorderColor(m: UserRow): string {
  if (isBlockedByAdmin(m)) return "var(--red)";
  if (isImmuneFromDeadline(m)) return "var(--blue)";
  return deadlineInfo(m.deadlineDate).isGreen ? "var(--green)" : "var(--red)";
}

// Organigramme du Bureau : tout le monde, classé par grade. Une rangée
// par grade, du plus élevé (en haut de page) au plus bas — les Analystes
// tout en bas, les Journalistes Junior juste au-dessus, etc. Cliquer sur
// une carte ouvre le profil du membre (ouvert à tous depuis /profil/[id]).
export default async function OrganigrammePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = getDb();
  const allUsers = await db.select().from(schema.users);

  const byGrade = new Map<string, UserRow[]>();
  for (const g of GRADES) byGrade.set(g, []);
  for (const u of allUsers) {
    if (!byGrade.has(u.grade)) byGrade.set(u.grade, []);
    byGrade.get(u.grade)!.push(u);
  }
  for (const list of byGrade.values()) {
    list.sort((a, b) => {
      const nameA = `${a.rpFirstName} ${a.rpLastName}`.trim() || a.robloxUsername;
      const nameB = `${b.rpFirstName} ${b.rpLastName}`.trim() || b.robloxUsername;
      return nameA.localeCompare(nameB);
    });
  }

  // Du grade le plus haut (affiché en premier / en haut) au plus bas
  // (Analyste, affiché en dernier / en bas).
  const orderedGrades = [...GRADES].reverse();

  return (
    <Shell user={user} activePage="organigramme">
      <div className="page-header">
        <div>
          <div className="eyebrow ui-label">Effectif</div>
          <h1>Organigramme</h1>
          <div className="desc">Tous les membres du Bureau, classés par grade. Cliquez sur une carte pour voir le profil.</div>
        </div>
      </div>

      {orderedGrades.map((grade) => {
        const members = byGrade.get(grade) || [];
        if (!members.length) return null;
        return (
          <div key={grade} className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">
              {grade} ({members.length})
            </div>
            <div className="grid grid-auto">
              {members.map((m) => {
                const name = `${m.rpFirstName} ${m.rpLastName}`.trim() || m.robloxUsername;
                return (
                  <a
                    key={m.robloxId}
                    href={`/profil/${m.robloxId}`}
                    className="org-card"
                    style={{ borderColor: cardBorderColor(m), borderWidth: 2 }}
                  >
                    {m.robloxAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="org-card-avatar" src={m.robloxAvatarUrl} alt="" />
                    ) : (
                      <div className="org-card-avatar" style={{ background: "var(--panel-3)" }} />
                    )}
                    <div className="org-card-name">{name}</div>
                    <div className="org-card-meta">@{m.robloxUsername}</div>
                    {m.customTitle ? (
                      <span className={`tag tag-${m.customTitleColor}`} style={{ marginTop: 4 }}>
                        {m.customTitle}
                      </span>
                    ) : null}
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
    </Shell>
  );
}
