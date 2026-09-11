**Four Kings** — Four-Player Chess Royale

<img width="2048" height="2048" alt="image" src="https://github.com/user-attachments/assets/ff86c862-fc6d-4c2f-a2b4-8f3184eb702c" />

A highly polished, browser-based four-player chess variant with multi-king support, advanced bots, hot-seat multiplayer, custom army editor, clocks, and special house rules.

**Live demo:** [https://fourplayerchess.vercel.app](https://fourplayerchess.vercel.app)

---

### Overview

This is a free-for-all (last empire standing) four-player chess game on a classic expanded board. It emphasizes chaotic multi-player tactics with a distinctive **multi-king** rule: you can place any number of kings per side. Losing *any* king (by capture or checkmate) immediately eliminates that entire army.

Players (or bots) take turns in clockwise order. The last surviving player wins.

**Colors / seats (turn order):**
- **Red** (bottom) → **Blue** (left) → **Amber** (top) → **Green** (right)

---

### Key Features

- **Multi-king variant** — Place as many kings per army. Any king loss wipes the whole team.
- **Hot-seat multiplayer** + **bots** — Play 4 humans, mix humans/bots, or pure Bot Royale (spectate).
- **Bot difficulties** — Casual (random legal moves) or Sharp (prefers captures).
- **Game clocks** — Optional per-player clocks (1–15+ min or custom). Flag fall eliminates the player.
- **Team Mode**: Split in two teams - ALPHA and OMEGA. Choose your teammates, fight each other until your team wins!
- **Points Increment Mode**: Gains more points by capturing opponent pieces, checking and checkmating kings. Outscore your opponents and win the game!
- **Army Forge (position editor)** — Fully custom setups. Place unlimited pieces of any type for any color. Right-click / eraser to remove. Load standard or clear board.
- **House rules**:
  - **Claim defeated armies (Commandeer)** — When you eliminate a player, you seize their remaining non-king pieces (kings are always removed). Off = leftover pieces become inert obstacles.
  - **King Hunt** — Kings can be captured like normal pieces; capturing one immediately eliminates the entire army (even if they have multiple kings).
- **Promotion** — Pawns auto-promote to Queen on the far rank (opposite side of the board).
- **No castling** (and no en passant in the current engine).
- Beautiful dark UI with Framer Motion animations, piece icons, move log, captured pieces, check highlighting, sounds, and turn indicators.
- Single-file build option (via `vite-plugin-singlefile`) for easy deployment.

---

### Board & Rules Summary

- **Board size**: 14×14 with the four 3×3 corner squares removed (standard modern 4-player chess geometry, ~160 playable squares).
- **Starting position** (standard): Classic back-rank + pawns on each of the four sides (R N B Q K B N R + 8 pawns), facing inward.
- **Piece movement**: Standard chess rules, adapted to the larger board and four directions.
  - Pawns move/capture forward relative to their facing direction (toward the center/opposite side) and can double-step from their starting rank.
- **Check / Checkmate / Stalemate**: A player is eliminated on checkmate or stalemate (or when they have no kings left). Checks are detected against *any* of a player’s kings.
- **Elimination**: 
  - Capture of any king → immediate team wipe.
  - Checkmate / stalemate / no kings / flag fall → team wipe.
  - Process cascades until the board stabilizes.
- **Win condition**: Last player with an active army remaining (classic last-man-standing). A points mode exists in the type definitions but the current gameplay focuses on elimination.

---

### How to Play (Local)

**Prerequisites:** Node.js (18+)

```bash
git clone https://github.com/xfst14/four_player_chess.git
cd four_player_chess
npm install
npm run dev
```

Open the URL shown by Vite (usually `http://localhost:5173`).

**Scripts:**
- `npm run dev` — development server with HMR
- `npm run build` — production build (outputs a single HTML file thanks to the singlefile plugin)
- `npm run preview` — preview the production build

---

### Project Structure

```
src/
├── App.tsx                 # Screen routing (Menu → Editor → Game)
├── components/             # UI screens & board
│   ├── MenuScreen.tsx
│   ├── EditorScreen.tsx    # Army Forge
│   ├── GameScreen.tsx      # Main game loop, clocks, bots, log
│   ├── Board.tsx
│   └── PieceIcon.tsx
├── game/
│   ├── engine.ts           # Core rules: board, moves, checks, setup, notation
│   ├── bot.ts              # Simple bot move selection
│   ├── settings.ts         # Seats, clocks, house rules, presets
│   ├── theme.ts            # Player colors
│   ├── sound.ts
│   └── ...
├── utils/
│   └── cn.ts               # className helper
└── index.css
```

Core logic lives in `engine.ts` (legal moves, attacks, multi-king conditions, promotion, standard setup). The game state is managed with a reducer in `GameScreen.tsx`.

---

### Tech Stack

- **React 19** + **TypeScript**
- **Vite 7** + `@vitejs/plugin-react` + `vite-plugin-singlefile`
- **Tailwind CSS 4** (`@tailwindcss/vite`)
- **Framer Motion** (animations / screen transitions)
- **Lucide React** (icons)
- **clsx** + **tailwind-merge**

No backend required — pure client-side.

---

### Customization & House Rules

From the main menu you can:
- Choose player/bot mix and rename seats
- Set bot difficulty per seat
- Choose or enter a custom clock
- Toggle **Claim defeated armies** and **King Hunt**
- Open the **Army Forge** to create wild multi-king (or zero-king) starting positions

The editor lets you freely place kings, queens, etc. Zero kings = that side starts already eliminated. Multiple kings = the first one lost still wipes the army.

---

### License

Apache License 2.0 — see [LICENSE](LICENSE).

---

### Code of Conduct / Submission Guidelines

You are highly welcome to submit your code requests (including full AI-generated or AI-assisted code is accepted) - but please remember to rigorously test your website before submitting a Pull Request (PR) to the main repo!

---

### Credits / Notes

Inspired by classic four-player chess variants (especially the modern free-for-all style popularized on platforms like Chess.com) with a unique multi-king twist and “claim the spoils” mechanic.

Originally built as a fun, self-contained web experience. Contributions, bug reports, and stronger bots welcome!

---

**Enjoy the chaos of four crowns.** 👑⚔️
