"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "coalachinesetongits"

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
    listeners.add(cb);
    window.addEventListener("storage", cb);
    return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", cb);
    };
}

function getSnapshot(): string | null {
    try {
        return localStorage.getItem(KEY);
    } catch {
        return null;
    }
}

const getServerSnapshot = () => null;

function notify() {
    listeners.forEach((cb) => cb());
}

export function usePin() {

    const pin = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const save = useCallback((value: string) => {
        try {
            localStorage.setItem(KEY, value);
        } catch {}
        notify();
    }, []);

    const clear = useCallback(() => {
        try {
            localStorage.removeItem(KEY);
        } catch {}
        notify();
    }, []);

    return { pin, save, clear };

}
