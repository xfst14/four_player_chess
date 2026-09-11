// src/game/bot.ts
//
// Casual  → random legal move (never refuses a free king).
// Sharp   → real search engine:
//   • iterative-deepening paranoid alpha-beta (my team maximises, every
//     enemy minimises) following the true clockwise turn order
//   • MVV-LVA + promotion + check move ordering, enemy-node beam pruning
//   • capture-only quiescence search so it doesn't fall for 1-move traps
//   • evaluation: material (weighted by the live point bounties in points
//     mode), pawn advancement, centralisation, mobility, hanging pieces,
//     king exposure, checks / checkmates / eliminations
//   • hard time budget so the UI never freezes for long
import {
  allLegalMoves,
  anyKingInCheck,
  applyMoveClone,
  findKings,
  isAttacked,
  isValidSquare,
  PIECE_VALUE,
  SIZE,
  type Board,
  type Move,
  type PieceType,
  type RuleCtx,
} from './engine';
import { scoreForCapture, type BotDifficulty, type Scoring } from './settings';

/* ───────────────────────── public API ───────────────────────── */

const SHARP_BUDGET_MS = 750;
const MAX_DEPTH = 6;
const ENEMY_BEAM = 12; // moves considered per enemy node beyond the first ply
const ALLY_BEAM = 16;

export function chooseBotMove(
  board: Board,
  player: number,
  ctx: RuleCtx,
  difficulty: BotDifficulty,
  scoring: Scoring,
  pointsMode: boolean,
): Move | null {
  const moves = allLegalMoves(board, player, ctx);
  if (moves.length === 0) return null;

  if (difficulty === 'easy') {
    const kings = moves.filter(m => m.capturedType === 'k');
    if (kings.length) return kings[Math.floor(Math.random() * kings.length)];
    return moves[Math.floor(Math.random() * moves.length)];
  }

  return sharpSearch(board, player, ctx, moves, scoring, pointsMode);
}

/* ───────────────────────── search state ───────────────────────── */

interface S {
  me: number;
  myTeam: number;
  teams: number[];
  kingHunt: boolean;
  scoring: Scoring;
  pointsMode: boolean;
  deadline: number;
  nodes: number;
  aborted: boolean;
}

class Timeout extends Error {}

function ctxOf(alive: boolean[], s: S): RuleCtx {
  return { alive, teams: s.teams, kingHunt: s.kingHunt };
}

function nextAlive(from: number, alive: boolean[]): number {
  for (let i = 1; i <= 4; i++) {
    const n = (from + i) % 4;
    if (alive[n]) return n;
  }
  return from;
}

function checkTime(s: S) {
  if ((++s.nodes & 63) === 0 && performance.now() > s.deadline) {
    s.aborted = true;
    throw new Timeout();
  }
}

/* ───────────────────────── evaluation ───────────────────────── */

const CENTER = (SIZE - 1) / 2;

function pieceWorth(type: PieceType, s: S): number {
  if (type === 'k') return 0; // kings are handled through elimination logic
  const base = PIECE_VALUE[type];
  if (!s.pointsMode) return base;
  // In points mode what matters is what the *user* says a capture is worth,
  // but keep some real chess value so the bot doesn't hang its queen for a pawn.
  return base * 0.45 + scoreForCapture(type, s.scoring) * 0.55;
}

/** How far a pawn has travelled toward promotion, 0..1. */
function pawnProgress(dir: number, r: number, c: number): number {
  switch (dir) {
    case 0: return (12 - r) / 12;
    case 1: return (c - 1) / 12;
    case 2: return (r - 1) / 12;
    default: return (12 - c) / 12;
  }
}

function centrality(r: number, c: number): number {
  const d = Math.abs(r - CENTER) + Math.abs(c - CENTER);
  return 1 - d / (SIZE - 1); // 1 at centre, ~0 at rim
}

function kingSquare(board: Board, p: number): { r: number; c: number } | null {
  const ks = findKings(board, p);
  return ks.length ? ks[0] : null;
}

/**
 * Static evaluation from the perspective of `s.myTeam`.
 * Positive = good for the bot's team.
 */
