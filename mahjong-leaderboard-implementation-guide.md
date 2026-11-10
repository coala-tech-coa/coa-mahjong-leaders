# Org Room Mahjong Leaderboard: Implementation Guide

Follow the phases in order. By the end you'll have a live site on Vercel, backed by a Google Sheet, with a QR code on the wall.

**Architecture in one line:** phone scans QR → Next.js page on Vercel → Server Actions → Google Apps Script web app → Google Sheet.

**Total cost:** $0, no credit card.

---

## Phase 0: Prerequisites

- Node.js **20.9 or newer** (`node -v` to check)
- A GitHub account (Vercel deploys from GitHub)
- A Google account
- A Vercel account (sign up with GitHub, Hobby plan)

---

## Phase 1: Google Sheet + Apps Script backend

Do the backend first so you have a URL to plug into the app.

### 1.1 Create the sheet

Create a new Google Sheet named `Org Mahjong Leaderboard` with **two tabs**. The tab names must match exactly.

**Tab `Leaderboard`**: paste this into cell A1 (tab-separated, so it fills columns A and B):

```
Name	Wins	LastUpdated
Zyle	8
Cian	4
TJ	4
Hanzo	3
Ramon	3
Nico	3
Gab	3
Kar	2
Tim	2
Daryl	1
Aye	1
Kai	1
Ven	1
Pao	1
Ianna	1
Seann	1
CD	1
Bea	1
```

**Tab `Audit_Logs`**: type these headers in row 1:

```
Timestamp	Action	PlayerName	Delta	NewScore
```

### 1.2 Add the script

1. In the sheet: **Extensions → Apps Script**.
2. Replace everything in `Code.gs` with the script from your spec, **with one fix** (see below).
3. Save.

**Fix to apply:** in `doPost`, change

```javascript
lock.tryLock(10000);
```

to

```javascript
lock.waitLock(10000);
```

`tryLock` returns `false` on failure and keeps going. `waitLock` throws, so the `catch` block handles it and two people can't write at the same time. Everything else in the spec's script can stay as is.

### 1.3 Deploy as a web app

1. **Deploy → New deployment → gear icon → Web app**
2. **Execute as:** Me
3. **Who has access:** Anyone
4. **Deploy**, then authorize when prompted. Google will show an "unverified app" screen: **Advanced → Go to (project name) → Allow**. This is normal for your own script.
5. Copy the **Web app URL** (ends in `/exec`).

### 1.4 Test it

Open the `/exec` URL in a browser. You should see JSON like `{"status":"success","data":[{"name":"Zyle","wins":8,...}]}`.

> **Important:** whenever you edit the script later, you must publish it: **Deploy → Manage deployments → ✏️ edit → Version: New version → Deploy**. The URL stays the same. Saving alone does not update the live web app.

> Treat the `/exec` URL as a secret. Anyone with it can read and write your sheet, because access is "Anyone". It stays server-side in this app, which is why we call it only from Server Actions.

---

## Phase 2: Create the Next.js project

```bash
npx create-next-app@latest mahjong-leaderboard
```

Answer the prompts:

| Prompt | Answer |
|---|---|
| TypeScript | Yes |
| Linter | ESLint |
| Tailwind CSS | Yes |
| `src/` directory | **No** (the paths below assume no `src/`) |
| App Router | Yes |
| Turbopack | Default is fine |
| Import alias | `@/*` |

Then:

```bash
cd mahjong-leaderboard
npm install lucide-react
```

Create the folders and files we'll fill in:

```bash
mkdir components lib
```

### Final file layout

```
mahjong-leaderboard/
├── app/
│   ├── actions.ts          (new)
│   ├── globals.css         (replace)
│   ├── layout.tsx          (replace)
│   └── page.tsx            (replace)
├── components/
│   ├── Leaderboard.tsx     (new)
│   ├── PinModal.tsx        (new)
│   └── AddPlayerDialog.tsx (new)
├── lib/
│   ├── seed.ts             (new)
│   ├── types.ts            (new)
│   └── usePin.ts           (new)
└── .env.local              (new, never commit)
```

---

## Phase 3: Environment variables

Create `.env.local` in the project root:

```env
GOOGLE_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
ORG_PIN="pick-something-your-org-will-remember"
```

`create-next-app` already git-ignores `.env*` files. Check with `git status` that `.env.local` is not listed.

Neither variable has a `NEXT_PUBLIC_` prefix, so they are never sent to the browser.

---

## Phase 4: The code

### 4.1 `lib/types.ts`

```ts
export type Player = {
  name: string;
  wins: number;
  lastUpdated?: string | null;
};

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; code?: "BAD_PIN" };
```

### 4.2 `lib/seed.ts`

