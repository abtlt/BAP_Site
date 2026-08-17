// Helpers de date partagés (server + client). On reste en dates UTC ISO
// stockées en base ; l'affichage se fait en fr-FR.

export function daysBetween(a: Date | string, b: Date | string): number {
  const da = typeof a === "string" ? new Date(a) : a;
  const db_ = typeof b === "string" ? new Date(b) : b;
  return Math.round((db_.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

export function addDays(date: Date | string, n: number): Date {
  const d = typeof date === "string" ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateShort(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function seniority(arrivalDate: string): string {
  const days = daysBetween(arrivalDate, new Date());
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years > 0) return `${years} an${years > 1 ? "s" : ""}${months > 0 ? ` et ${months} mois` : ""}`;
  if (months > 0) return `${months} mois`;
  return `${Math.max(days, 0)} jour${days > 1 ? "s" : ""}`;
}

export function lastActivityLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const hours = Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60));
  if (hours < 1) return "à l'instant";
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

// Seuil vert/rouge (X jours) et durée d'un cycle de deadline — à ajuster
// selon les besoins du Bureau.
export const DEADLINE_THRESHOLD_DAYS = 9;
export const DEADLINE_CYCLE_DAYS = 30;

export function deadlineInfo(deadlineDate: string) {
  const remaining = daysBetween(new Date(), new Date(deadlineDate));
  const isGreen = remaining >= DEADLINE_THRESHOLD_DAYS;
  const pct = Math.max(0, Math.min(1, remaining / DEADLINE_CYCLE_DAYS));
  return { remaining, isGreen, pct };
}
