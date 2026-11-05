import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty } from "@/components/Card";
import { LiveScoreboard } from "@/components/LiveScoreboard";
import { fmtYmdLong } from "@/lib/format";
import { getGamesByDate } from "@/lib/queries";
import { TEAM_ID, addDays, isValidYmd, todayPacific } from "@/lib/season";
import { gameView, sortForFeatured } from "@/lib/views";

export const metadata: Metadata = { title: "Scores" };

export default async function ScoresPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const today = todayPacific();
  const date = isValidYmd(sp.date) ? sp.date : today;
  const games = await getGamesByDate(date);
  const views = sortForFeatured(games.map(gameView), TEAM_ID);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{fmtYmdLong(date)}</h1>
        <nav className="flex items-center gap-2 text-sm">
          <Link href={`/scores?date=${addDays(date, -1)}`} className="rounded-md border border-line px-3 py-1 hover:bg-soft">
            ← Prev
          </Link>
          {date !== today && (
            <Link href="/scores" className="rounded-md border border-line px-3 py-1 hover:bg-soft">
              Today
            </Link>
          )}
          <Link href={`/scores?date=${addDays(date, 1)}`} className="rounded-md border border-line px-3 py-1 hover:bg-soft">
            Next →
          </Link>
        </nav>
      </div>
      <p className="text-sm text-muted">
        {views.length} game{views.length === 1 ? "" : "s"}
      </p>
      <Card>{views.length ? <LiveScoreboard games={views} date={date} featuredId={TEAM_ID} /> : <Empty>No AHL games on this date.</Empty>}</Card>
    </div>
  );
}