```ts
import type { Player } from "./types";

// Fallback data copied from the org room whiteboard.
export const SEED_PLAYERS: Player[] = [
  { name: "Zyle", wins: 8 },
  { name: "Cian", wins: 4 },
  { name: "TJ", wins: 4 },
  { name: "Hanzo", wins: 3 },
  { name: "Ramon", wins: 3 },
  { name: "Nico", wins: 3 },
  { name: "Gab", wins: 3 },
  { name: "Kar", wins: 2 },
  { name: "Tim", wins: 2 },
  { name: "Daryl", wins: 1 },
  { name: "Aye", wins: 1 },
  { name: "Kai", wins: 1 },
  { name: "Ven", wins: 1 },
  { name: "Pao", wins: 1 },
  { name: "Ianna", wins: 1 },
  { name: "Seann", wins: 1 },
  { name: "CD", wins: 1 },
  { name: "Bea", wins: 1 },
];
```

### 4.3 `lib/usePin.ts`

Stores the PIN in `localStorage` so people only type it once per device.

```ts
"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "mahjong-org-pin";

export function usePin() {
  const [pin, setPin] = useState<string | null>(null);

  useEffect(() => {
    try {
      setPin(localStorage.getItem(KEY));
    } catch {
      /* storage blocked: user will just be prompted each time */
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
```

### 4.4 `app/actions.ts`

Note: a `"use server"` file may only export async functions, which is why types and seed data live in `lib/`.

```ts
"use server";

import { revalidatePath } from "next/cache";
import { SEED_PLAYERS } from "@/lib/seed";
import type { ActionResult, Player } from "@/lib/types";

const sortPlayers = (list: Player[]) =>
  [...list].sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));

function pinOk(pin: unknown): boolean {
  const expected = process.env.ORG_PIN;
  return !!expected && typeof pin === "string" && pin === expected;
}

const BAD_PIN: ActionResult = {
  ok: false,
  error: "Wrong PIN. Check the one in the org room.",
  code: "BAD_PIN",
};

/** Read the leaderboard. Falls back to whiteboard data if the sheet isn't configured or reachable. */
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
    console.error("getLeaderboard failed:", err);
    return { players: sortPlayers(SEED_PLAYERS), usingFallback: true };
  }
}

async function callScript(payload: Record<string, unknown>): Promise<ActionResult> {
  const url = process.env.GOOGLE_SCRIPT_URL;
  if (!url) {
    return { ok: false, error: "Backend isn't configured yet (GOOGLE_SCRIPT_URL missing)." };
  }

  try {
    // text/plain avoids any preflight weirdness; Apps Script reads e.postData.contents either way.
    // Apps Script answers POSTs with a redirect; fetch follows it by default.
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      cache: "no-store",
      redirect: "follow",
    });
    const json = await res.json();
    if (json.status !== "success") {
      return { ok: false, error: json.message ?? "The sheet rejected that update." };
    }
    return { ok: true };
  } catch (err) {
    console.error("callScript failed:", err);
    return { ok: false, error: "Couldn't reach the scoreboard. Try again in a moment." };
  }
}

/** Lets the PIN modal validate a PIN up front, so a typo is caught before the first score tap. */
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
  if (delta !== 1 && delta !== -1) return { ok: false, error: "Invalid score change." };

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
```

> **Spec deviation:** `getLeaderboard()` returns `{ players, usingFallback }` instead of a bare array, so the UI can show a "showing offline data" banner and nobody taps `+1` thinking it saved.

### 4.5 `app/layout.tsx`

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Org Room Mahjong Leaderboard",
  description: "Who's winning in the org room? Scan, tap, brag.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b3d2e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-stone-100 antialiased">{children}</body>
    </html>
  );
}
```

### 4.6 `app/globals.css`

Replace the whole file but **keep the first line that `create-next-app` generated** (on current versions it's `@import "tailwindcss";`; on older Tailwind v3 setups it's three `@tailwind` lines). Then add:

```css
@import "tailwindcss";

