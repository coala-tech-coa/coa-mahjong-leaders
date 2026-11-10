"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";

type Props = {
    existingNames: string[];
    onSubmit: (name: string, wins: number) => void;
    onClose: () => void;
};


export default function AddPlayerDialog({ existingNames, onSubmit, onClose }: Props) {

    const [name, setName] = useState("");
    const [wins, setWins] = useState(1);
    const [error, setError] = useState<string | null>(null);

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const clean = name.trim();
        if (!clean) return setError("Enter a name.");
        if (clean.length > 30) return setError("Keep it under 30 characters.");
        if (existingNames.some((n) => n.toLowerCase() === clean.toLowerCase())) {
            return setError("Someone with that name is already on this board.");
        }
        if (!Number.isInteger(wins) || wins < 1 || wins > 99) {
            return setError("Wins must be a whole number from 1 to 99.");
        }
        onSubmit(clean, wins);
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onClick={onClose}
        >
            <form
                onSubmit={submit}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-2xl bg-[#f6f1e3] p-5 text-stone-900 shadow-xl"              
            >
                <div className="mb-3 flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    <h2 className="text-lg font-bold">Add a New Player</h2>
                </div>

                <label className="mb-1 block text-sm font-medium">Name</label>
                <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={30}
                    className="mb-3 w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-base outline-none focus:ring-2 focus:ring-emerald-600"
                    placeholder="e.g. Coala / Coala Pogi"
                />

                <label className="mb-1 block text-sm font-medium">Starting wins</label>
                <input
                    type="number"
                    min={1}
                    max={99}
                    value={wins}
                    onChange={(e) => setWins(Number(e.target.value))}
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-base outline-none focus:ring-2 focus:ring-emerald-600"
                />

                {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

                <div className="mt-4 flex gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-stone-300 px-4 py-3 font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white"
                    >
                        Add player
                    </button>
                </div>
            </form>
        </div>
    );
}