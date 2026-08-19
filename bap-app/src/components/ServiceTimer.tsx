"use client";

import { useEffect, useState } from "react";
import { endService } from "@/actions/service";

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Chronomètre client qui tourne pendant un service en cours — calculé à
// partir de l'horodatage de début stocké en base (donc juste après un
// rechargement de page). Le bouton termine le service côté serveur.
export function ServiceTimer({ startedAt, serverId }: { startedAt: string; serverId: string }) {
  const [elapsed, setElapsed] = useState(() => Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)));

  useEffect(() => {
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <div>
      <div className="ui-label" style={{ marginBottom: 8 }}>
        Service en cours — serveur <b style={{ color: "var(--text-dim)" }}>{serverId}</b>
      </div>
      <div className="service-timer">{formatDuration(elapsed)}</div>
      <form action={endService} style={{ marginTop: 14 }}>
        <button type="submit" className="btn btn-danger btn-sm">
          Terminer le service
        </button>
      </form>
    </div>
  );
}