function evaluate(board: Board, alive: boolean[], s: S, toMove: number): number {
  const ctx = ctxOf(alive, s);
  const armyValue = [0, 0, 0, 0];
  const positional = [0, 0, 0, 0];
  const myPieces: { r: number; c: number; v: number }[] = [];
  const enemyPieces: { r: number; c: number; v: number; owner: number }[] = [];

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (!p || !alive[p.owner]) continue;
      const v = pieceWorth(p.type, s);
      armyValue[p.owner] += v;

      let pos = 0;
      switch (p.type) {
        case 'p': {
          const prog = pawnProgress(p.dir, r, c);
          pos += prog * prog * 2.2; // accelerating bonus near promotion
          break;
        }
        case 'n':
          pos += centrality(r, c) * 0.55;
          break;
        case 'b':
          pos += centrality(r, c) * 0.35;
          break;
        case 'q':
          pos += centrality(r, c) * 0.2;
          break;
        case 'r':
          pos += centrality(r, c) * 0.1;
          break;
        case 'k':
          // kings like the rim early, centre only when the board is empty
          pos -= centrality(r, c) * 0.4;
          break;
      }
      positional[p.owner] += pos;

      const mine = s.teams[p.owner] === s.myTeam;
      if (p.type !== 'k') {
        if (mine) myPieces.push({ r, c, v });
        else enemyPieces.push({ r, c, v, owner: p.owner });
      }
    }
  }

  // ── material & position, paranoid-weighted ───────────────────────────
  let score = 0;
  const enemies = [0, 1, 2, 3].filter(p => alive[p] && s.teams[p] !== s.myTeam);
  const allies = [0, 1, 2, 3].filter(p => alive[p] && s.teams[p] === s.myTeam);
  const maxEnemy = Math.max(1, ...enemies.map(e => armyValue[e]));

  for (const a of allies) score += armyValue[a] + positional[a];
  for (const e of enemies) {
    // The strongest enemy is the real threat; weaker ones count for less,
    // but every enemy piece eaten is still progress (esp. in points mode).
    const w = s.pointsMode ? 1 : 0.6 + 0.4 * (armyValue[e] / maxEnemy);
    score -= (armyValue[e] + positional[e]) * w;
  }

  // ── being alive is worth a lot; each enemy still standing is bad ────────
  score += allies.length * 12;
  score -= enemies.length * 6;
  if (!alive[s.me]) score -= 500;

  // ── hanging pieces (only cheap-ish: our side + the most valuable enemies) ─
  // Everyone else moves before we do again, so multiple pieces can drop.
  const hanging: number[] = [];
  for (const mp of myPieces) {
    if (mp.v < 1) continue;
    const owner = board[mp.r][mp.c]!.owner;
    if (isAttacked(board, mp.r, mp.c, owner, ctx)) hanging.push(mp.v);
  }
  hanging.sort((a, b) => b - a);
  if (hanging.length) {
    score -= hanging[0] * 0.55;
    for (let i = 1; i < hanging.length && i < 3; i++) score -= hanging[i] * 0.2;
  }
  // enemy pieces we are attacking (only look at their top few for speed)
  enemyPieces.sort((a, b) => b.v - a.v);
  let threat = 0;
  for (let i = 0; i < enemyPieces.length && i < 4; i++) {
    const ep = enemyPieces[i];
    if (isAttacked(board, ep.r, ep.c, ep.owner, ctx)) threat = Math.max(threat, ep.v);
  }
  score += threat * 0.25;

  // ── king safety / checks ───────────────────────────────────────────────
  for (const p of [...allies, ...enemies]) {
    const k = kingSquare(board, p);
    if (!k) continue;
    const mine = s.teams[p] === s.myTeam;
    const inCheck = isAttacked(board, k.r, k.c, p, ctx);
    let ks = 0;
    if (inCheck) ks -= s.pointsMode ? 1.5 + s.scoring.check * 0.5 : 1.5;

    // pawn/piece shield around the king
    let shield = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = k.r + dr;
        const cc = k.c + dc;
        if (!isValidSquare(rr, cc)) {
          shield += 0.5; // board edge = free cover
          continue;
        }
        const q = board[rr][cc];
        if (q && s.teams[q.owner] === s.teams[p]) shield += 1;
      }
    }
    ks += Math.min(shield, 5) * 0.12;

    score += mine ? ks : -ks * 0.9;
  }

  // ── mobility of side to move (cheap proxy: only when it's an enemy or us) ─
  // Skipped at interior nodes for speed; the search itself handles tempo.
  void toMove;

  return score;
}

