import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot, Crown, Flag, Gauge, Home, Hourglass, RotateCcw, Skull, Swords, User, Volume2, VolumeX,
} from 'lucide-react';
import {
  Board, Move, PieceType, SIZE, Vec, allLegalMoves, applyMoveClone, cloneBoard,
  findKings, isAttacked, isPromoMove, moveNotation, playerCondition, PlayerCondition,
  standardSetup,
} from '../game/engine';
import { BotDifficulty, chooseBotMove } from '../game/bot';
import { Settings } from '../game/settings';
import { PLAYERS } from '../game/theme';
import { Sound } from '../game/sound';
import { GameBoard, TurnRing } from './Board';
import { PieceIcon } from './PieceIcon';
import { cn } from '../utils/cn';

// ---------------- state ----------------

interface CapturedEntry { type: PieceType; owner: number }

interface RPlayer {
  kind: 'human' | 'bot';
  difficulty: BotDifficulty;
  name: string;
  status: 'active' | 'out';
  timeLeft: number | null;
  captured: CapturedEntry[];
  outReason?: string;
}

interface LogEntry { text: string; color: number; event?: boolean }

interface GState {
  board: Board;
  players: RPlayer[];
  turn: number;
  lastMove: Move | null;
  log: LogEntry[];
  winner: number | null;
  winReason: string;
  version: number;
  kingHunt: boolean;
  commandeer: boolean;
  moveCount: number;
}

type Action =
  | { type: 'MOVE'; move: Move }
  | { type: 'TICK'; ms: number }
  | { type: 'ELIMINATE'; player: number; reason: string };

const aliveArr = (players: RPlayer[]): boolean[] => players.map(p => p.status === 'active');
const clonePlayers = (ps: RPlayer[]): RPlayer[] => ps.map(p => ({ ...p, captured: [...p.captured] }));

function eliminatePlayer(gs: GState, victim: number, eliminator: number | null, reason: string) {
  if (gs.players[victim].status === 'out') return;
  const pl = gs.players[victim];
  pl.status = 'out';
  pl.outReason = reason;
  const claimed = gs.commandeer && eliminator !== null && gs.players[eliminator!]?.status === 'active';
  let claimedCount = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = gs.board[r][c];
      if (p && p.owner === victim) {
        if (p.type === 'k') gs.board[r][c] = null;
        else if (claimed) { p.owner = eliminator!; claimedCount++; }
      }
    }
  }
  gs.log.push({
    text: claimed
      ? `${pl.name} falls to ${reason} — ${gs.players[eliminator!].name} seizes ${claimedCount} pieces!`
      : `${pl.name} falls — ${reason}.`,
    color: victim,
    event: true,
  });
}

function nextTurnFrom(players: RPlayer[], from: number): number {
  for (let i = 1; i <= 4; i++) {
    const t = (from + i) % 4;
    if (players[t].status === 'active') return t;
  }
  return from;
}

/** Eliminate every living player whose kings are gone, mated or stalemated — chains until stable. */
function processFallen(gs: GState, eliminator: number | null) {
  for (let guard = 0; guard < 20; guard++) {
    const alive = aliveArr(gs.players);
    let hit: { p: number; why: string } | null = null;
    for (let p = 0; p < 4; p++) {
      if (!alive[p]) continue;
      const cond = playerCondition(gs.board, p, gs.kingHunt, alive);
      if (cond === 'dead') { hit = { p, why: 'all kings lost' }; break; }
      if (cond === 'mate') { hit = { p, why: 'checkmate — a king has no escape' }; break; }
      if (cond === 'stalemate') { hit = { p, why: 'stalemate' }; break; }
    }
    if (!hit) return;
    eliminatePlayer(gs, hit.p, eliminator, hit.why);
  }
}

function finishIfOver(gs: GState): boolean {
  const aliveIdx = gs.players.map((p, i) => (p.status === 'active' ? i : -1)).filter(i => i >= 0);
  if (aliveIdx.length <= 1) {
    gs.winner = aliveIdx.length === 1 ? aliveIdx[0] : null;
    gs.winReason = gs.winner !== null
      ? 'Every rival crown has fallen — the last empire stands.'
      : 'No kings remain on the board.';
    gs.log.push({
      text: gs.winner !== null ? `${gs.players[gs.winner].name} triumphs and takes the arena!` : 'Mutual destruction — no victor.',
      color: gs.winner ?? 0,
      event: true,
    });
    return true;
  }
  return false;
}