/* Green felt table */
body {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background-color: #0b3d2e;
  background-image:
    radial-gradient(ellipse at top, rgba(255, 255, 255, 0.08), transparent 60%),
    repeating-linear-gradient(45deg, rgba(0, 0, 0, 0.05) 0 2px, transparent 2px 4px);
  background-attachment: fixed;
}
```

### 4.7 `app/page.tsx`

```tsx
import { getLeaderboard } from "./actions";
import Leaderboard from "@/components/Leaderboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { players, usingFallback } = await getLeaderboard();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pb-10 pt-8">
      <header className="mb-6 text-center">
        <p className="text-4xl" aria-hidden>🀄</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Org Room Mahjong</h1>
        <p className="text-sm text-emerald-200/80">Leaderboard · most wins</p>
      </header>

      <Leaderboard players={players} usingFallback={usingFallback} />

      <footer className="mt-10 text-center text-xs text-emerald-200/60">
        Bea was here! 🍪👻
      </footer>
    </main>
  );
}
```

### 4.8 `components/PinModal.tsx`

```tsx
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
      else setError("That's not the org room PIN.");
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
        className="w-full max-w-sm rounded-2xl bg-[#f6f1e3] p-5 text-stone-900 shadow-xl"
      >
        <div className="mb-3 flex items-center gap-2">
          <Lock className="h-5 w-5" />
          <h2 className="text-lg font-bold">Enter the org room PIN</h2>
        </div>
        <p className="mb-3 text-sm text-stone-600">
          It's posted in the room. You only need to enter it once on this device.
        </p>
        <input
          autoFocus
          type="password"
          inputMode="text"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-base outline-none focus:ring-2 focus:ring-emerald-600"
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
            className="flex-1 rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Checking…" : "Unlock"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

### 4.9 `components/AddPlayerDialog.tsx`

```tsx
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
      return setError("Someone with that name is already on the board.");
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
          <h2 className="text-lg font-bold">Add a new player</h2>
        </div>

        <label className="mb-1 block text-sm font-medium">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          className="mb-3 w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-base outline-none focus:ring-2 focus:ring-emerald-600"
          placeholder="e.g. Migs"
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
```

### 4.10 `components/Leaderboard.tsx`

This is the main piece. How the optimistic flow works:

1. `useOptimistic` holds a copy of the server's `players` list plus pending changes.
2. On tap, inside `startTransition`, we apply the change locally (instant), then `await` the Server Action.
3. When the action finishes, `revalidatePath('/')` makes Next send fresh server data, and the optimistic layer drops away.
4. If the action fails, the optimistic change disappears automatically and we show a toast.

Ranks use standard competition ranking: ties share a rank and the next rank skips (Zyle 1st, Cian and TJ both 2nd, Hanzo 4th). So the bronze badge only shows up when nobody is tied for 2nd.

