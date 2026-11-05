import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { TeamLogo } from "@/components/TeamLogo";
import { fmtDateTime } from "@/lib/format";
import { getFeaturedTeam, getLastIngest } from "@/lib/queries";
import { TEAM_NAME, seasonLabel } from "@/lib/season";
import { teamView } from "@/lib/views";

export const metadata: Metadata = {
  title: { default: `${TEAM_NAME} ${seasonLabel()}`, template: `%s · ${TEAM_NAME} ${seasonLabel()}` },
  description: "San Jose Barracuda and the AHL season at a glance.",
};

export const dynamic = "force-dynamic";

const NAV = [
  ["/", "Home"],
  ["/scores", "Scores"],
  ["/schedule", "Schedule"],
  ["/standings", "Standings"],
  ["/roster", "Roster"],
  ["/moves", "Moves"],
  ["/team", "Team"],
  ["/stats", "Stats"],
  ["/rankings", "Rankings"],
] as const;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [featured, last] = await Promise.all([getFeaturedTeam(), getLastIngest()]);
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-line bg-card">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
              {featured && <TeamLogo team={teamView(featured)} size={32} />}
              <span className="whitespace-nowrap">
                {TEAM_NAME} <span className="text-muted">{seasonLabel()}</span>
              </span>
            </Link>
            <nav className="-mr-4 ml-auto flex gap-0.5 overflow-x-auto pr-4 text-sm sm:gap-1">
              {NAV.map(([href, label]) => (
                <Link key={href} href={href} className="rounded-md px-2 py-1.5 hover:bg-soft sm:px-3">
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-muted">
          Scores, schedule, standings, box scores and shot locations from the AHL&apos;s public HockeyTech feed. Playoff odds and power rankings are computed here. Unofficial, for personal use.
          {last && (
            <>
              {" "}
              Data last updated <time dateTime={last.toISOString()}>{fmtDateTime(last)}</time>.
            </>
          )}
        </footer>
      </body>
    </html>
  );
}
