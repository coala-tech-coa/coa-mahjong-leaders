"use client";

import {
    useEffect,
    useMemo,
    useOptimistic,
    useRef,
    useState,
    useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Lock, Minus, Plus, Search, UserPlus } from "lucide-react";
import { addNewPlayer, updatePlayerScore } from "@/app/actions";
import type { ActionResult, Player } from "@/lib/types";
import { usePin } from "@/lib/usePin";
import PinModal from "./PinModal";
import AddPlayerDialog from "./AddPlayerDialog";
import ConfirmModal from "./ConfirmModal";


type Op =
    | { type: "delta"; name: string; delta: number }
    | { type: "add"; name: string, wins: number };

type Ranked = Player & { rank: number };

function reducer(state: Player[], op: Op): Player[] {
    if (op.type === "delta") {
        return state.map((p) =>
            p.name === op.name ? { ...p, wins: Math.max(0, p.wins + op.delta) } : p
        );
    }
    return [...state, { name: op.name, wins: op.wins }];
}

function rankPlayers(list: Player[]): Ranked[] {
    const sorted = [...list].sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
    let rank = 0;
    return sorted.map((p, i) => {
        if (i === 0 || p.wins !== sorted[i - 1].wins) {
            rank = i + 1;
        }
        return { ...p, rank };
    });
}

const BADGE: Record<number, string> = {
    1: "bg-gold text-yellow-950",
    2: "bg-silver text-slate-900",
    3: "bg-bronze text-white",
};

const CARD: Record<number, string> = {
    1: "border-[9px] border-gold",
    2: "border-[9px] border-silver-edge",
    3: "border-[9px] border-bronze",
};

const CARD_DEFAULT = "border-b-4 border-stone-400 px-[calc(0.75rem+9px)]";
const BADGE_DEFAULT = "bg-stone-200 text-stone-700 ring-2 ring-stone-300"


