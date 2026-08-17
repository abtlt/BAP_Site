import { DEADLINE_CYCLE_DAYS } from "@/lib/dates";

export function DeadlineRing({ remaining, isGreen, size = 128 }: { remaining: number; isGreen: boolean; size?: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, remaining / DEADLINE_CYCLE_DAYS));
  const offset = c * (1 - pct);
  const colorClass = isGreen ? "green" : "red";
  const label = remaining < 0 ? `${Math.abs(remaining)} j de retard` : `${remaining} j restants`;

  return (
    <div className="deadline-ring-wrap">
      <div className="deadline-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 128 128">
          <circle className="ring-bg" cx="64" cy="64" r={r} />
          <circle
            className={`ring-fg ${colorClass}`}
            cx="64"
            cy="64"
            r={r}
            strokeDasharray={c}
            strokeDashoffset={remaining < 0 ? 0 : offset}
          />
        </svg>
        <div className="ring-center">
          <div className={`ring-num ${colorClass}`}>{remaining < 0 ? "!" : remaining}</div>
          <div className="ring-unit">{remaining < 0 ? "retard" : "jours"}</div>
        </div>
      </div>
      <div>
        <span className={`tag ${isGreen ? "tag-green" : "tag-red"}`}>
          {isGreen ? "Deadline confortable" : remaining < 0 ? "Deadline dépassée" : "Deadline proche"}
        </span>
        <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 8 }}>{label} avant la prochaine échéance.</p>
      </div>
    </div>
  );
}
