import type { TeamView } from "@/lib/views";

/** The feed serves 50-pixel logos alongside full-size ones at the same path without the folder. */
export function TeamLogo({ team, size = 28, className = "" }: { team: Pick<TeamView, "abbrev" | "logo">; size?: number; className?: string }) {
  if (team.logo) {
    const src = size > 50 ? team.logo.replace("/50x50/", "/") : team.logo;
    return (
      <span className={`inline-flex shrink-0 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={size} height={size} className="object-contain" style={{ width: size, height: size }} loading="lazy" />
      </span>
    );
  }
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-soft text-[10px] font-semibold text-muted ${className}`} style={{ width: size, height: size }} aria-hidden>
      {team.abbrev.slice(0, 3)}
    </span>
  );
}
