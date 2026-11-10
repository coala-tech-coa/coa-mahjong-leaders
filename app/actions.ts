"use server";

import { revalidatePath } from "next/cache";
import { SEED_PLAYERS } from "@/lib/seed";
import type { ActionResult, Player } from "@/lib/types";


const sortPlayers = (list: Player[]) => 
    [...list].sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));

function pinOk(pin: unknown): boolean {
    const expected = process.env.ORG_PIN;
    return !!expected && typeof pin === "string" && pin == expected;
}

const BAD_PIN: ActionResult = {
    ok: false,
    error: "Wrong PIN. Check the one provided or ask around the org room.",
    code: "BAD_PIN",
};

export async function getLeaderboard(): Promise<{
    players: Player[];
    usingFallback: boolean;
}> {
    const url = process.env.GOOGLE_SCRIPT_URL;
    if (!url) {
        return { players: sortPlayers(SEED_PLAYERS), usingFallback: true };
    }

    try {
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();
        if (json.status !== "success" || !Array.isArray(json.data)) {
            throw new Error("Bad response from script");
        }
        return { players: sortPlayers(json.data as Player[]), usingFallback: false };
    } catch (err) {
        console.error("getLeaderboard falied:", err);
        return { players: sortPlayers(SEED_PLAYERS), usingFallback: true };
    }
}

async function callScript(payload: Record<string, unknown>): Promise<ActionResult> {

    const url = process.env.GOOGLE_SCRIPT_URL;
    if (!url) {
        return { ok: false, error: "Backend is not configured. (GOOGLE_SCRIPT_URL missing." };
    }

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {"Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload),
            cache: "no-store",
            redirect: "follow",
        });
        const json = await res.json();
        if (json.status !== "success") {
            return { ok: false, error: json.message ?? "The sheet rejected that update."};
        }
        return { ok: true };
    } catch (err) {
        console.error("callScript failed:", err);
        return { ok: false, error: "Couldn't reach the scoreboard. Try again in a moment." };
    }
}

export async function verifyPin(pin: string): Promise<boolean> {
    return pinOk(pin);
}

export async function updatePlayerScore(
    name: string,
    delta: number,
    pin: string
): Promise<ActionResult> {
    if (!pinOk(pin)) return BAD_PIN;
    if (typeof name !== "string" || !name.trim()) return { ok: false, error: "Missing player name." };
    if (delta !== 1 && delta !== -1) return { ok: false, error: "Invalid score change" };

    const result = await callScript({ action: "UPDATE_SCORE", name, delta });
    if (result.ok) revalidatePath("/");
    return result;
}

export async function addNewPlayer(
    name: string,
    initialWins: number,
    pin: string
): Promise<ActionResult> {
    if (!pinOk(pin)) return BAD_PIN;

    const clean = typeof name === "string" ? name.trim() : "";
    if (clean.length < 1 || clean.length > 30) {
        return { ok: false, error: "Name must be 1 to 30 characters." };
    }
    if (!Number.isInteger(initialWins) || initialWins < 1 || initialWins > 99) {
        return { ok: false, error: "Starting wins must be a whole number from 1 to 99." };
    }

    const result = await callScript({ action: "ADD_PLAYER", name: clean, delta: initialWins });
    if (result.ok) revalidatePath("/");
    return result;
}