export default function Leaderboard({
    players,
    usingFallback,
}: {
    players: Player[];
    usingFallback: boolean;
}) {

    const router = useRouter();
    const { pin, save, clear } = usePin();

    const [query, setQuery] = useState("");
    const [showPin, setShowPin] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<{
        message: string;
        confirmLabel: string;
        danger?: boolean;
        onConfirm: () => void;
    } | null>(null);

    const pendingRef = useRef<((pin: string) => void) | null>(null);

    const [optimisticPlayers, applyOptimistic] = useOptimistic(players, reducer);
    const [, startTransition] = useTransition();

    useEffect(() => {
        const id = setInterval(() => {
            if (document.visibilityState === "visible") router.refresh();
        }, 30_000);
        return () => clearInterval(id);
    }, [router]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [toast]);

    const ranked = useMemo(() => rankPlayers(optimisticPlayers), [optimisticPlayers]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? ranked.filter((p) => p.name.toLowerCase().includes(q)) : ranked;
    }, [ranked, query]);

    function withPin(run: (pin: string) => void) {
        if (pin) {
            run(pin);
        } else {
            pendingRef.current = run;
            setShowPin(true);
        }
    }

    function handleResult(res: ActionResult) {
        if (res.ok) return;
        setToast(res.error);
        if (res.code === "BAD_PIN") {
            clear();
            setShowPin(true);
        }
    }

    function requestChange(name: string, delta: 1 | -1) {
        setConfirm({
            message: delta === 1 ? `Add a win to ${name}?` : `Remove a win from ${name}?`,
            confirmLabel: delta === 1 ? "Yes, add" : "Yes, remove",
            danger: delta === -1,
            onConfirm: () => changeScore(name, delta),
        });
    }

    function requestAdd(name: string, wins: number) {
        setConfirm({
            message: `Add ${name} to the board with ${wins} ${wins === 1 ? "win" : "wins"}?`,
            confirmLabel: "Yes, add player",
            onConfirm: () => addPlayer(name, wins),
        });
    }

    function changeScore(name: string, delta: 1 | -1) {
        withPin((p) => {
            startTransition(async () => {
                applyOptimistic({ type: "delta", name, delta });
                handleResult(await updatePlayerScore(name, delta, p));
            });
        });
    }

    function addPlayer(name: string, wins: number) {
        setShowAdd(false);
        withPin((p) => {
            startTransition(async () => {
                applyOptimistic({ type: "add", name, wins });
                handleResult(await addNewPlayer(name, wins, p));
            });
        });
    }

    return (
        <section>
            {usingFallback && (
                <div className="mb-4 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
                    Showing offline whiteboard data. Score changes won&apos;t be saved until the sheet is connected.
                </div>
            )}

            <div className="mb-4 flex gap-2">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search players"
                        className="w-full rounded-xl bg-paper py-3 pl-9 pr-3 text-base text-stone-900 outline-none focus:ring-2 focus:ring-gold"
                    />
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-gold px-4 font-semibold text-yellow-950 active:scale-95"
                >
                    <UserPlus className="h-5 w-5" />
                    <span className="hidden sm:inline">Add</span>
                </button>
            </div>

            <ul className="space-y-2">
                {visible.map((p) => (
                    <li
                        key={p.name}
                        className={`flex items-center gap-3 rounded-2xl bg-paper px-3 py-2.5 text-stone-900 shadow ${CARD[p.rank] ?? CARD_DEFAULT
                            }`}
                    >
                        <span
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold ${BADGE[p.rank] ?? BADGE_DEFAULT
                                }`}
                            aria-label={`Rank ${p.rank}`}
                        >
                            {p.rank}
                        </span>

                        <span className="min-w-0 flex-1 truncate font-display text-2xl">{p.name}</span>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => requestChange(p.name, -1)}
                                disabled={p.wins <= 0}
                                aria-label={`Remove a win from ${p.name}`}
                                className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-200 text-red-800 active:scale-90 disabled:opacity-30"
                            >
                                <Minus className="h-5 w-5" />
                            </button>

                            <span className="w-10 text-center font-display text-2xl tabular-nums">
                                {p.wins}
                            </span>

                            <button
                                onClick={() => requestChange(p.name, 1)}
                                aria-label={`Add a win to ${p.name}`}
                                className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-700 text-white active:scale-90"
                            >
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>
                    </li>
                ))}

                {visible.length === 0 && (
                    <li className="rounded-xl bg-black/20 px-4 py-6 text-center text-emerald-100">
                        No players match the &quot;{query}&quot;. Tap Add to register!
                    </li>
                )}
            </ul>

            {pin && (
                <button
                    onClick={clear}
                    className="mx-auto mt-6 flex items-center gap-1.5 text-xs text-emerald-200/70 underline-offset-2 hover:underline"
                >
                    <Lock className="h-3.5 w-3.5" /> Lock this device
                </button>
            )}

            {showPin && (
                <PinModal
                    onClose={() => {
                        pendingRef.current = null;
                        setShowPin(false);
                    }}
                    onUnlocked={(p) => {
                        save(p);
                        setShowPin(false);
                        const run = pendingRef.current;
                        pendingRef.current = null;
                        run?.(p);
                    }}
                />
            )}

            {showAdd && (
                <AddPlayerDialog
                    existingNames={optimisticPlayers.map((p) => p.name)}
                    onSubmit={requestAdd}
                    onClose={() => setShowAdd(false)}
                />
            )}

            {confirm && (
                <ConfirmModal 
                    message={confirm.message}
                    confirmLabel={confirm.confirmLabel}
                    danger={confirm.danger}
                    onClose={() => setConfirm(null)}
                    onConfirm={() => {
                        const run = confirm.onConfirm;
                        setConfirm(null);
                        run();
                    }}
                />
            )}

            {toast && (
                <div
                    role="status"
                    className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-sm rounded-xl bg-red-700 px-4 py-3 text-center text-sm text-white shadow-lg"
                >
                    {toast}
                </div>
            )}
        </section>
    );
}