/* ───────────────────────── move ordering ───────────────────────── */

function orderMoves(board: Board, moves: Move[], s: S, alive: boolean[]): Move[] {
  const ctx = ctxOf(alive, s);
  const scored = moves.map(m => {
    let k = 0;
    const src = board[m.from.r][m.from.c]!;
    if (m.capturedType) {
      const victim = m.capturedType === 'k' ? 60 : pieceWorth(m.capturedType, s);
      const attacker = pieceWorth(src.type, s) || 0.5;
      k += 10 + victim * 10 - attacker; // MVV-LVA
    }
    if (src.type === 'p') {
      const prog = pawnProgress(src.dir, m.to.r, m.to.c);
      if (prog >= 0.999) k += 40; // promotion
      else k += prog * 2;
    }
    // does the move give check to an enemy? (costly, so only sample cheap)
    if (!m.capturedType) {
      const { board: nb } = applyMoveClone(board, m);
      for (let e = 0; e < 4; e++) {
        if (!alive[e] || s.teams[e] === s.teams[src.owner]) continue;
        if (anyKingInCheck(nb, e, ctx)) {
          k += 6;
          break;
        }
      }
    }
    return { m, k };
  });
  scored.sort((a, b) => b.k - a.k);
  return scored.map(x => x.m);
}

/* ───────────────────────── make move (with elimination) ───────────────────────── */

function makeMove(board: Board, alive: boolean[], move: Move, s: S): { board: Board; alive: boolean[] } {
  const { board: nb, captured } = applyMoveClone(board, move);
  let na = alive;
  if (captured && captured.type === 'k') {
    if (s.kingHunt || findKings(nb, captured.owner).length === 0) {
      na = [...alive];
      na[captured.owner] = false;
    }
  }
  return { board: nb, alive: na };
}

/* ───────────────────────── quiescence ───────────────────────── */

