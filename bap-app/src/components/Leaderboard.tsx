"use client";

import { useMemo, useState } from "react";

export interface LeaderboardEntry {
  robloxId: string;
  name: string;
  robloxUsername: string;
  avatarUrl: string;
  level: number;
  xp: number;
  totalServiceHours: number;
  totalServiceCount: number;
  articlesCount: number;
}

const CRITERIA = [
  { key: "level", label: "Niveau (xp)" },
  { key: "totalServiceHours", label: "Heures de service" },
  { key: "totalServiceCount", label: "Prises de service" },
  { key: "articlesCount", label: "Articles réalisés" },
] as const;

type CriterionKey = (typeof CRITERIA)[number]["key"];

function valueFor(entry: LeaderboardEntry, key: CriterionKey): number {
  if (key === "level") return entry.xp;
  return entry[key];
}

function displayValue(entry: LeaderboardEntry, key: CriterionKey): string {
  if (key === "level") return `Niveau ${entry.level} (${entry.xp} xp)`;
  if (key === "totalServiceHours") return `${entry.totalServiceHours.toFixed(1)} h`;
  if (key === "totalServiceCount") return `${entry.totalServiceCount}`;
  return `${entry.articlesCount}`;
}

// Classement dynamique, trié entièrement côté client (aucune requête
// supplémentaire) : le sélecteur change juste la clé de tri.
export function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  const [criterion, setCriterion] = useState<CriterionKey>("level");

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => valueFor(b, criterion) - valueFor(a, criterion));
  }, [entries, criterion]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span className="ui-label">Trier par</span>
        <select value={criterion} onChange={(e) => setCriterion(e.target.value as CriterionKey)} style={{ width: "auto" }}>
          {CRITERIA.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((entry, i) => (
          <a key={entry.robloxId} href={`/profil/${entry.robloxId}`} className="leaderboard-row">
            <span className="leaderboard-rank">{i + 1}</span>
            {entry.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={entry.avatarUrl} alt="" className="leaderboard-avatar" />
            ) : (
              <div className="leaderboard-avatar" style={{ background: "var(--panel-3)" }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="leaderboard-name">{entry.name}</div>
              <div className="leaderboard-meta">@{entry.robloxUsername}</div>
            </div>
            <span className="leaderboard-value">{displayValue(entry, criterion)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
