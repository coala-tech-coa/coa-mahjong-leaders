import { Suspense } from "react";
import { getLeaderboard } from "./actions";
import Leaderboard from "@/components/Leaderboard";

async function LeaderboardData() {
  const { players, usingFallback } = await getLeaderboard();
  return <Leaderboard players={players} usingFallback={usingFallback} />;
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pb-10 pt-8">
      <header className="mb-6 text-center">
        <p className="text-4xl" aria-hidden>🀄</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">COALA&apos;s Mahjong Leaders</h1>
        <p className="text-sm text-emerald-200/80">Leaderboard of most wins</p>
      </header>

      <Suspense fallback={<p className="text-center text-emerald-200/80">Loading leaderboard…</p>}>
        <LeaderboardData />
      </Suspense>
    </main>
  );
}
