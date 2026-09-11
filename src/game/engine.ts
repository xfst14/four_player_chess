// src/game/engine.ts
// Core rules for four-player chess (14x14 board with 3x3 corners removed).
// Extended with team-awareness: pieces of allied armies can never be captured
// and allies never give check to each other.

export const SIZE = 14;
export const CORNER = 3;

export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
export type PlayerCondition = 'ok' | 'check' | 'mate' | 'stalemate' | 'dead';

export interface Vec {
  r: number;
  c: number;
}

export interface GPiece {
  id: number;
  type: PieceType;
  owner: number; // 0 Red, 1 Blue, 2 Amber, 3 Green
  dir: number; // facing / pawn direction
}

export type Board = (GPiece | null)[][];

export interface Move {
  from: Vec;
  to: Vec;
  capturedId?: number;
  capturedType?: PieceType;
  capturedOwner?: number;
}

/** Everything the rules need to know about the current match. */
export interface RuleCtx {
  alive: boolean[];
  teams: number[]; // team index per seat (FFA -> [0,1,2,3])
  kingHunt: boolean;
}

export const PIECE_VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
export const PIECE_NAME: Record<PieceType, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};

const KNIGHT_DELTAS = [
  [2, 1], [2, -1], [-2, 1], [-2, -1],
  [1, 2], [1, -2], [-1, 2], [-1, -2],
] as const;
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

export function isValidSquare(r: number, c: number): boolean {
  if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return false;
  const top = r < CORNER;
  const bot = r >= SIZE - CORNER;
  const left = c < CORNER;
  const right = c >= SIZE - CORNER;
  return !(top && left) && !(top && right) && !(bot && left) && !(bot && right);
}

export function cloneBoard(board: Board): Board {
  return board.map(row => row.map(p => (p ? { ...p } : null)));
}

export function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null as GPiece | null));
}

export function areAllies(a: number, b: number, ctx: RuleCtx): boolean {
  return ctx.teams[a] === ctx.teams[b];
}

function capturable(p: GPiece | null, me: number, ctx: RuleCtx): boolean {
  if (!p) return false;
  if (!ctx.alive[p.owner]) return false; // eliminated armies leave inert obstacles
  return !areAllies(p.owner, me, ctx);
}

/** Pawn forward step for each army. */
export function pawnStep(dir: number): Vec {
  switch (dir) {
    case 0: return { r: -1, c: 0 }; // Red: up
    case 1: return { r: 0, c: 1 }; // Blue: right
    case 2: return { r: 1, c: 0 }; // Amber: down
    default: return { r: 0, c: -1 }; // Green: left
  }
}

function pawnStart(dir: number, r: number, c: number): boolean {
  switch (dir) {
    case 0: return r === 12;
    case 1: return c === 1;
    case 2: return r === 1;
    default: return c === 12;
  }
}

function pawnCaptureSquares(dir: number, r: number, c: number): Vec[] {
  const { r: dr, c: dc } = pawnStep(dir);
  return dc === 0
    ? [{ r: r + dr, c: c - 1 }, { r: r + dr, c: c + 1 }]
    : [{ r: r - 1, c: c + dc }, { r: r + 1, c: c + dc }];
}

export function isPromoMove(piece: GPiece, r: number, c: number): boolean {
  if (piece.type !== 'p') return false;
  switch (piece.dir) {
    case 0: return r === 0;
    case 1: return c === SIZE - 1;
    case 2: return r === SIZE - 1;
    default: return c === 0;
  }
}

export function findKings(board: Board, player: number): Vec[] {
  const out: Vec[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (p && p.owner === player && p.type === 'k') out.push({ r, c });
    }
  }
  return out;
}

function slide(board: Board, r: number, c: number, dr: number, dc: number, me: number, ctx: RuleCtx, acc: Vec[]) {
  let rr = r + dr;
  let cc = c + dc;
  while (isValidSquare(rr, cc)) {
    const p = board[rr][cc];
    if (!p) {
      acc.push({ r: rr, c: cc });
    } else {
      if (capturable(p, me, ctx)) acc.push({ r: rr, c: cc });
      break;
    }
    rr += dr;
    cc += dc;
  }
}

