import type { TeamView } from "@/lib/views";
import { TeamLogo } from "./TeamLogo";

export function TeamName({
  team,
  size = 24,
  bold = false,
  featured = false,
  short = false,
}: {
  team: TeamView;
  size?: number;
  bold?: boolean;
  featured?: boolean;
  short?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${bold ? "font-semibold" : ""} ${featured ? "text-teal" : ""}`}>
      <TeamLogo team={team} size={size} />
      <span className={short ? "" : "hidden sm:inline"}>{short ? team.abbrev : team.name}</span>
      {!short && <span className="sm:hidden">{team.commonName}</span>}
    </span>
  );
}
