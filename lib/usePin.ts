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
    
}