import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty } from "@/components/Card";
import { fmtYmd } from "@/lib/format";
import { getKnownPlayerIds, getTransactions } from "@/lib/queries";

export const metadata: Metadata = { title: "Moves" };

const MONTH = (ymd: string) => fmtYmd(ymd, { month: "long", year: "numeric" });

export default async function MovesPage() {
  const moves = await getTransactions();
  if (!moves.length) return <Empty>No roster moves loaded yet.</Empty>;
  const known = await getKnownPlayerIds(moves.flatMap((m) => (m.playerId ? [m.playerId] : [])));
  const months = new Map<string, typeof moves>();
  for (const m of moves) months.set(MONTH(m.date), [...(months.get(MONTH(m.date)) ?? []), m]);
  const fromSharks = moves.filter((m) => /San Jose \(NHL\)/.test(m.description));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">Roster moves</h1>
        <p className="text-sm text-muted">
          {moves.length} this season, {fromSharks.length} with the Sharks
        </p>
      </div>
      {[...months.entries()].map(([month, list]) => (
        <Card key={month} title={month}>
          <ul className="divide-y divide-line text-sm">
            {list.map((m) => (
              <li key={`${m.date}${m.playerName}${m.description}`} className="flex items-baseline gap-3 py-1.5">
                <span className="w-14 shrink-0 text-xs text-muted tabular">{fmtYmd(m.date, { month: "short", day: "numeric" })}</span>
                <span className={`w-4 shrink-0 text-center font-semibold ${m.kind === "ADD" ? "text-win" : "text-loss"}`} title={m.kind === "ADD" ? "Joined" : "Left"}>
                  {m.kind === "ADD" ? "+" : "−"}
                </span>
                <span className="min-w-0 flex-1">
                  {m.playerId && known.has(m.playerId) ? (
                    <Link href={`/players/${m.playerId}`} className="font-medium hover:underline">
                      {m.playerName}
                    </Link>
                  ) : (
                    <span className="font-medium">{m.playerName}</span>
                  )}
                  {m.position && <span className="ml-1 text-xs text-muted">{m.position}</span>}
                  <span className="block text-xs text-muted sm:ml-2 sm:inline">{m.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
