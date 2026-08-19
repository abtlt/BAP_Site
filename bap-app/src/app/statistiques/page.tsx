import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { Shell } from "@/components/Shell";
import { monthKey, monthLabel } from "@/lib/dates";
import { levelInfo } from "@/lib/xp";
import { Leaderboard, type LeaderboardEntry } from "@/components/Leaderboard";

// Statistiques globales du Bureau, tous journalistes confondus.
//
// "Ce mois-ci" et les "Archives mensuelles" sont dérivés de journaux
// horodatés (service_logs, articles.validated_at) plutôt que d'un
// compteur qu'on réinitialiserait chaque mois : un nouveau mois démarre
// donc naturellement à zéro, sans job de maintenance ni risque de perte
// de données, et les mois précédents restent consultables indéfiniment.
//
// "Depuis toujours" s'appuie sur les compteurs cumulés déjà fiables
// depuis la création de chaque compte (articlesCount, totalServiceSeconds,
// totalServiceCount), qui couvrent une période plus longue que les
// journaux horodatés (ajoutés plus récemment).
export default async function StatistiquesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = getDb();
  const [allUsers, allServiceLogs, validatedArticles] = await Promise.all([
    db.select().from(schema.users),
    db.select().from(schema.serviceLogs),
    db.select().from(schema.articles).where(eq(schema.articles.status, "valide")),
  ]);

  const currentMonth = monthKey(new Date());

  const allTime = {
    effectif: allUsers.length,
    totalServiceCount: allUsers.reduce((sum, u) => sum + u.totalServiceCount, 0),
    totalServiceHours: allUsers.reduce((sum, u) => sum + u.totalServiceSeconds, 0) / 3600,
    totalArticles: validatedArticles.length,
  };

  const monthBuckets = new Map<string, { serviceCount: number; serviceSeconds: number; articles: number }>();
  const bucket = (key: string) => {
    if (!monthBuckets.has(key)) monthBuckets.set(key, { serviceCount: 0, serviceSeconds: 0, articles: 0 });
    return monthBuckets.get(key)!;
  };
  for (const log of allServiceLogs) {
    const b = bucket(monthKey(log.endedAt));
    b.serviceCount += 1;
    b.serviceSeconds += log.durationSeconds;
  }
  for (const a of validatedArticles) {
    if (!a.validatedAt) continue;
    const b = bucket(monthKey(a.validatedAt));
    b.articles += 1;
  }

  const thisMonth = monthBuckets.get(currentMonth) || { serviceCount: 0, serviceSeconds: 0, articles: 0 };
  const archiveKeys = [...monthBuckets.keys()].filter((k) => k !== currentMonth).sort((a, b) => b.localeCompare(a));

  const leaderboardEntries: LeaderboardEntry[] = allUsers.map((u) => ({
    robloxId: u.robloxId,
    name: `${u.rpFirstName} ${u.rpLastName}`.trim() || u.robloxUsername,
    robloxUsername: u.robloxUsername,
    avatarUrl: u.robloxAvatarUrl,
    level: levelInfo(u.xp).level,
    xp: u.xp,
    totalServiceHours: u.totalServiceSeconds / 3600,
    totalServiceCount: u.totalServiceCount,
    articlesCount: u.articlesCount,
  }));

  return (
    <Shell user={user} activePage="statistiques">
      <div className="page-header">
        <div>
          <div className="eyebrow ui-label">Statistiques</div>
          <h1>Statistiques du Bureau</h1>
          <div className="desc">Vue d&apos;ensemble globale, tous journalistes confondus.</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Ce mois-ci — {monthLabel(currentMonth)}</div>
        <div className="grid grid-3">
          <div className="stat-box">
            <div className="stat-label">Prises de service</div>
            <div className="stat-value">{thisMonth.serviceCount}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Heures de service</div>
            <div className="stat-value" style={{ fontSize: 16 }}>
              {(thisMonth.serviceSeconds / 3600).toFixed(1)} h
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Articles validés</div>
            <div className="stat-value">{thisMonth.articles}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Depuis toujours</div>
        <div className="grid grid-3">
          <div className="stat-box">
            <div className="stat-label">Effectif</div>
            <div className="stat-value">{allTime.effectif}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Prises de service</div>
            <div className="stat-value">{allTime.totalServiceCount}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Heures de service</div>
            <div className="stat-value" style={{ fontSize: 16 }}>
              {allTime.totalServiceHours.toFixed(1)} h
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Articles validés</div>
            <div className="stat-value">{allTime.totalArticles}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Archives mensuelles</div>
        {archiveKeys.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Mois</th>
                <th>Prises de service</th>
                <th>Heures de service</th>
                <th>Articles validés</th>
              </tr>
            </thead>
            <tbody>
              {archiveKeys.map((k) => {
                const b = monthBuckets.get(k)!;
                return (
                  <tr key={k}>
                    <td style={{ color: "var(--text)" }}>{monthLabel(k)}</td>
                    <td>{b.serviceCount}</td>
                    <td>{(b.serviceSeconds / 3600).toFixed(1)} h</td>
                    <td>{b.articles}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">Aucune archive mensuelle pour le moment — elle se remplira au fil des mois.</div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Classement</div>
        <Leaderboard entries={leaderboardEntries} />
      </div>
    </Shell>
  );
}
