// src/game/engine.ts
export const SIZE = 14;
const CORNER = 3;

export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
export type PlayerCondition = 'ok' | 'check' | 'mate' | 'stalemate' | 'dead';

export const PIECE_POINTS: Record<PieceType, number> = {
  p: 1, // Pawn
  n: 2, // Knight
  b: 3, // Bishop
  r: 3, // Rook
  q: 5, // Queen
  k: 9  // King
};

export interface Vec {
  r: number;
  c: number;
}

export interface GPiece {
  id: number;
  type: PieceType;
  owner: number; // 0 Red, 1 Blue, 2 Amber, 3 Green
  dir: number;   // facing / pawn direction (= owner)
}

export type Board = (GPiece | null)[][];

export interface Move {
  from: Vec;
  to: Vec;
  capturedId?: number;
}

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

function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null));
}

/** Pawn forward step for each army. */
function pawnStep(dir: number): Vec {
  switch (dir) {
    case 0: return { r: -1, c: 0 }; // Red: up
    case 1: return { r: 0, c: 1 };  // Blue: right
    case 2: return { r: 1, c: 0 };  // Amber: down
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

function enemyAt(board: Board, r: number, c: number, me: number, alive: boolean[]): GPiece | null {
  if (!isValidSquare(r, c)) return null;
  const p = board[r][c];
  if (!p || p.owner === me || !alive[p.owner]) return null;
  return p;
}

function slide(
  board: Board,
  r: number,
  c: number,
  dr: number,
  dc: number,
  me: number,
  alive: boolean[],
  acc: Vec[],
) {
  let rr = r + dr;
  let cc = c + dc;
  while (isValidSquare(rr, cc)) {
    const p = board[rr][cc];
    if (!p) {
      acc.push({ r: rr, c: cc });
    } else {
      if (p.owner !== me && alive[p.owner]) acc.push({ r: rr, c: cc });
      break;
    }
    rr += dr;
    cc += dc;
  }
}

/** Pseudo-legal target squares (ignores self-check). */
function rawTargets(board: Board, r: number, c: number, alive: boolean[]): Vec[] {
  const piece = board[r][c];
  if (!piece || !alive[piece.owner]) return [];
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
    // captures: forward-diagonal relative to facing
    const caps: Vec[] =
      dc === 0
        ? [
            { r: r + dr, c: c - 1 },
            { r: r + dr, c: c + 1 },
          ]
        : [
            { r: r - 1, c: c + dc },
            { r: r + 1, c: c + dc },
          ];
    for (const t of caps) {
      if (enemyAt(board, t.r, t.c, me, alive)) out.push(t);
    }
    return out;
  }

  if (piece.type === 'n') {
    for (const [dr, dc] of [
      [2, 1], [2, -1], [-2, 1], [-2, -1],
      [1, 2], [1, -2], [-1, 2], [-1, -2],
    ]) {
      const rr = r + dr;
      const cc = c + dc;
      if (!isValidSquare(rr, cc)) continue;
      const p = board[rr][cc];
      if (!p || (p.owner !== me && alive[p.owner])) out.push({ r: rr, c: cc });
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
        if (!p || (p.owner !== me && alive[p.owner])) out.push({ r: rr, c: cc });
      }
    }
    return out;
  }

  const ortho = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  const diag = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const;
  const rays =
    piece.type === 'r' ? ortho : piece.type === 'b' ? diag : [...ortho, ...diag];

  for (const [dr, dc] of rays) slide(board, r, c, dr, dc, me, alive, out);
  return out;
}

export function isAttacked(
  board: Board,
  r: number,
  c: number,
  defender: number,
  alive: boolean[],
): boolean {
  for (let rr = 0; rr < SIZE; rr++) {
    for (let cc = 0; cc < SIZE; cc++) {
      const p = board[rr][cc];
      if (!p || p.owner === defender || !alive[p.owner]) continue;
      const targets = rawTargets(board, rr, cc, alive);
      if (targets.some(t => t.r === r && t.c === c)) return true;
    }
  }
  return false;
}

