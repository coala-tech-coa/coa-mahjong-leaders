"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

type Props = {
    title?: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onClose: () => void;
};

export default function ConfirmModal({
    title = "Are you sure?",
    message,
    confirmLabel = "Yes",
    danger = false,
    onConfirm,
    onClose,
}: Props) {

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onClick={onClose}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-2xl border-[6px] border-felt bg-paper p-5 text-stone-900 shadow-xl"
            >
                <div className="mb-3 flex items-center gap-2">
                    <TriangleAlert className="h-5 w-5"/>
                    <h2 id="confirm-title" className="font-display text-2xl">{title}</h2>
                </div>

                <p className="mb-4 text-stone-700">{message}</p>

                <div className="flex gap-2">
                    <button
                        type="button"
                        autoFocus
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-stone-300 px-4 py-3 font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`flex-1 rounded-lg px-4 py-3 font-semibold text-white ${
                            danger ? "bg-red-700" : "bg-felt"
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>            
            </div>
        </div>
    );
}