function quiesce(
  board: Board,
  alive: boolean[],
  toMove: number,
  alpha: number,
  beta: number,
  s: S,
  qdepth: number,
): number {
  checkTime(s);
  const standPat = evaluate(board, alive, s, toMove);
  const maximizing = s.teams[toMove] === s.myTeam;
  if (qdepth === 0) return standPat;

  if (maximizing) {
    if (standPat >= beta) return standPat;
    alpha = Math.max(alpha, standPat);
  } else {
    if (standPat <= alpha) return standPat;
    beta = Math.min(beta, standPat);
  }

  const ctx = ctxOf(alive, s);
  const caps = allLegalMoves(board, toMove, ctx).filter(m => m.capturedType);
  if (caps.length === 0) return standPat;
  const ordered = orderMoves(board, caps, s, alive).slice(0, 8);

  let best = standPat;
  for (const m of ordered) {
    const { board: nb, alive: na } = makeMove(board, alive, m, s);
    const nxt = nextAlive(toMove, na);
    const v = quiesce(nb, na, nxt, alpha, beta, s, qdepth - 1);
    if (maximizing) {
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    } else {
      if (v < best) best = v;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
  }
  return best;
}

/* ───────────────────────── paranoid alpha-beta ───────────────────────── */

function search(
  board: Board,
  alive: boolean[],
  toMove: number,
  depth: number,
  alpha: number,
  beta: number,
  s: S,
  rootMoves?: Move[],
): number {
  checkTime(s);

  // terminal: our whole team is gone / every enemy gone
  const enemiesAlive = alive.some((a, i) => a && s.teams[i] !== s.myTeam);
  const alliesAlive = alive.some((a, i) => a && s.teams[i] === s.myTeam);
  if (!alliesAlive) return -1000 + (MAX_DEPTH - depth);
  if (!enemiesAlive) return 1000 - (MAX_DEPTH - depth);

  if (depth <= 0) return quiesce(board, alive, toMove, alpha, beta, s, 2);

  const ctx = ctxOf(alive, s);
  const maximizing = s.teams[toMove] === s.myTeam;
  const moves = rootMoves ?? allLegalMoves(board, toMove, ctx);

  if (moves.length === 0) {
    // checkmate or stalemate → that army is wiped (house rule), no ply spent
    const na = [...alive];
    na[toMove] = false;
    const inCheck = anyKingInCheck(board, toMove, ctx);
    let bonus = 0;
    if (!maximizing && inCheck) bonus = s.scoring.checkmate * (s.pointsMode ? 0.8 : 0.15) + 8;
    if (maximizing) bonus = -(toMove === s.me ? 400 : 60);
    const nxt = nextAlive(toMove, na);
    if (nxt === toMove) return evaluate(board, na, s, toMove) + bonus;
    return search(board, na, nxt, depth, alpha, beta, s) + bonus;
  }

  let ordered = orderMoves(board, moves, s, alive);
  if (!rootMoves) {
    const beam = maximizing ? ALLY_BEAM : ENEMY_BEAM;
    // always keep every capture; prune quiet moves beyond the beam
    if (ordered.length > beam) {
      const caps = ordered.filter(m => m.capturedType);
      const quiet = ordered.filter(m => !m.capturedType);
      ordered = [...caps, ...quiet.slice(0, Math.max(4, beam - caps.length))];
    }
  }

  let best = maximizing ? -Infinity : Infinity;
  for (const m of ordered) {
    const { board: nb, alive: na } = makeMove(board, alive, m, s);
    const nxt = nextAlive(toMove, na);
    let v = search(nb, na, nxt, depth - 1, alpha, beta, s);
    // small immediate reward for the capture itself (points mode cares)
    if (m.capturedType && s.pointsMode) {
      const gain = scoreForCapture(m.capturedType, s.scoring) * 0.1;
      v += maximizing ? gain : -gain;
    }
    if (maximizing) {
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    } else {
      if (v < best) best = v;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
  }
  return best;
}

/* ───────────────────────── root driver ───────────────────────── */

function sharpSearch(
  board: Board,
  player: number,
  ctx: RuleCtx,
  moves: Move[],
  scoring: Scoring,
  pointsMode: boolean,
): Move {
  const s: S = {
    me: player,
    myTeam: ctx.teams[player],
    teams: ctx.teams,
    kingHunt: ctx.kingHunt,
    scoring,
    pointsMode,
    deadline: performance.now() + SHARP_BUDGET_MS,
    nodes: 0,
    aborted: false,
  };
  const alive = [...ctx.alive];

  // Free king with king hunt? Take it — it wipes an army instantly.
  const kingGrab = moves.find(m => m.capturedType === 'k' && s.kingHunt);
  if (kingGrab) return kingGrab;

  let ordered = orderMoves(board, moves, s, alive);
  let bestMove = ordered[0];
  let bestScore = -Infinity;

  // iterative deepening: every completed iteration re-orders the root
  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    const results: { m: Move; v: number }[] = [];
    let alpha = -Infinity;
    const beta = Infinity;
    try {
      for (const m of ordered) {
        const { board: nb, alive: na } = makeMove(board, alive, m, s);
        const nxt = nextAlive(player, na);
        let v = search(nb, na, nxt, depth - 1, alpha, beta, s);
        if (m.capturedType && s.pointsMode) v += scoreForCapture(m.capturedType, s.scoring) * 0.1;
        v += Math.random() * 0.03; // tie-break variety
        results.push({ m, v });
        if (v > alpha) alpha = v;
      }
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
    }

    if (results.length === 0) break; // ran out of time before finishing a single move
    results.sort((a, b) => b.v - a.v);

    if (!s.aborted || results.length === ordered.length) {
      bestMove = results[0].m;
      bestScore = results[0].v;
      ordered = results.map(r => r.m);
    } else {
      // partial iteration: only trust it if it beat the previous best
      if (results[0].v > bestScore) {
        bestMove = results[0].m;
        bestScore = results[0].v;
      }
      break;
    }
    if (s.aborted) break;
    if (bestScore > 900 || bestScore < -900) break; // forced result found
  }

  return bestMove;
}