function reducer(gs: GState, action: Action): GState {
  if (action.type === 'MOVE') {
    if (gs.winner !== null) return gs;
    const mover = gs.turn;
    if (gs.players[mover].status !== 'active') return gs;
    const next: GState = {
      ...gs, players: clonePlayers(gs.players), log: [...gs.log],
      version: gs.version + 1, moveCount: gs.moveCount + 1,
    };
    const res = applyMoveClone(gs.board, action.move);
    next.board = res.board;
    if (res.captured) next.players[mover].captured.push({ type: res.captured.type, owner: res.captured.owner });
    next.lastMove = action.move;

    const logIdx = next.log.length;

    // MULTI-KING RULE: capturing ANY king eliminates its entire team immediately
    if (res.captured && res.captured.type === 'k') {
      const victim = res.captured.owner;
      if (victim !== mover && next.players[victim].status === 'active') {
        eliminatePlayer(next, victim, mover, 'a captured king');
      }
    }

    processFallen(next, mover);

    const alive = aliveArr(next.players);
    let suffix = '';
    for (let o = 0; o < 4; o++) {
      if (o !== mover && alive[o] && playerCondition(next.board, o, next.kingHunt, alive) === 'check') { suffix = '+'; break; }
    }
    next.log.splice(logIdx, 0, { text: moveNotation(action.move, res.promoted, suffix), color: mover });

    if (!finishIfOver(next)) next.turn = nextTurnFrom(next.players, mover);
    return next;
  }

  if (action.type === 'TICK') {
    if (gs.winner !== null) return gs;
    const t = gs.turn;
    const cur = gs.players[t];
    if (cur.status !== 'active' || cur.timeLeft === null) return gs;
    const tl = Math.max(0, cur.timeLeft - action.ms / 1000);
    if (tl > 0) {
      const players = clonePlayers(gs.players);
      players[t].timeLeft = tl;
      return { ...gs, players };
    }
    const next: GState = {
      ...gs, players: clonePlayers(gs.players), log: [...gs.log],
      version: gs.version + 1, board: cloneBoard(gs.board),
    };
    next.players[t].timeLeft = 0;
    eliminatePlayer(next, t, null, 'flag fall');
    if (!finishIfOver(next)) next.turn = nextTurnFrom(next.players, t);
    return next;
  }

  if (gs.winner !== null) return gs;
  const next: GState = {
    ...gs, players: clonePlayers(gs.players), log: [...gs.log],
    version: gs.version + 1, board: cloneBoard(gs.board),
  };
  eliminatePlayer(next, action.player, null, action.reason);
  if (!finishIfOver(next)) {
    if (gs.turn === action.player) next.turn = nextTurnFrom(next.players, gs.turn);
  }
  return next;
}

function initGame(settings: Settings): GState {
  const realSetup = settings.setup ?? standardSetup();

  const players: RPlayer[] = settings.seats.map((s, i) => ({
    kind: s.kind,
    difficulty: s.difficulty,
    name: s.name.trim() || (s.kind === 'bot' ? `Bot ${PLAYERS[i].label}` : `Player ${PLAYERS[i].name}`),
    status: 'active' as const,
    timeLeft: settings.timeSec,
    captured: [],
  }));

  const gs: GState = {
    board: cloneBoard(realSetup.board),
    players,
    turn: 0,
    lastMove: null,
    log: [],
    winner: null,
    winReason: '',
    version: 0,
    kingHunt: settings.kingHunt,
    commandeer: settings.commandeer,
    moveCount: 0,
  };
  // guard against 0-king custom setups
  processFallen(gs, null);
  if (!finishIfOver(gs)) gs.turn = nextTurnFrom(gs.players, 3);
  return gs;
}

const fmt = (s: number | null) => {
  if (s === null) return '';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
};

// ---------------- component ----------------

