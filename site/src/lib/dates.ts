/** True when updatedDate is a later calendar day than date (text-only UI rule). */
export function isLaterCalendarDay(
  updated: Date | string | undefined,
  published: Date | string | undefined
): boolean {
  if (!updated || !published) return false;
  const u = toIsoDay(updated);
  const p = toIsoDay(published);
  if (!u || !p) return false;
  return u > p;
}

export function toIsoDay(value: Date | string): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDisplayDate(value: Date | string): string {
  const iso = toIsoDay(value);
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