function anyKingInCheck(board: Board, player: number, alive: boolean[]): boolean {
  const kings = findKings(board, player);
  if (kings.length === 0) return false;
  return kings.some(k => isAttacked(board, k.r, k.c, player, alive));
}

function applyMoveInPlace(board: Board, move: Move): GPiece | null {
  const piece = board[move.from.r][move.from.c];
  if (!piece) return null;
  const target = board[move.to.r][move.to.c];
  board[move.from.r][move.from.c] = null;
  let captured: GPiece | null = target ? { ...target } : null;
  const moved = { ...piece };
  if (isPromoMove(moved, move.to.r, move.to.c)) moved.type = 'q';
  board[move.to.r][move.to.c] = moved;
  return captured;
}

export function applyMoveClone(
  board: Board,
  move: Move,
): { board: Board; captured: GPiece | null; promoted: boolean } {
  const next = cloneBoard(board);
  const src = board[move.from.r][move.from.c];
  const promoted = !!(src && isPromoMove(src, move.to.r, move.to.c));
  const captured = applyMoveInPlace(next, move);
  return { board: next, captured, promoted };
}

export function allLegalMoves(
  board: Board,
  player: number,
  kingHunt: boolean,
  alive: boolean[],
): Move[] {
  if (!alive[player]) return [];
  const moves: Move[] = [];

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (!p || p.owner !== player) continue;
      for (const to of rawTargets(board, r, c, alive)) {
        const target = board[to.r][to.c];
        // In non–king-hunt mode, kings are not capturable pieces in the normal sense
        // (team wipe is handled via checkmate / last king). Still allow king capture
        // when kingHunt is on, matching GameScreen's capture-king wipe rule.
        if (!kingHunt && target?.type === 'k') {
          // still allow; GameScreen eliminates on king capture either way
        }
        const move: Move = {
          from: { r, c },
          to,
          capturedId: target?.id,
        };
        const { board: next } = applyMoveClone(board, move);
        // Must not leave any of your own kings in check
        if (!anyKingInCheck(next, player, alive)) {
          moves.push(move);
        }
      }
    }
  }
  return moves;
}

export function playerCondition(
  board: Board,
  player: number,
  kingHunt: boolean,
  alive: boolean[],
): PlayerCondition {
  if (!alive[player]) return 'dead';
  const kings = findKings(board, player);
  if (kings.length === 0) return 'dead';
  const inCheck = anyKingInCheck(board, player, alive);
  const moves = allLegalMoves(board, player, kingHunt, alive);
  if (moves.length === 0) return inCheck ? 'mate' : 'stalemate';
  return inCheck ? 'check' : 'ok';
}

export function moveNotation(move: Move, promoted?: boolean, suffix = ''): string {
  const files = 'abcdefghijklmn';
  const sq = (v: Vec) => `${files[v.c] ?? '?'}${SIZE - v.r}`;
  const cap = move.capturedId !== undefined ? 'x' : '–';
  return `${sq(move.from)}${cap}${sq(move.to)}${promoted ? '=Q' : ''}${suffix}`;
}

export function standardSetup(): { board: Board; nextId: number } {
  const board = emptyBoard();
  let id = 1;
  const put = (r: number, c: number, type: PieceType, owner: number) => {
    if (!isValidSquare(r, c)) return;
    board[r][c] = { id: id++, type, owner, dir: owner };
  };

  // Back-rank template: R N B Q K B N R on the 8 central files/ranks
  const back: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

  // Red (bottom) — owner 0
  for (let i = 0; i < 8; i++) {
    put(13, 3 + i, back[i], 0);
    put(12, 3 + i, 'p', 0);
  }
  // Amber (top) — owner 2
  for (let i = 0; i < 8; i++) {
    put(0, 3 + i, back[i], 2);
    put(1, 3 + i, 'p', 2);
  }
  // Blue (left) — owner 1
  for (let i = 0; i < 8; i++) {
    put(3 + i, 0, back[i], 1);
    put(3 + i, 1, 'p', 1);
  }
  // Green (right) — owner 3
  for (let i = 0; i < 8; i++) {
    put(3 + i, 13, back[i], 3);
    put(3 + i, 12, 'p', 3);
  }

  return { board, nextId: id };
}
