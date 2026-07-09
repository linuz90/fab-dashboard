export function agoLabel(isoOrMs: string | number, nowMs: number): string {
  const then = typeof isoOrMs === "number" ? isoOrMs : Date.parse(isoOrMs);
  if (!Number.isFinite(then)) return "";
  const s = Math.max(0, Math.round((nowMs - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const clockDayFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });

/** "Friday 4 July · 16:12" (locale-ordered) for the header clock. */
export function friendlyDateTime(nowMs: number): string {
  return `${clockDayFmt.format(nowMs)} · ${timeFmt.format(nowMs)}`;
}

/** Compact future point: "19:40" when it falls today, otherwise "Thu".
 * Used for quota reset times where a full date would be noise. */
export function shortWhenLabel(iso: string, nowMs: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameDay = d.toDateString() === new Date(nowMs).toDateString();
  return sameDay ? timeFmt.format(d) : dayFmt.format(d);
}

/** Compact countdown to a future point: "in 34m", "in 3h 12m", "in 5d 4h";
 * "now" once it has started. */
export function untilLabel(iso: string, nowMs: number): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const m = Math.round((then - nowMs) / 60_000);
  if (m <= 0) return "now";
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `in ${d}d ${h % 24}h`;
}

/** Single-unit compact countdown for glanceable lists: "45m", "20h", "3d";
 * "now" once it has started. Coarser than untilLabel — days for anything a
 * day-plus out, so a calendar of upcoming races reads at a glance. */
export function untilShort(iso: string, nowMs: number): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const m = Math.floor((then - nowMs) / 60_000);
  if (m <= 0) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** "13:35" plus a short day prefix ("Sat") when the event is not today. */
export function eventTimeLabel(start: string, allDay: boolean, nowMs: number): string {
  const d = new Date(allDay ? `${start}T00:00:00` : start);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date(nowMs);
  const sameDay = d.toDateString() === today.toDateString();
  const time = allDay ? "all day" : timeFmt.format(d);
  return sameDay ? time : `${dayFmt.format(d)} ${time}`;
}
