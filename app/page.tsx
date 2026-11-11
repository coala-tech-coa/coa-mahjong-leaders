import { Suspense } from "react";
import { getLeaderboard } from "./actions";
import Leaderboard from "@/components/Leaderboard";

async function LeaderboardData() {
  const { players, usingFallback } = await getLeaderboard();
  return <Leaderboard players={players} usingFallback={usingFallback} />;
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pb-10 pt-5">
      <header className="mb-5 text-center">
        <p className="text-4xl" aria-hidden>🀄</p>
        <h1 className="mt-1.5 font-display text-3xl leading-tight text-white">COALA&apos;s Mahjong Leaders</h1>
        <p className="mt-1.5 text-lg text-mint">Leaderboard of most wins</p>
        <p className="mt-1 text-xs text-mint/90">Passion Project by Hanzo Castillo (OVPCC - Docus, BS CS, ExTeams 2627)</p>
      </header>

      <Suspense fallback={<p className="text-center text-emerald-200/80">Loading leaderboard…</p>}>
        <LeaderboardData />
      </Suspense>
    </main>
  );
}
