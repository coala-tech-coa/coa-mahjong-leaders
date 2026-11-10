"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "coalachinesetongits"

export function usePin() {

    const [pin, setPin] = useState<string | null>(null);

    useEffect(() => {
        try {
            setPin(localStorage.getItem(KEY));
        } catch {

        }
    }, []);

    const save = useCallback((value: string) => {
        try {
            localStorage.setItem(KEY, value);
        } catch {}
        setPin(value);
    }, []);

    const clear = useCallback(() => {
        try {
            localStorage.removeItem(KEY);
        } catch {}
        setPin(null);
    }, []);

    return { pin, save, clear };

}