```tsx
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

type Op =
  | { type: "delta"; name: string; delta: number }
  | { type: "add"; name: string; wins: number };

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
    if (i === 0 || p.wins !== sorted[i - 1].wins) rank = i + 1;
    return { ...p, rank };
  });
}

const BADGE: Record<number, string> = {
  1: "bg-yellow-400 text-yellow-950 ring-yellow-600",
  2: "bg-slate-300 text-slate-900 ring-slate-500",
  3: "bg-amber-600 text-amber-50 ring-amber-800",
};

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
  const pendingRef = useRef<((pin: string) => void) | null>(null);

  const [optimisticPlayers, applyOptimistic] = useOptimistic(players, reducer);
  const [, startTransition] = useTransition();

  // Keep the board fresh for people looking at it on their phones.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => clearInterval(id);
  }, [router]);

  // Auto-dismiss toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const ranked = useMemo(() => rankPlayers(optimisticPlayers), [optimisticPlayers]);

  // Filter AFTER ranking so a player's rank stays true while searching.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ranked.filter((p) => p.name.toLowerCase().includes(q)) : ranked;
  }, [ranked, query]);

  /** Run an action with the PIN, prompting for it first if we don't have one. */
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
      clear(); // stored PIN is stale (maybe the org changed it)
      setShowPin(true);
    }
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
          Showing offline whiteboard data. Score changes won't be saved until the sheet is connected.
        </div>
      )}

      {/* Search + add */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players"
            className="w-full rounded-xl bg-[#f6f1e3] py-3 pl-9 pr-3 text-base text-stone-900 outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-xl bg-yellow-400 px-4 font-semibold text-yellow-950 active:scale-95"
        >
          <UserPlus className="h-5 w-5" />
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>

      {/* List */}
      <ul className="space-y-2">
        {visible.map((p) => (
          <li
            key={p.name}
            className="flex items-center gap-3 rounded-xl border-b-4 border-stone-400 bg-[#f6f1e3] px-3 py-2.5 text-stone-900 shadow"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-2 ${
                BADGE[p.rank] ?? "bg-stone-200 text-stone-700 ring-stone-300"
              }`}
              aria-label={`Rank ${p.rank}`}
            >
              {p.rank}
            </span>

            <span className="min-w-0 flex-1 truncate text-lg font-semibold">{p.name}</span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => changeScore(p.name, -1)}
                disabled={p.wins <= 0}
                aria-label={`Remove a win from ${p.name}`}
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-stone-200 active:scale-90 disabled:opacity-30"
              >
                <Minus className="h-5 w-5" />
              </button>

              <span className="w-10 text-center text-2xl font-extrabold tabular-nums">
                {p.wins}
              </span>

              <button
                onClick={() => changeScore(p.name, 1)}
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
            No players match "{query}". Tap Add to register them!
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
            run?.(p); // finish the tap that triggered the prompt
          }}
        />
      )}

      {showAdd && (
        <AddPlayerDialog
          existingNames={optimisticPlayers.map((p) => p.name)}
          onSubmit={addPlayer}
          onClose={() => setShowAdd(false)}
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
```

---

## Phase 5: Run and test locally

```bash
npm run dev
```

Open http://localhost:3000. Check:

1. **Without `GOOGLE_SCRIPT_URL`** (comment it out): you see the 18 players and the amber "offline" banner.
2. **With it set**: no banner. Tap `+1` on someone: the score jumps instantly, and the sheet updates about a second later.
3. First tap prompts for the PIN. A wrong PIN shows an error. The right one unlocks and completes the tap you started.
4. Reload: PIN is remembered, so no prompt.
5. `-1` on someone at 0 is disabled.
6. Search "ti": only Tim shows, still with his true rank.
7. Add a player: they appear instantly, and a duplicate name (any capitalization) is blocked.
8. Check the **Audit_Logs** tab: every change should have a row.
9. Test on your phone with Chrome DevTools device mode, or open `http://<your-laptop-LAN-IP>:3000` on a phone on the same Wi-Fi. If you test on a real phone, you may need `allowedDevOrigins` in `next.config.ts` for the dev server.

Also run `npm run build` once before deploying to catch type or lint errors.

---

## Phase 6: Deploy to Vercel

1. Push to GitHub:
   ```bash
   git add .
   git commit -m "Mahjong leaderboard"
   git branch -M main
   git remote add origin https://github.com/<you>/mahjong-leaderboard.git
   git push -u origin main
   ```
2. On vercel.com: **Add New → Project → import the repo**.
3. Before clicking Deploy, open **Environment Variables** and add `GOOGLE_SCRIPT_URL` and `ORG_PIN` (same values as `.env.local`).
4. Deploy. Vercel gives you a URL like `mahjong-leaderboard.vercel.app`.
5. Open it on your phone and repeat the test checklist.

If you add or change env vars later, **redeploy** (Deployments → ⋯ → Redeploy) because they're read at build/start time.

---

## Phase 7: The QR code

1. In Vercel: **Settings → Domains** and pick a short, stable production URL (for example `org-mahjong.vercel.app`). Use the production URL, **not** a per-deployment preview URL, since previews change.
2. Generate the QR from that URL with any free generator (e.g. qr-code-generator.com or qrcode-monkey.com). Use a **static** QR, because "dynamic" ones often sit behind a paid plan and expire.
3. Print it at least 8 cm wide, high contrast (dark on light), with a short label like *"Scan to log a win 🀄"*. Tape the PIN nearby, or tell members in the group chat.
4. Test the printed code from across the room with two different phones.

Nice touch: on iPhone/Android, "Add to Home Screen" gives regulars a one-tap shortcut.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Amber "offline" banner on the live site | `GOOGLE_SCRIPT_URL` not set on Vercel, or you didn't redeploy after adding it |
| "Couldn't reach the scoreboard" | Wrong URL, or deployment access isn't "Anyone". Open the `/exec` URL in an incognito window; it should show JSON, not a login page |
| Script changes don't take effect | You saved but didn't publish a **New version** (Phase 1.4 note) |
| "Player not found" | Sheet tab isn't named `Leaderboard`, or the name has extra spaces |
| Error mentions `Cannot read properties of null` in the script | `Audit_Logs` / `Leaderboard` tab name typo |
| Wrong PIN even though it's right | Env var has stray quotes/spaces on Vercel, so paste it without quotes there |
| Slow first load (2–4 s) | Apps Script cold start; normal on the free tier |

---

## Known limits and optional hardening

- **PIN is shared and light protection.** It stops casual griefing, not a determined attacker. For a student org room that's the right tradeoff. Rotate `ORG_PIN` if it leaks. Everyone's stored PIN then clears itself on their next tap (the `BAD_PIN` handling).
- **No brute-force rate limiting.** If you ever care, add Vercel's free Edge Config/KV or a simple per-IP counter. Not needed for v1.
- **Undo history.** `Audit_Logs` gives you a full record, so a mistaken `+1` can be traced and fixed by hand in the sheet. The `-1` button is the in-app undo.
- **Apps Script quotas.** Free accounts allow far more executions per day than an org room will ever generate.
- **Backups.** Use **File → Version history** in Google Sheets if someone vandalizes the data.
