# Gym Quest

A roguelike deck-builder that's actually your workout tracker. Mobile-first, offline PWA (React + TypeScript + Vite, IndexedDB via Dexie). No accounts, no backend: all data stays on your device.

## Status: all 7 milestones built

- [x] 1. Project setup, exercise database (42 exercises), offline storage, fast set logging
- [x] 2. Epley estimates, baselines, damage math, fatigue meters + lockout, pixel-art UI
- [x] 3. Fights: enemies, telegraphed intents, rest-window attacks, rest cards, warm-ups
- [x] 4. Full runs: branching map, coverage-aware enemies, campfire/treasure, run drops, run summary
- [x] 5. Bosses: readiness formula, safety cap, weak-point armor, ratio learning
- [x] 6. Nemesis system, modifiers with safety whitelist, keep-one + deck cap, card mastery
- [x] 7. Onboarding + Training Grounds, character tracker, sounds/haptics, PWA install + offline

## Look and feel

Every screen fits a phone without scrolling (checked down to 375×667). Fights happen on an animated battle stage: torch-lit dungeon backdrop with drifting fog and particles, a hero who lunges and slashes, enemies that breathe, float, flinch, lunge and dissolve, damage numbers, crit shake and HP bars that drain. Your hand fans out along the bottom: drag a card up to play it, or tap to inspect, swap or discard.

## How a quest works

1. **Onboarding** picks your equipment and starter deck. Your first quest is the **Training Grounds**: dummies that never hit back, so the game learns your baselines.
2. Each later gym session is a **quest**: pick a path up a branching map of fights, a treasure, a campfire, sometimes a nemesis, and a boss.
3. **Fights**: enemies are weak to the muscles you still need to train. Tap a card, do the real set, log it (2 taps) and it strikes. Damage = 100 × this set's volume ÷ your recent typical set (PR = ×2 crit).
4. **Rest** after every set. Play one rest card (shield, heal, regen, counter, read intent, water, breathing). Enemies telegraph their next move; an **attack** only lands if you rest past the window + 60 s grace.
5. **Fatigue**: each muscle has a meter (sets today + decaying carryover). At the cap a card locks, so you never grind junk volume.
6. **Boss**: its armor only breaks to the matching barbell lift at your weak-point target (from the readiness formula, capped at +10% / +5% over your last real lift). Accessories deal 25%. Fail and it escapes to return later as a **nemesis**.
7. **End of quest**: keep one dropped card forever (deck cap 12). Cards level up with your estimated 1RM.

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

### Install on your phone (offline)

Run `npm run build` then `npm run preview`, open the `Network:` address on your phone, and use the browser's **Add to Home Screen**. After one visit the app works with no signal. (Installing and the offline service worker need either `localhost` or HTTPS; on a LAN address over plain HTTP the app still works but the browser may not offer install. Hosting `dist/` on any HTTPS static host, e.g. GitHub Pages or Netlify, gives you the full installable app.)

## Run it inside Claude

Gym Quest is published as a Claude artifact: https://claude.ai/artifact/WEaaE5UmEGPRc1kuNjGjkC

That version saves your workouts to your Claude account (private to you), so it works on any device where you are signed in to Claude. Rebuild it with `npm run build:artifact`, which writes the single-file page to `artifact/gym-quest.html`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server, reachable on your LAN |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Typecheck + production build to `dist/` (with offline service worker) |
| `npm run preview` | Serve the production build on your LAN (port 4173) |
| `npm run build:artifact` | Build the single-file Claude artifact page |

## Where things live

- `src/config.ts`: **every tunable number** (target zones, fatigue cap, rest windows, damage clamps, boss ratios…)
- `src/data/exercises.ts`: exercise database with muscles, equipment and safety whitelists
- `src/logic/`: pure training math (damage, fatigue, readiness, mastery, modifiers), unit tested
- `src/logic/run/`: map, enemies, combat, rewards and run flow, unit tested
- `src/db/quest.ts`: applies the run rules to stored sessions (fights, rewards, bosses, nemeses)
- `src/db/`: IndexedDB schema and data access
- `src/ui/`: React screens and components; `src/ui/art/` holds every pixel sprite as a text grid
- `src/ui/scene/`: animated backgrounds, particles and the battle stage; `src/ui/hand/`: the draggable card hand