/** Pseudo-legal target squares (ignores self-check). */
export function rawTargets(board: Board, r: number, c: number, ctx: RuleCtx): Vec[] {
  const piece = board[r][c];
  if (!piece || !ctx.alive[piece.owner]) return [];
  const me = piece.owner;
  const out: Vec[] = [];

  if (piece.type === 'p') {
    const { r: dr, c: dc } = pawnStep(piece.dir);
    const r1 = r + dr;
    const c1 = c + dc;
    if (isValidSquare(r1, c1) && !board[r1][c1]) {
      out.push({ r: r1, c: c1 });
      if (pawnStart(piece.dir, r, c)) {
        const r2 = r + dr * 2;
        const c2 = c + dc * 2;
        if (isValidSquare(r2, c2) && !board[r2][c2]) out.push({ r: r2, c: c2 });
      }
    }
    for (const t of pawnCaptureSquares(piece.dir, r, c)) {
      if (!isValidSquare(t.r, t.c)) continue;
      if (capturable(board[t.r][t.c], me, ctx)) out.push(t);
    }
    return out;
  }

  if (piece.type === 'n') {
    for (const [dr, dc] of KNIGHT_DELTAS) {
      const rr = r + dr;
      const cc = c + dc;
      if (!isValidSquare(rr, cc)) continue;
      const p = board[rr][cc];
      if (!p || capturable(p, me, ctx)) out.push({ r: rr, c: cc });
    }
    return out;
  }

  if (piece.type === 'k') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (!isValidSquare(rr, cc)) continue;
        const p = board[rr][cc];
        if (!p || capturable(p, me, ctx)) out.push({ r: rr, c: cc });
      }
    }
    return out;
  }

  const rays = piece.type === 'r' ? ORTHO : piece.type === 'b' ? DIAG : [...ORTHO, ...DIAG];
  for (const [dr, dc] of rays) slide(board, r, c, dr, dc, me, ctx, out);
  return out;
}

function foeAt(board: Board, r: number, c: number, defender: number, ctx: RuleCtx): GPiece | null {
  if (!isValidSquare(r, c)) return null;
  const p = board[r][c];
  if (!p || !ctx.alive[p.owner]) return null;
  if (areAllies(p.owner, defender, ctx)) return null;
  return p;
}

/** Reverse-scan attack detection: fast enough to run every ply. */
export function isAttacked(board: Board, r: number, c: number, defender: number, ctx: RuleCtx): boolean {
  for (const [dr, dc] of KNIGHT_DELTAS) {
    const p = foeAt(board, r + dr, c + dc, defender, ctx);
    if (p && p.type === 'n') return true;
  }
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const p = foeAt(board, r + dr, c + dc, defender, ctx);
      if (p && p.type === 'k') return true;
    }
  }
  for (const [dr, dc] of ORTHO) {
    let rr = r + dr;
    let cc = c + dc;
    while (isValidSquare(rr, cc)) {
      const p = board[rr][cc];
      if (p) {
        if (ctx.alive[p.owner] && !areAllies(p.owner, defender, ctx) && (p.type === 'r' || p.type === 'q')) return true;
        break;
      }
      rr += dr;
      cc += dc;
    }
  }
  for (const [dr, dc] of DIAG) {
    let rr = r + dr;
    let cc = c + dc;
    while (isValidSquare(rr, cc)) {
      const p = board[rr][cc];
      if (p) {
        if (ctx.alive[p.owner] && !areAllies(p.owner, defender, ctx) && (p.type === 'b' || p.type === 'q')) return true;
        break;
      }
      rr += dr;
      cc += dc;
    }
  }
  // pawns: only diagonal neighbours can ever attack this square
  for (const [dr, dc] of DIAG) {
    const rr = r + dr;
    const cc = c + dc;
    const p = foeAt(board, rr, cc, defender, ctx);
    if (p && p.type === 'p') {
      for (const t of pawnCaptureSquares(p.dir, rr, cc)) {
        if (t.r === r && t.c === c) return true;
      }
    }
  }
  return false;
}

