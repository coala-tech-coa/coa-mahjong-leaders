# Project Specification: Org Room Mahjong Leaderboard

## 1. Context & Objective
We are replacing a physical whiteboard Mahjong leaderboard in our student organization room with a mobile-friendly web application hosted on **Vercel (Next.js)**. Because this is a student project, the entire stack must cost **$0 (100% free tier)** with no credit card required and no database pausing issues.

To achieve a zero-maintenance, $0 backend, we are using **Google Sheets + Google Apps Script (Web App Webhook)** as our database, connected to a **Next.js (App Router)** frontend via Server Actions.

---

## 2. Tech Stack & Architecture
* **Frontend Framework:** Next.js (App Router, TypeScript, Tailwind CSS, Lucide Icons)
* **Hosting:** Vercel (Hobby / Free Tier)
* **Database:** Google Sheets (2 Tabs: `Leaderboard` and `Audit_Logs`)
* **Backend API Bridge:** Google Apps Script deployed as a Web App (`doGet` and `doPost` webhook)
* **Security / Anti-Griefing:** Simple Org Room PIN validation via Next.js Server Actions (compared against `process.env.ORG_PIN`).
* **UX Requirement:** Must use **Optimistic UI updates** (`useOptimistic` or local React state) so `+1` / `-1` score updates feel instant despite Google Sheets' ~1-second latency.

---

## 3. Initial Seed Data (From Org Room Whiteboard)
Use this exact dataset to pre-populate the Google Sheet and as fallback/mock data in the Next.js app:

| Name | Wins |
| :--- | :--- |
| Zyle | 8 |
| Cian | 4 |
| TJ | 4 |
| Hanzo | 3 |
| Ramon | 3 |
| Nico | 3 |
| Gab | 3 |
| Kar | 2 |
| Tim | 2 |
| Daryl | 1 |
| Aye | 1 |
| Kai | 1 |
| Ven | 1 |
| Pao | 1 |
| Ianna | 1 |
| Seann | 1 |
| CD | 1 |
| Bea | 1 |

---

## 4. Google Sheets & Apps Script Setup (Backend Reference)

### Sheet Structure
Create a Google Sheet with two tabs:
1. **`Leaderboard`**: Column A = `Name`, Column B = `Wins`, Column C = `LastUpdated`
2. **`Audit_Logs`**: Column A = `Timestamp`, Column B = `Action`, Column C = `PlayerName`, Column D = `Delta`, Column E = `NewScore`

### Google Apps Script (`Code.gs`)
Paste this into **Extensions > Apps Script** in the Google Sheet and deploy as a **Web App** (Execute as: *Me*, Who has access: *Anyone*).

```javascript
const SHEET_LEADERBOARD = "Leaderboard";
const SHEET_LOGS = "Audit_Logs";

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_LEADERBOARD);
  const rows = sheet.getDataRange().getValues();
  
  // Remove header row
  const headers = rows.shift();
  
  const players = rows
    .filter(row => row[0] !== "")
    .map(row => ({
      name: String(row[0]).trim(),
      wins: Number(row[1]) || 0,
      lastUpdated: row[2] || null
    }))
    .sort((a, b) => b.wins - a.wins);

  return ContentService
    .createTextOutput(JSON.stringify({ status: "success", data: players }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000); // Prevent race conditions if two people update at once

  try {
    const body = JSON.parse(e.postData.contents);
    const { action, name, delta } = body;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_LEADERBOARD);
    const logSheet = ss.getSheetByName(SHEET_LOGS);
    const data = sheet.getDataRange().getValues();
    const now = new Date().toISOString();

    if (action === "UPDATE_SCORE") {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).toLowerCase() === String(name).toLowerCase()) {
          const currentWins = Number(data[i][1]) || 0;
          const newWins = Math.max(0, currentWins + Number(delta));
          sheet.getRange(i + 1, 2).setValue(newWins);
          sheet.getRange(i + 1, 3).setValue(now);

          if (logSheet) {
            logSheet.appendRow([now, "UPDATE_SCORE", data[i][0], delta, newWins]);
          }

          return jsonResponse({ status: "success", name: data[i][0], wins: newWins });
        }
      }
      return jsonResponse({ status: "error", message: "Player not found" });
    }

    if (action === "ADD_PLAYER") {
      const cleanName = String(name).trim();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).toLowerCase() === cleanName.toLowerCase()) {
          return jsonResponse({ status: "error", message: "Player already exists" });
        }
      }
      const initialWins = Number(delta) || 1;
      sheet.appendRow([cleanName, initialWins, now]);

      if (logSheet) {
        logSheet.appendRow([now, "ADD_PLAYER", cleanName, initialWins, initialWins]);
      }

      return jsonResponse({ status: "success", name: cleanName, wins: initialWins });
    }

    return jsonResponse({ status: "error", message: "Invalid action" });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

## 5. Environment Variables (`.env.local`)
```env
# The deployed Google Apps Script Web App URL
GOOGLE_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"

# Simple 4-digit or word PIN shared in the org room to prevent griefing
ORG_PIN="1234"
```

---

## 6. Instructions for Claude (Deliverables to Generate)
Please build the complete **Next.js (App Router) + TypeScript + Tailwind CSS** project with the following components and features:

1. **Server Actions (`app/actions.ts`):**
   * `getLeaderboard()`: Fetches the current rankings from `process.env.GOOGLE_SCRIPT_URL` (with `cache: 'no-store'`). Falls back to the 18 whiteboard players if `GOOGLE_SCRIPT_URL` is not configured yet.
   * `updatePlayerScore(name: string, delta: number, pin: string)`: Verifies `pin === process.env.ORG_PIN`, sends a POST request to `GOOGLE_SCRIPT_URL` with `{ action: "UPDATE_SCORE", name, delta }`, and calls `revalidatePath('/')`.
   * `addNewPlayer(name: string, initialWins: number, pin: string)`: Verifies `pin === process.env.ORG_PIN`, sends a POST request with `{ action: "ADD_PLAYER", name, delta: initialWins }`, and revalidates.

2. **Frontend UI (`app/page.tsx` & Client Components):**
   * **Aesthetic:** Mahjong / Org Room Whiteboard aesthetic (subtle green felt or clean modern tile motif, gold/silver/bronze badges for Top 3 players—currently Zyle #1, Cian & TJ tied at #2).
   * **Search & Filter:** Quick search bar to filter player names as the org room roster grows.
   * **Optimistic Score Updates:** Clicking `+1` (or `-1`) immediately updates the UI ranking and score while the Server Action executes in the background.
   * **PIN Unlock Session:** Prompt the user once for the Org Room PIN and save it in `localStorage` so org members don't have to re-type the PIN after every hand.
   * **Add Player Modal/Drawer:** Simple form to register a new orgmate when they win their first game.
   * **Whiteboard Easter Egg:** Include a tiny footer tribute to the original whiteboard ("Bea was here! 🍪👻").