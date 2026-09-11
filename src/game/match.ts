// src/game/match.ts
import {
  allLegalMoves,
  anyKingInCheck,
  applyMoveClone,
  cloneBoard,
  findKings,
  moveNotation,
  PIECE_NAME,
  playerCondition,
  SIZE,
  standardSetup,
  type Board,
  type Move,
  type PieceType,
  type PlayerCondition,
  type RuleCtx,
  type Vec,
} from './engine';
import {
  activeTeamIds,
  scoreForCapture,
  teamsOf,
  type Scoring,
  type Settings,
  type WinCondition,
} from './settings';

export interface PlayerStats {
  points: number;
  captures: Record<PieceType, number>;
  totalCaptures: number;
  checks: number;
  mates: number;
  eliminations: number;
}

export interface LogEntry {
  id: number;
  player: number;
  text: string;
  points: number;
  note: string;
}

export interface MatchResult {
  winningTeam: number | null;
  method: WinCondition;
  headline: string;
  reason: string;
  tie: boolean;
}

export interface MatchState {
  board: Board;
  turn: number;
  alive: boolean[];
  conditions: PlayerCondition[];
  stats: PlayerStats[];
  log: LogEntry[];
  clocks: (number | null)[];
  selected: Vec | null;
  legal: Move[];
  lastMove: { from: Vec; to: Vec } | null;
  over: boolean;
  result: MatchResult | null;
  scoring: Scoring;
  ply: number;
  toast: { player: number; points: number; label: string; id: number } | null;
}

export type MatchAction =
  | { type: 'select'; sq: Vec }
  | { type: 'clear' }
  | { type: 'move'; move: Move }
  | { type: 'tick'; dt: number }
  | { type: 'scoring'; scoring: Scoring }
  | { type: 'resign'; player: number }
  | { type: 'dismissToast' }
  | { type: 'reset' };

function emptyStats(): PlayerStats {
  return {
    points: 0,
    captures: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    totalCaptures: 0,
    checks: 0,
    mates: 0,
    eliminations: 0,
  };
}

export function ctxOf(alive: boolean[], settings: Settings): RuleCtx {
  return { alive, teams: teamsOf(settings), kingHunt: settings.kingHunt };
}

export function teamPoints(stats: PlayerStats[], settings: Settings, team: number): number {
  const teams = teamsOf(settings);
  return stats.reduce((sum, s, i) => (teams[i] === team ? sum + s.points : sum), 0);
}

export function teamCaptures(stats: PlayerStats[], settings: Settings, team: number): number {
  const teams = teamsOf(settings);
  return stats.reduce((sum, s, i) => (teams[i] === team ? sum + s.totalCaptures : sum), 0);
}

export function createMatch(settings: Settings): MatchState {
  const built = settings.setup ? { board: cloneBoard(settings.setup.board), nextId: settings.setup.nextId } : standardSetup();
  const board = built.board;
  const alive = [0, 1, 2, 3].map(i => findKings(board, i).length > 0);
  for (let i = 0; i < 4; i++) if (!alive[i]) removeArmy(board, i, -1, settings, alive);
  const ctx = ctxOf(alive, settings);
  return {
    board,
    turn: 0,
    alive,
    conditions: [0, 1, 2, 3].map(p => playerCondition(board, p, ctx)),
    stats: [emptyStats(), emptyStats(), emptyStats(), emptyStats()],
    log: [],
    clocks: [0, 1, 2, 3].map(() => settings.timeSec),
    selected: null,
    legal: [],
    lastMove: null,
    over: false,
    result: null,
    scoring: { ...settings.scoring },
    ply: 0,
    toast: null,
  };
}

function removeArmy(board: Board, victim: number, killer: number, settings: Settings, alive: boolean[]) {
  const canClaim = settings.commandeer && killer >= 0 && killer !== victim && alive[killer];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (!p || p.owner !== victim) continue;
      if (p.type === 'k') {
        board[r][c] = null;
      } else if (canClaim) {
        board[r][c] = { ...p, owner: killer };
      }
    }
  }
}

