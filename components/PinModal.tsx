"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { verifyPin } from "@/app/actions";

type Props = {
    onUnlocked: (pin: string) => void;
    onClose: () => void;
};

export default function PinModal({ onUnlocked, onClose }: Props) {

    const [value, setValue] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const pin = value.trim();
        if (!pin) return;
        setError(null);
        startTransition(async () => {
            const ok = await verifyPin(pin);
            if (ok) onUnlocked(pin);
            else setError("That's not the PIN man.");
        });
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onClick={onClose}
        >
            <form
                onSubmit={submit}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-2xl border-[6px] border-felt bg-paper p-5 text-stone-900 shadow-xl"
            >
                <div className="mb-3 flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    <h2 className="font-display text-2xl">Enter the org room PIN</h2>
                </div>

                <p>
                    This is either given na or posted within the room. Just ask for it and remember pls ty.
                </p>

                <input 
                    autoFocus
                    type="password"
                    inputMode="text"
                    autoComplete="off"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-base outline-none focus:ring-2 focus:ring-felt"
                    placeholder="PIN"
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
                        disabled={pending || !value.trim()}
                        className="flex-1 rounded-lg bg-felt px-4 py-3 font-semibold text-white disabled:opacity-50"
                    >
                        {pending ? "Checking..." : "Unlock"}
                    </button>
                </div>
            </form>

        </div>
    );
}