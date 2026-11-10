export type Player = {
    name: string;
    wins: number;
    lastUpdated?: string | null;
};

export type ActionResult = 
    | { ok: true }
    | { ok: false; error: string; code?: "BAD_PIN" };