interface Props {
  settings: Settings;
  onRestart: () => void;
  onExit: () => void;
}

export function GameScreen({ settings, onRestart, onExit }: Props) {
  const [gs, dispatch] = useReducer(reducer, settings, initGame);
  const [sel, setSel] = useState<Vec | null>(null);
  const [botSpeed, setBotSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [modalDismissed, setModalDismissed] = useState(false);

  const gsRef = useRef(gs);
  gsRef.current = gs;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const alive = useMemo(() => aliveArr(gsRef.current.players), [gs.version]);
  const current = gs.players[gs.turn];
  const humanTurn = gs.winner === null && current.status === 'active' && current.kind === 'human';

  const conditions: PlayerCondition[] = useMemo(
    () => gsRef.current.players.map((_, i) =>
      aliveArr(gsRef.current.players)[i]
        ? playerCondition(gsRef.current.board, i, gsRef.current.kingHunt, aliveArr(gsRef.current.players))
        : 'dead'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gs.version]
  );

  const checkSquares = useMemo(() => {
    const out: Vec[] = [];
    const brd = gsRef.current.board;
    const al = aliveArr(gsRef.current.players);
    for (let i = 0; i < 4; i++) {
      if (!al[i]) continue;
      if (conditions[i] !== 'check' && conditions[i] !== 'mate') continue;
      for (const k of findKings(brd, i)) {
        if (isAttacked(brd, k.r, k.c, i, al)) out.push(k);
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditions, gs.version]);

  const legalTargets = useMemo(() => {
    if (!sel || !humanTurn) return null;
    const moves = allLegalMoves(gs.board, gs.turn, gs.kingHunt, alive);
    return moves.filter(m => m.from.r === sel.r && m.from.c === sel.c);
  }, [sel, humanTurn, gs.board, gs.turn, gs.kingHunt, alive, gs.version]);

  useEffect(() => { setSel(null); setConfirmResign(false); }, [gs.version, gs.turn]);

  useEffect(() => {
    const g = gsRef.current;
    const cur = g.players[g.turn];
    if (g.winner !== null || cur.status !== 'active' || cur.kind !== 'bot') return;
    const id = setTimeout(() => {
      const gg = gsRef.current;
      const cc = gg.players[gg.turn];
      if (gg.winner !== null || cc.kind !== 'bot' || cc.status !== 'active') return;
      const m = chooseBotMove(gg.board, gg.turn, cc.difficulty, gg.kingHunt, gg.players.map(p => p.status === 'active'));
      if (m) {
        if (m.capturedId !== undefined) Sound.capture(); else Sound.move();
        const src = gg.board[m.from.r][m.from.c];
        if (src && isPromoMove(src, m.to.r, m.to.c)) Sound.promote();
        dispatch({ type: 'MOVE', move: m });
      }
    }, 720 / botSpeed + Math.random() * 320);
    return () => clearTimeout(id);
  }, [gs.version, gs.turn, gs.winner, botSpeed]);

  useEffect(() => {
    if (gs.winner !== null || settings.timeSec === null) return undefined;
    const id = setInterval(() => dispatch({ type: 'TICK', ms: 100 }), 100);
    return () => clearInterval(id);
  }, [gs.winner === null, settings.timeSec]);

  const lastLogLen = useRef(0);
  useEffect(() => {
    if (gs.log.length > lastLogLen.current) {
      const fresh = gs.log.slice(lastLogLen.current);
      lastLogLen.current = gs.log.length;
      if (gs.winner === null && fresh.some(e => e.event && e.text.includes('falls'))) Sound.eliminate();
      else if (fresh.some(e => e.text.endsWith('+'))) Sound.check();
    }
  }, [gs.log, gs.winner]);

  const winnerSoundPlayed = useRef(false);
  useEffect(() => {
    if (gs.winner !== null && !winnerSoundPlayed.current) {
      winnerSoundPlayed.current = true;
      Sound.win();
    }
  }, [gs.winner]);

  const startedRef = useRef(false);
  useEffect(() => { if (!startedRef.current) { startedRef.current = true; Sound.start(); } }, []);

  const curSecs = current.timeLeft !== null ? Math.ceil(current.timeLeft) : null;
  const prevSecs = useRef<number | null>(null);
  useEffect(() => {
    if (curSecs !== null && curSecs <= 10 && curSecs > 0 && curSecs !== prevSecs.current && current.kind === 'human') Sound.tick();
    prevSecs.current = curSecs;
  }, [curSecs]);

  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [gs.log.length]);
  useEffect(() => { Sound.enabled = !muted; }, [muted]);

  const onSquare = (r: number, c: number) => {
    if (!humanTurn) return;
    if (sel) {
      const mv = legalTargets?.find(m => m.to.r === r && m.to.c === c);
      if (mv) {
        if (mv.capturedId !== undefined) Sound.capture(); else Sound.move();
        const src = gs.board[sel.r][sel.c];
        if (src && isPromoMove(src, r, c)) Sound.promote();
        dispatch({ type: 'MOVE', move: mv });
        setSel(null);
        return;
      }
    }
    const p = gs.board[r][c];
    if (p && p.owner === gs.turn && alive[p.owner]) {
      Sound.select();
      setSel(prev => (prev && prev.r === r && prev.c === c ? null : { r, c }));
    } else {
      setSel(null);
    }
  };

  const curP = PLAYERS[gs.turn];
  const winnerP = gs.winner !== null ? PLAYERS[gs.winner] : null;
  const anyBots = gs.players.some(p => p.kind === 'bot');

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden ... lg:h-screen lg:overflow-hidden lg:flex-row">
        <aside className="order-2 w-full shrink-0 ... lg:order-1 lg:h-full lg:w-[352px] lg:overflow-y-auto ...">
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-200 to-amber-500 text-[#241A06]">
            <Crown className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
          </span>
          <div>
            <p className="font-display text-sm font-black tracking-[0.18em] text-amber-100">FOUR KINGS</p>
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
              {settings.timeSec ? `Clock · ${fmt(settings.timeSec)} each` : 'No clock'} · {settings.kingHunt ? 'King hunt' : 'Classic'} · multi-king
            </p>
          </div>
        </div>

        <div className="space-y-2.5 p-4">
          {gs.players.map((p, i) => {
            const P = PLAYERS[i];
            const active = gs.winner === null && gs.turn === i && p.status === 'active';
            const cond = conditions[i];
            const out = p.status === 'out';
            const lowTime = p.timeLeft !== null && p.timeLeft <= 20 && !out;
            const kingCount = findKings(gsRef.current.board, i).length;
            const matPts = Math.round(p.captured.reduce((s, e) => s + ({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }[e.type] as number), 0));
            return (
              <div
                key={i}
                className={cn('relative rounded-xl border p-3 transition-all duration-300')}
                style={{
                  borderColor: active ? P.main : 'rgba(255,255,255,0.06)',
                  background: active ? `${P.main}14` : 'rgba(255,255,255,0.02)',
                  boxShadow: active ? `0 0 22px ${P.main}30, inset 3px 0 0 ${P.main}` : 'inset 3px 0 0 rgba(255,255,255,0.08)',
                  opacity: out ? 0.55 : 1,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full" style={{ background: out ? '#4b5563' : P.main, boxShadow: out ? 'none' : `0 0 8px ${P.main}` }} />
                  <span className="truncate text-sm font-bold" style={{ color: out ? '#64748b' : P.light }}>{p.name}</span>
                  <span className="flex items-center gap-1 rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {p.kind === 'human' ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                    {p.kind === 'human' ? 'Human' : p.difficulty === 'normal' ? 'Sharp' : 'Casual'}
                  </span>
                  {!out && (
                    <span className="ml-1 flex items-center gap-1 rounded bg-white/10 px-1 py-0.5 text-[10px] font-bold">
                      <Crown className="h-3 w-3" /> {kingCount}
                    </span>
                  )}
                  <span className="ml-auto" />
                  {p.timeLeft !== null && (
                    <span className={cn('flex items-center gap-1 font-mono text-sm font-bold tabular-nums', lowTime ? 'animate-pulse text-rose-400' : 'text-slate-300')}>
                      <Hourglass className="h-3.5 w-3.5 opacity-60" />
                      {fmt(p.timeLeft)}
                    </span>
                  )}
                </div>

                <div className="mt-1.5 flex min-h-[18px] items-center gap-2">
                  {out ? (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <Skull className="h-3.5 w-3.5" /> Eliminated · {p.outReason}
                    </span>
                  ) : cond === 'check' ? (
                    <span className="animate-pulse rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-rose-300">Check! ({kingCount}♔)</span>
                  ) : active && p.kind === 'bot' ? (
                    <span className="text-[11px] italic text-slate-500">plotting…</span>
                  ) : active ? (
                    <span className="text-[11px] italic text-slate-500">to move · {kingCount} king{kingCount===1?'':'s'}</span>
                  ) : <span className="text-[11px] text-slate-600">{kingCount} king{kingCount===1?'':'s'}</span>}
                  {p.captured.length > 0 && (
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="flex items-center" style={{ maxWidth: 150, overflow: 'hidden' }}>
                        {p.captured.slice(0, 10).map((e, j) => (
                          <span key={j} className="-ml-1 inline-block h-4 w-4 first:ml-0">
                            <PieceIcon type={e.type} colorIdx={alive[e.owner] ? e.owner : -1} className="h-full w-full opacity-80" />
                          </span>
                        ))}
                      </span>
                      {p.captured.length > 10 && <span className="text-[10px] text-slate-500">+{p.captured.length - 10}</span>}
                      {matPts > 0 && <span className="font-mono text-[10px] font-bold text-emerald-400/90">+{matPts}</span>}
                    </span>
                  )}
                </div>

                {active && !out && (
                  <motion.div layoutId="turnGlow" className="pointer-events-none absolute inset-0 rounded-xl"
                    style={{ boxShadow: `inset 0 0 0 1px ${P.main}55` }} transition={{ duration: 0.3 }} />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <button onClick={() => setMuted(m => !m)} title="Sound"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 transition-colors hover:text-amber-200">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          {anyBots && (
            <button onClick={() => setBotSpeed(s => (s === 1 ? 2 : s === 2 ? 4 : 1))} title="Bot speed"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-xs font-bold text-slate-400 transition-colors hover:text-amber-200">
              <Gauge className="h-4 w-4" /> {botSpeed}×
            </button>
          )}
          {humanTurn && (
            <button
              onClick={() => {
                if (confirmResign) {
                  dispatch({ type: 'ELIMINATE', player: gs.turn, reason: 'resignation' });
                  Sound.eliminate();
                  setConfirmResign(false);
                } else {
                  setConfirmResign(true);
                  setTimeout(() => setConfirmResign(false), 2600);
                }
              }}
              className={cn(
                'flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors',
                confirmResign ? 'border-rose-400/60 bg-rose-500/15 text-rose-200' : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-rose-200'
              )}>
              <Flag className="h-4 w-4" /> {confirmResign ? 'Sure?' : 'Resign'}
            </button>
          )}
          <span className="ml-auto" />
          <button onClick={onRestart} title="Restart battle"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 transition-colors hover:text-amber-200">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button onClick={onExit} title="Back to menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 transition-colors hover:text-amber-200">
            <Home className="h-4 w-4" />
          </button>
        </div>

        <div className="border-t border-white/[0.06] px-4 pb-5 pt-3">
          <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
            <Swords className="h-3 w-3" /> Battle log
          </p>
          <div ref={logRef} className="log-scroll max-h-44 space-y-1 overflow-y-auto pr-1 lg:max-h-[26vh]">
            {gs.log.length === 0 && <p className="text-xs italic text-slate-600">The arena awaits the first strike… any king taken = team wipe.</p>}
            {gs.log.map((e, i) => (
              <div key={i} className={cn('flex items-baseline gap-2 text-xs', e.event && 'my-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1.5')}>
                {!e.event && <span className="w-6 shrink-0 text-right font-mono text-[10px] text-slate-600">{(i + 1).toString().padStart(2, '0')}</span>}
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: PLAYERS[e.color]?.main ?? '#666' }} />
                <span className={cn(e.event ? 'font-semibold text-amber-100/90' : 'font-mono text-slate-300')}>{e.text}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="relative order-1 flex flex-1 items-center justify-center p-4 sm:p-8 lg:order-2 lg:overflow-hidden">
        <div className="pointer-events-none absolute inset-0 transition-all duration-700"
          style={{ background: `radial-gradient(55% 45% at 50% 50%, ${curP.main}14, transparent 70%)` }} />
        <div className="relative flex flex-col items-center">
          <div className="mb-5 flex h-9 items-center gap-2.5">
            {gs.winner === null ? (
              <motion.div key={gs.turn + '-' + gs.version} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: curP.main, boxShadow: `0 0 8px ${curP.main}` }} />
                <span className="text-sm font-semibold" style={{ color: curP.light }}>{current.name}</span>
                <span className="text-xs text-slate-500">{current.kind === 'bot' ? 'is thinking…' : '— your move'}</span>
              </motion.div>
            ) : (
              <div className="flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-1.5 text-sm font-bold text-amber-200">
                <Crown className="h-4 w-4" /> {winnerP ? `${gs.players[gs.winner!].name} rules the arena` : 'The war is over'}
              </div>
            )}
          </div>

          <div className="relative">
            <TurnRing turn={gs.turn} winner={gs.winner} />
            <GameBoard
              board={gs.board}
              alive={alive}
              selected={sel}
              targets={humanTurn ? legalTargets : null}
              lastMove={gs.lastMove}
              checkSquares={checkSquares}
              interactive={humanTurn}
              size="min(88vw, min(78vh, 760px))"
              onSquare={onSquare}
            />
          </div>

          <p className="mt-5 h-4 text-[10px] uppercase tracking-[0.3em] text-slate-600">
            Move {Math.floor(gs.moveCount / 4) + 1} · any king lost = elimination · Red → Blue → Amber → Green
          </p>
        </div>

        <AnimatePresence>
          {gs.winner !== null && !modalDismissed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.85, y: 30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                className="w-full max-w-md rounded-3xl border p-8 text-center"
                style={{
                  background: 'linear-gradient(180deg,#141821 0%,#0C0F16 100%)',
                  borderColor: winnerP ? `${winnerP.main}55` : 'rgba(255,255,255,0.1)',
                  boxShadow: winnerP ? `0 0 80px ${winnerP.main}30, 0 30px 60px rgba(0,0,0,0.6)` : '0 30px 60px rgba(0,0,0,0.6)',
                }}>
                <motion.div initial={{ rotate: -12, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 14 }}
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: winnerP ? `linear-gradient(135deg, ${winnerP.light}, ${winnerP.main})` : '#333', boxShadow: winnerP ? `0 0 40px ${winnerP.main}70` : 'none' }}>
                  <Crown className="h-8 w-8 text-[#101420]" />
                </motion.div>
                <p className="font-display text-xs font-bold uppercase tracking-[0.35em] text-slate-400">Victory</p>
                <h2 className="mt-2 font-display text-3xl font-black tracking-tight" style={{ color: winnerP?.light ?? '#e2e8f0' }}>
                  {gs.winner !== null ? gs.players[gs.winner].name.toUpperCase() : 'NO VICTOR'}
                </h2>
                <p className="mt-2 text-sm text-slate-400">{gs.winReason}</p>
                <p className="mt-4 text-[11px] uppercase tracking-[0.25em] text-slate-600">
                  {gs.moveCount} moves · {gs.players.filter(p => p.status === 'out').length} empires destroyed
                </p>
                <div className="mt-7 flex flex-col gap-2.5">
                  <button onClick={onRestart}
                    className="rounded-xl px-5 py-3 font-display text-sm font-black uppercase tracking-[0.2em] text-[#241A06] shadow-[0_10px_30px_rgba(232,196,104,0.3)] transition-transform hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg,#FFE9AE,#E8C468 45%,#C99A35)' }}>Battle again</button>
                  <div className="flex gap-2.5">
                    <button onClick={() => setModalDismissed(true)}
                      className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 transition-colors hover:border-white/25">View board</button>
                    <button onClick={onExit}
                      className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 transition-colors hover:border-white/25">New war</button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
