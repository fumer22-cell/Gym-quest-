# Gym Quest

A roguelike deck-builder that's actually your workout tracker. Mobile-first, offline PWA (React + TypeScript + Vite, IndexedDB via Dexie). No accounts, no backend: all data stays on your device.

## Status: Milestone 1 of 7

- [x] Project setup, exercise database (42 exercises), offline storage, fast set logging (works as a plain tracker)
- [ ] Epley estimates, baselines, damage math, fatigue meters + lockout
- [ ] A single fight
- [ ] Full run (map, campfire/treasure, drops, summary)
- [ ] Bosses + readiness formula
- [ ] Nemesis, modifiers, keep-one + deck cap, card mastery
- [ ] Onboarding, character tracker, juice, PWA install + offline check

## Run it

Requires **Node.js 20.19+** (22 LTS recommended): https://nodejs.org

```bash
git clone https://github.com/fumer22-cell/Gym-quest-.git
cd Gym-quest-
npm install
npm run dev
```

Open http://localhost:5173 on your computer.

### On your phone

1. Connect the phone to the **same Wi-Fi** as the computer.
2. `npm run dev` prints a `Network:` line like `http://192.168.1.23:5173`. Open that address in the phone's browser.
3. If it doesn't load, allow Node through your computer's firewall (Windows shows a prompt the first time; click **Allow**).

Data is saved per address in each browser, so the phone keeps its own log. If your computer's IP changes, the phone will see an empty app at the new address. Use **Settings → Export backup** to move data. Installing to the home screen and real offline use (service worker over HTTPS) arrive in milestone 7.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server, reachable on your LAN |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build on your LAN (port 4173) |

## Where things live

- `src/config.ts`: **every tunable number** (target zones, fatigue cap, rest windows, damage clamps, boss ratios…)
- `src/data/exercises.ts`: exercise database with muscles, equipment and safety whitelists
- `src/logic/`: pure game/training logic (unit tested)
- `src/db/`: IndexedDB schema and data access
- `src/ui/`: React screens and components