function aliveTeamsOf(alive: boolean[], settings: Settings): number[] {
  const teams = teamsOf(settings);
  return activeTeamIds(settings).filter(t => teams.some((tt, i) => tt === t && alive[i]));
}

export function buildResult(
  settings: Settings,
  alive: boolean[],
  stats: PlayerStats[],
  reasonHint: string,
): MatchResult {
  const surviving = aliveTeamsOf(alive, settings);
  const ids = activeTeamIds(settings);

  if (settings.winCondition === 'points') {
    const totals = ids.map(t => ({ team: t, pts: teamPoints(stats, settings, t) }));
    const max = Math.max(...totals.map(t => t.pts));
    let leaders = totals.filter(t => t.pts === max).map(t => t.team);
    let tie = leaders.length > 1;
    if (tie) {
      // tie-break: still standing beats eliminated
      const standing = leaders.filter(t => surviving.includes(t));
      if (standing.length === 1) {
        leaders = standing;
        tie = false;
      }
    }
    return {
      winningTeam: tie ? null : leaders[0],
      method: 'points',
      headline: tie ? 'Point deadlock' : 'Highest score wins',
      reason: tie
        ? `${reasonHint} Both sides finished level on ${max} pts.`
        : `${reasonHint} Winner decided on points (${max} pts).`,
      tie,
    };
  }

  return {
      winningTeam: surviving.length === 1 ? surviving[0] : null,
      method: 'classic',
      headline: surviving.length === 1 ? 'Last army standing' : 'Mutual destruction',
      reason:
        surviving.length === 1
          ? `${reasonHint} Classic rule: the side that survives last takes the crown.`
          : `${reasonHint} No army survived — the board is a graveyard.`,
      tie: surviving.length !== 1,
    };
}

function nextAliveSeat(from: number, alive: boolean[]): number {
  for (let i = 1; i <= 4; i++) {
    const n = (from + i) % 4;
    if (alive[n]) return n;
  }
  return -1;
}

const SEAT_NAMES = ['Red', 'Blue', 'Amber', 'Green'];

/**
 * Runs elimination cascades (checkmate / kingless / stalemate-on-turn) and
 * hands out the configured check + checkmate point increments to `mover`.
 * Returns the seat that should move next.
 */
function settle(
  board: Board,
  alive: boolean[],
  settings: Settings,
  scoring: Scoring,
  mover: number,
  stats: PlayerStats[],
  notes: string[],
  afterSeat: number,
  prevChecks: Set<number> = new Set(),
): { conditions: PlayerCondition[]; gained: number; turn: number } {
  const teams = teamsOf(settings);
  const conditions: PlayerCondition[] = ['dead', 'dead', 'dead', 'dead'];
  const checkAwarded = new Set<number>();
  let gained = 0;

  const wipe = (p: number) => {
    if (mover >= 0 && p !== mover) stats[mover].eliminations += 1;
    alive[p] = false;
    conditions[p] = 'dead';
    removeArmy(board, p, mover, settings, alive);
  };

  const cascade = () => {
    for (let guard = 0; guard < 6; guard++) {
      const ctx = ctxOf(alive, settings);
      for (let p = 0; p < 4; p++) conditions[p] = alive[p] ? playerCondition(board, p, ctx) : 'dead';

      let changed = false;
      for (let p = 0; p < 4; p++) {
        if (!alive[p]) continue;
        const cond = conditions[p];
        const foe = mover >= 0 && teams[p] !== teams[mover];
        if (cond === 'mate' || cond === 'dead') {
          if (cond === 'mate' && foe) {
            gained += scoring.checkmate;
            stats[mover].mates += 1;
            notes.push(`checkmates ${SEAT_NAMES[p]} (+${scoring.checkmate})`);
          }
          wipe(p);
          changed = true;
        } else if (cond === 'check' && foe && !checkAwarded.has(p) && !prevChecks.has(p)) {
          checkAwarded.add(p);
          gained += scoring.check;
          stats[mover].checks += 1;
          notes.push(`check on ${SEAT_NAMES[p]} (+${scoring.check})`);
        }
      }
      if (!changed) break;
    }
  };

  cascade();

  // A stalemated army is only eliminated when it is actually their turn.
  let turn = nextAliveSeat(afterSeat, alive);
  for (let guard = 0; guard < 4 && turn >= 0; guard++) {
    if (!alive[turn]) {
      turn = nextAliveSeat(turn, alive);
      continue;
    }
    if (conditions[turn] !== 'stalemate') break;
    notes.push(`${SEAT_NAMES[turn]} is stalemated`);
    const stuck = turn;
    wipe(stuck);
    cascade();
    turn = nextAliveSeat(stuck, alive);
  }

  return { conditions, gained, turn };
}