export function anyKingInCheck(board: Board, player: number, ctx: RuleCtx): boolean {
  const kings = findKings(board, player);
  if (kings.length === 0) return false;
  return kings.some(k => isAttacked(board, k.r, k.c, player, ctx));
}

export function applyMoveClone(
  board: Board,
  move: Move,
): { board: Board; captured: GPiece | null; promoted: boolean } {
  const next = cloneBoard(board);
  const piece = next[move.from.r][move.from.c];
  if (!piece) return { board: next, captured: null, promoted: false };
  const target = next[move.to.r][move.to.c];
  const captured = target ? { ...target } : null;
  const promoted = isPromoMove(piece, move.to.r, move.to.c);
  next[move.from.r][move.from.c] = null;
  if (promoted) piece.type = 'q';
  next[move.to.r][move.to.c] = piece;
  return { board: next, captured, promoted };
}

export function allLegalMoves(board: Board, player: number, ctx: RuleCtx): Move[] {
  if (!ctx.alive[player]) return [];
  const moves: Move[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const piece = board[r][c];
      if (!piece || piece.owner !== player) continue;
      for (const to of rawTargets(board, r, c, ctx)) {
        const target = board[to.r][to.c];
        if (!ctx.kingHunt && target && target.type === 'k') {
          // Without King Hunt a king can only be removed by checkmate,
          // unless the owner still has another king on the board.
          if (findKings(board, target.owner).length <= 1) continue;
        }
        // make / unmake to test self-check
        board[to.r][to.c] = piece;
        board[r][c] = null;
        const safe = !anyKingInCheck(board, player, ctx);
        board[r][c] = piece;
        board[to.r][to.c] = target;
        if (safe) {
          moves.push({
            from: { r, c },
            to,
            capturedId: target?.id,
            capturedType: target?.type,
            capturedOwner: target?.owner,
          });
        }
      }
    }
  }
  return moves;
}

export function playerCondition(board: Board, player: number, ctx: RuleCtx): PlayerCondition {
  if (!ctx.alive[player]) return 'dead';
  if (findKings(board, player).length === 0) return 'dead';
  const inCheck = anyKingInCheck(board, player, ctx);
  const moves = allLegalMoves(board, player, ctx);
  if (moves.length === 0) return inCheck ? 'mate' : 'stalemate';
  return inCheck ? 'check' : 'ok';
}

const BACK_RANK: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

export function standardSetup(): { board: Board; nextId: number } {
  const board = emptyBoard();
  let id = 1;
  const put = (r: number, c: number, type: PieceType, owner: number) => {
    board[r][c] = { id: id++, type, owner, dir: owner };
  };
  for (let i = 0; i < 8; i++) {
    const t = BACK_RANK[i];
    // Red (bottom)
    put(13, 3 + i, t, 0);
    put(12, 3 + i, 'p', 0);
    // Blue (left)
    put(10 - i, 0, t, 1);
    put(10 - i, 1, 'p', 1);
    // Amber (top)
    put(0, 10 - i, t, 2);
    put(1, 10 - i, 'p', 2);
    // Green (right)
    put(3 + i, 13, t, 3);
    put(3 + i, 12, 'p', 3);
  }
  return { board, nextId: id };
}

const FILES = 'abcdefghijklmn';

export function squareName(v: Vec): string {
  return `${FILES[v.c]}${SIZE - v.r}`;
}

export function moveNotation(piece: GPiece, move: Move, captured: GPiece | null, promoted: boolean): string {
  const letter = piece.type === 'p' ? '' : piece.type.toUpperCase();
  return `${letter}${squareName(move.from)}${captured ? 'x' : '–'}${squareName(move.to)}${promoted ? '=Q' : ''}`;
}

export function countMaterial(board: Board, player: number): number {
  let total = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (p && p.owner === player && p.type !== 'k') total += PIECE_VALUE[p.type];
    }
  }
  return total;
}
