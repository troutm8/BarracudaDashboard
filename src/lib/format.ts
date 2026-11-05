export const DISPLAY_TZ = process.env.NEXT_PUBLIC_DISPLAY_TZ ?? "America/Los_Angeles";

export function fmtTime(d: Date | string | null | undefined, tz = DISPLAY_TZ): string {
  if (!d) return "TBA";
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(dt);
}

export function fmtDateTime(d: Date | string | null | undefined, tz = DISPLAY_TZ): string {
  if (!d) return "TBA";
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(dt);
}

/** Format a YYYY-MM-DD calendar date without time-zone shifting. */
export function fmtYmd(ymd: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function fmtYmdLong(ymd: string): string {
  return fmtYmd(ymd, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** Percentage stored as a fraction (0.535) shown the hockey way: ".536" or "53.6%". */
export function pct3(n: number | string | null | undefined): string {
  if (n == null || n === "") return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(3).replace(/^0/, "");
}

export function pct1(n: number | string | null | undefined, alreadyPercent = false): string {
  if (n == null || n === "") return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${(alreadyPercent ? v : v * 100).toFixed(1)}%`;
}

export function num(n: number | string | null | undefined, digits = 2): string {
  if (n == null || n === "") return "—";
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(digits) : "—";
}

export function int(n: number | string | null | undefined): string {
  if (n == null || n === "") return "—";
  const v = Number(n);
  return Number.isFinite(v) ? String(Math.round(v)) : "—";
}

export function signed(n: number | null | undefined): string {
  if (n == null) return "—";
  return n > 0 ? `+${n}` : String(n);
}

/** Seconds to "mm:ss". */
export function fmtToi(seconds: number | string | null | undefined): string {
  if (seconds == null || seconds === "") return "—";
  const s = Math.round(Number(seconds));
  if (!Number.isFinite(s)) return "—";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "mm:ss" to seconds. */
export function toiToSeconds(toi: string | null | undefined): number | null {
  if (!toi) return null;
  const m = toi.match(/^(\d+):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function daysUntil(ymd: string, today: string): number {
  return Math.round((Date.parse(ymd) - Date.parse(today)) / 86_400_000);
}

/** "1st", "2nd", "3rd", "OT", "SO" for a period number and type. */
export function periodLabel(number: number | null | undefined, type: string | null | undefined): string {
  if (!number) return "";
  if (type === "SO") return "SO";
  if (type === "OT") return number > 4 ? `${number - 3}OT` : "OT";
  return ordinal(number);
}

/** Suffix for a final score: "", " (OT)" or " (SO)". */
export function finalSuffix(lastPeriodType: string | null | undefined): string {
  if (lastPeriodType === "OT") return " (OT)";
  if (lastPeriodType === "SO") return " (SO)";
  return "";
}