function finishIfOver(state: MatchState, settings: Settings, reasonHint: string): MatchState {
  const surviving = aliveTeamsOf(state.alive, settings);
  const pointsTargetHit =
    settings.winCondition === 'points' &&
    settings.pointsToWin > 0 &&
    activeTeamIds(settings).some(t => teamPoints(state.stats, settings, t) >= settings.pointsToWin);

  if (surviving.length <= 1 || pointsTargetHit || state.turn < 0) {
    const hint = pointsTargetHit ? 'Point target reached.' : reasonHint;
    return { ...state, over: true, result: buildResult(settings, state.alive, state.stats, hint) };
  }
  return state;
}

export function makeReducer(settings: Settings) {
  const NAMES = ['Red', 'Blue', 'Amber', 'Green'];

  return function reducer(state: MatchState, action: MatchAction): MatchState {
    switch (action.type) {
      case 'reset':
        return createMatch(settings);

      case 'scoring':
        return { ...state, scoring: { ...action.scoring } };

      case 'clear':
        return { ...state, selected: null, legal: [] };

      case 'dismissToast':
        return state.toast ? { ...state, toast: null } : state;

      case 'select': {
        if (state.over) return state;
        const piece = state.board[action.sq.r][action.sq.c];
        if (!piece || piece.owner !== state.turn) return { ...state, selected: null, legal: [] };
        const ctx = ctxOf(state.alive, settings);
        const legal = allLegalMoves(state.board, state.turn, ctx).filter(
          m => m.from.r === action.sq.r && m.from.c === action.sq.c,
        );
        return { ...state, selected: action.sq, legal };
      }

      case 'tick': {
        if (state.over || settings.timeSec === null) return state;
        const clocks = [...state.clocks];
        const cur = clocks[state.turn];
        if (cur === null) return state;
        const left = Math.max(0, cur - action.dt);
        clocks[state.turn] = left;
        if (left > 0) return { ...state, clocks };

        // flag fall -> army wiped
        const alive = [...state.alive];
        const board = state.board.map(row => row.map(p => (p ? { ...p } : null)));
        const stats = state.stats.map(s => ({ ...s, captures: { ...s.captures } }));
        alive[state.turn] = false;
        removeArmy(board, state.turn, -1, settings, alive);
        const notes: string[] = [];
        const { conditions, turn: nextTurn } = settle(
          board,
          alive,
          settings,
          state.scoring,
          -1,
          stats,
          notes,
          state.turn,
        );
        const log: LogEntry[] = [
          ...state.log,
          {
            id: state.ply + 1,
            player: state.turn,
            text: 'flag fall',
            points: 0,
            note: `${NAMES[state.turn]} ran out of time`,
          },
        ];
        const next: MatchState = {
          ...state,
          board,
          alive,
          stats,
          conditions,
          clocks,
          log,
          selected: null,
          legal: [],
          turn: nextTurn < 0 ? state.turn : nextTurn,
          ply: state.ply + 1,
        };
        return finishIfOver(next, settings, `${NAMES[state.turn]} flagged.`);
      }

      case 'resign': {
        if (state.over) return state;
        const alive = [...state.alive];
        const board = state.board.map(row => row.map(p => (p ? { ...p } : null)));
        const stats = state.stats.map(s => ({ ...s, captures: { ...s.captures } }));
        alive[action.player] = false;
        removeArmy(board, action.player, -1, settings, alive);
        const notes: string[] = [];
        const anchor = state.turn === action.player ? action.player : (state.turn + 3) % 4;
        const { conditions, turn: nextTurn } = settle(
          board,
          alive,
          settings,
          state.scoring,
          -1,
          stats,
          notes,
          anchor,
        );
        const next: MatchState = {
          ...state,
          board,
          alive,
          stats,
          conditions,
          selected: null,
          legal: [],
          turn: nextTurn < 0 ? state.turn : nextTurn,
          ply: state.ply + 1,
          log: [
            ...state.log,
            { id: state.ply + 1, player: action.player, text: 'resigns', points: 0, note: 'withdrew from the board' },
          ],
        };
        return finishIfOver(next, settings, `${NAMES[action.player]} resigned.`);
      }

      case 'move': {
        if (state.over) return state;
        const mover = state.turn;
        const piece = state.board[action.move.from.r][action.move.from.c];
        if (!piece || piece.owner !== mover) return state;

        const prevCtx = ctxOf(state.alive, settings);
        const prevChecks = new Set(
          [0, 1, 2, 3].filter(p => state.alive[p] && anyKingInCheck(state.board, p, prevCtx)),
        );

        const { board, captured, promoted } = applyMoveClone(state.board, action.move);
        const alive = [...state.alive];
        const stats = state.stats.map(s => ({ ...s, captures: { ...s.captures } }));
        const notes: string[] = [];
        let gained = 0;

        if (captured) {
          stats[mover].captures[captured.type] += 1;
          stats[mover].totalCaptures += 1;
          const bounty = scoreForCapture(captured.type, state.scoring);
          gained += bounty;
          notes.push(
            `eats ${NAMES[captured.owner]} ${PIECE_NAME[captured.type].toLowerCase()} (+${bounty})`,
          );
          if (captured.type === 'k') {
            notes.push(`${NAMES[captured.owner]}'s army is wiped out`);
            alive[captured.owner] = false;
            stats[mover].eliminations += 1;
            removeArmy(board, captured.owner, mover, settings, alive);
          }
        }

        const { conditions, gained: settleGain, turn: nextTurn } = settle(
          board,
          alive,
          settings,
          state.scoring,
          mover,
          stats,
          notes,
          mover,
          prevChecks,
        );
        gained += settleGain;
        stats[mover].points += gained;
        const text = moveNotation(piece, action.move, captured, promoted);
        const log: LogEntry[] = [
          ...state.log,
          { id: state.ply + 1, player: mover, text, points: gained, note: notes.join(' · ') },
        ];

        const next: MatchState = {
          ...state,
          board,
          alive,
          stats,
          conditions,
          log,
          selected: null,
          legal: [],
          lastMove: { from: action.move.from, to: action.move.to },
          turn: nextTurn < 0 ? mover : nextTurn,
          ply: state.ply + 1,
          toast:
            gained > 0
              ? {
                  player: mover,
                  points: gained,
                  label: captured
                    ? `${PIECE_NAME[captured.type]} devoured`
                    : notes.length
                      ? 'pressure bonus'
                      : 'bonus',
                  id: state.ply + 1,
                }
              : state.toast,
        };
        return finishIfOver(next, settings, `${NAMES[mover]} landed the final blow.`);
      }

      default:
        return state;
    }
  };
}

export function legalTargets(state: MatchState): Move[] {
  return state.legal;
}
