// src/components/GameScreen.tsx
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { findKings, isAttacked, PIECE_NAME, type PieceType, type Vec } from '../game/engine';
import { chooseBotMove } from '../game/bot';
import { Sound } from '../game/sound';
import {
  activeTeamIds,
  SCORING_FIELDS,
  TEAM_INFO,
  teamsOf,
  type Settings,
} from '../game/settings';
import { createMatch, ctxOf, makeReducer, teamCaptures, teamPoints } from '../game/match';
import { PLAYERS, fmtClock } from '../game/theme';
import { cn } from '../utils/cn';
import Board from './Board';
import GameOverModal from './GameOverModal';

const CAP_ORDER: PieceType[] = ['p', 'n', 'b', 'r', 'q', 'k'];
const GLYPH: Record<PieceType, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };

export default function GameScreen({
  settings,
  onRestart,
  onExit,
}: {
  settings: Settings;
  onRestart: () => void;
  onExit: () => void;
}) {
  const reducer = useMemo(() => makeReducer(settings), [settings]);
  const [state, dispatch] = useReducer(reducer, settings, createMatch);
  const [showRules, setShowRules] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const teams = useMemo(() => teamsOf(settings), [settings]);
  const teamMode = settings.mode === 'team';
  const ctx = useMemo(() => ctxOf(state.alive, settings), [state.alive, settings]);
  const teamIds = useMemo(() => activeTeamIds(settings), [settings]);

  const checkedKings = useMemo(() => {
    const out: Vec[] = [];
    for (let p = 0; p < 4; p++) {
      if (!state.alive[p]) continue;
      for (const k of findKings(state.board, p)) {
        if (isAttacked(state.board, k.r, k.c, p, ctx)) out.push(k);
      }
    }
    return out;
  }, [state.board, state.alive, ctx]);

  const bot = settings.seats[state.turn].kind === 'bot';
  const myTurn = !state.over && state.alive[state.turn];
  const interactive = myTurn && !bot;

  // ---- bots ----
  useEffect(() => {
    if (!myTurn || !bot) return;
    const t = setTimeout(() => {
      const move = chooseBotMove(
        state.board,
        state.turn,
        ctx,
        settings.seats[state.turn].difficulty,
        state.scoring,
        settings.winCondition === 'points',
      );
      if (move) dispatch({ type: 'move', move });
      else dispatch({ type: 'resign', player: state.turn });
    }, settings.seats[state.turn].difficulty === 'normal' ? 120 : 420); // sharp bots spend their time thinking
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTurn, bot, state.ply, state.turn]);

  // ---- clock ----
  useEffect(() => {
    if (settings.timeSec === null || state.over) return;
    const id = setInterval(() => dispatch({ type: 'tick', dt: 0.25 }), 250);
    return () => clearInterval(id);
  }, [settings.timeSec, state.over]);

  // ---- sounds ----
  const lastEntry = state.log[state.log.length - 1];
  const lastId = lastEntry?.id ?? 0;
  const prevLogId = useRef(0);
  useEffect(() => {
    if (lastId === 0 || lastId === prevLogId.current) return;
    prevLogId.current = lastId;
    if (!lastEntry) return;
    if (lastEntry.text.includes('x')) Sound.capture();
    else if (lastEntry.text.includes('=')) Sound.promote();
    else Sound.move();
    if (lastEntry.note.includes('checkmate')) Sound.eliminate();
  }, [lastId, lastEntry]);

  const prevAlive = useRef(state.alive);
  useEffect(() => {
    if (prevAlive.current.some((a, i) => a && !state.alive[i])) Sound.eliminate();
    prevAlive.current = state.alive;
  }, [state.alive]);

  useEffect(() => {
    if (state.over) Sound.win();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.over]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.log.length]);

  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: 'dismissToast' }), 1500);
    return () => clearTimeout(t);
  }, [state.toast]);

  const onSquare = (sq: Vec) => {
    if (!interactive) return;
    const hit = state.legal.find(m => m.to.r === sq.r && m.to.c === sq.c);
    if (hit) {
      dispatch({ type: 'move', move: hit });
      return;
    }
    const piece = state.board[sq.r][sq.c];
    if (state.selected?.r === sq.r && state.selected?.c === sq.c) {
      dispatch({ type: 'clear' });
      return;
    }
    if (piece && piece.owner === state.turn) Sound.select();
    dispatch({ type: 'select', sq });
  };

  const leader = Math.max(...teamIds.map(t => teamPoints(state.stats, settings, t)), 1);

  return (
    <div className="mx-auto max-w-[1500px] px-3 py-4">
      {/* top bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-black uppercase tracking-[0.2em] text-amber-300">Four Kings</span>
          <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">
            {teamMode ? `Team Mode · ${teamIds.map(t => TEAM_INFO[t]?.name).join(' vs ')}` : 'Free-for-all'}
          </span>
          <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">
            {settings.winCondition === 'points' ? 'Win: most points' : 'Win: last surviving'}
          </span>
          {settings.winCondition === 'points' && settings.pointsToWin > 0 && (
            <span className="rounded-md bg-sky-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-200">
              Target {settings.pointsToWin}
            </span>
          )}
          {settings.setup && (
            <span className="rounded-md bg-fuchsia-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-fuchsia-200">
              Army Forge
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowRules(v => !v)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition',
              showRules
                ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-200'
                : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10',
            )}
          >
            ⚙ Point rules
          </button>
          {interactive && (
            <button
              onClick={() => dispatch({ type: 'resign', player: state.turn })}
              className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-200 transition hover:bg-rose-400/20"
            >
              Resign
            </button>
          )}
          <button
            onClick={onRestart}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300 transition hover:bg-white/10"
          >
            ⟲ Restart
          </button>
          <button
            onClick={onExit}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300 transition hover:bg-white/10"
          >
            Menu
          </button>
        </div>
      </div>

      {/* live rule editor */}
      <AnimatePresence initial={false}>
        {showRules && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200">
                    Edit points during gameplay
                  </h3>
                  <p className="text-xs text-slate-500">
                    Applies to every capture and check from the next move on.
                  </p>
                </div>
                <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Move {state.ply}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SCORING_FIELDS.map(f => (
                  <label key={f.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                      <span className="text-base leading-none">{f.glyph}</span>
                      <span className="truncate">{f.label}</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={state.scoring[f.key]}
                      onChange={e =>
                        dispatch({
                          type: 'scoring',
                          scoring: {
                            ...state.scoring,
                            [f.key]: Math.max(0, Math.min(999, parseInt(e.target.value, 10) || 0)),
                          },
                        })
                      }
                      className="mt-1 h-7 w-full rounded-md border border-white/10 bg-slate-950/60 text-center text-sm font-bold tabular-nums text-emerald-300 outline-none focus:border-emerald-400/60"
                    />
                  </label>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        {/* ---------- left: seats ---------- */}
        <div className="space-y-2">
          {teamMode && (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Team score</h3>
              {teamIds.map(t => {
                const info = TEAM_INFO[t];
                const pts = teamPoints(state.stats, settings, t);
                const alive = teams.some((tt, i) => tt === t && state.alive[i]);
                return (
                  <div key={t} className="rounded-xl p-2" style={{ background: info.soft }}>
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span style={{ color: info.color }}>{info.name}</span>
                      <span className="tabular-nums text-slate-200">
                        {pts} pts · {teamCaptures(state.stats, settings, t)} eaten
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-950/60">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: info.color }}
                        animate={{ width: `${(pts / leader) * 100}%` }}
                      />
                    </div>
                    {!alive && (
                      <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                        Eliminated
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {[0, 1, 2, 3].map(i => {
            const seat = settings.seats[i];
            const P = PLAYERS[i];
            const alive = state.alive[i];
            const active = state.turn === i && !state.over;
            const st = state.stats[i];
            return (
              <div
                key={i}
                className={cn(
                  'rounded-2xl border p-2.5 transition',
                  active ? 'border-amber-300/50 bg-white/[0.06]' : 'border-white/10 bg-white/[0.03]',
                  !alive && 'opacity-50',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none" style={{ color: alive ? P.main : '#64748b' }}>♚</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-200">{seat.name}</div>
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                      <span>{P.name}</span>
                      {seat.kind === 'bot' && <span>· {seat.difficulty === 'normal' ? 'sharp' : 'casual'}</span>}
                      {teamMode && (
                        <span className="font-bold" style={{ color: TEAM_INFO[teams[i]].color }}>
                          · {TEAM_INFO[teams[i]].name}
                        </span>
                      )}
                    </div>
                  </div>
                  {settings.timeSec !== null && (
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 font-mono text-xs font-bold tabular-nums',
                        active ? 'bg-amber-300 text-slate-950' : 'bg-slate-950/60 text-slate-400',
                        alive && (state.clocks[i] ?? 99) < 30 && active && 'bg-rose-500/80 text-white',
                      )}
                    >
                      {fmtClock(state.clocks[i])}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-black tabular-nums text-emerald-300">{st.points} pts</span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {CAP_ORDER.filter(t => st.captures[t] > 0).map(t => (
                      <span
                        key={t}
                        title={`${st.captures[t]} ${PIECE_NAME[t]}${st.captures[t] > 1 ? 's' : ''} eaten`}
                        className="flex items-center gap-0.5 rounded bg-white/[0.06] px-1 text-[11px] text-slate-300"
                      >
                        {GLYPH[t]}
                        <span className="tabular-nums">{st.captures[t]}</span>
                      </span>
                    ))}
                    {st.totalCaptures === 0 && <span className="text-[10px] text-slate-600">no kills</span>}
                  </div>
                </div>

                {!alive ? (
                  <div className="mt-1.5 rounded bg-slate-950/60 px-1.5 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    Eliminated
                  </div>
                ) : state.conditions[i] === 'check' ? (
                  <div className="mt-1.5 rounded bg-rose-500/20 px-1.5 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-rose-300">
                    Check
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* ---------- centre: board ---------- */}
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: state.alive[state.turn] ? PLAYERS[state.turn].main : '#64748b' }}
              />
              <span className="font-semibold text-slate-200">{settings.seats[state.turn].name}</span>
              <span className="text-xs text-slate-500">to move</span>
              {bot && myTurn && <span className="animate-pulse text-[11px] text-slate-500">thinking…</span>}
            </div>
            <span className="text-[11px] text-slate-500">Move {state.ply}</span>
          </div>

          <div className="relative mx-auto w-full max-w-[720px]">
            <Board
              board={state.board}
              alive={state.alive}
              teams={teams}
              teamMode={teamMode}
              turn={state.turn}
              selected={state.selected}
              legal={state.legal}
              lastMove={state.lastMove}
              checkedKings={checkedKings}
              interactive={interactive}
              onSquare={onSquare}
            />
            <AnimatePresence>
              {state.toast && (
                <motion.div
                  key={state.toast.id}
                  initial={{ opacity: 0, y: 8, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-black text-slate-950 shadow-lg"
                  style={{ background: PLAYERS[state.toast.player].main }}
                >
                  +{state.toast.points} pts · {state.toast.label}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ---------- right: leaderboard + log ---------- */}
        <div className="space-y-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Leaderboard</h3>
            <div className="space-y-1">
              {state.stats
                .map((s, i) => ({ ...s, seat: i }))
                .sort((a, b) => b.points - a.points || b.totalCaptures - a.totalCaptures)
                .map((row, idx) => (
                  <div key={row.seat} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1 text-xs">
                    <span className="w-3 text-center font-bold text-slate-600">{idx + 1}</span>
                    <span style={{ color: PLAYERS[row.seat].main }}>♚</span>
                    <span className="min-w-0 flex-1 truncate text-slate-300">
                      {settings.seats[row.seat].name}
                    </span>
                    <span className="tabular-nums text-slate-500">{row.totalCaptures}🍴</span>
                    <span className="w-8 text-right font-black tabular-nums text-emerald-300">{row.points}</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Bounties in play
            </h3>
            <div className="flex flex-wrap gap-1">
              {SCORING_FIELDS.map(f => (
                <span key={f.key} className="flex items-center gap-1 rounded bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-slate-300">
                  {f.glyph}
                  <span className="font-bold tabular-nums text-emerald-300">{state.scoring[f.key]}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Move log</h3>
            <div ref={logRef} className="max-h-[380px] space-y-1 overflow-y-auto pr-1">
              {state.log.length === 0 && <p className="py-4 text-center text-[11px] text-slate-600">No moves yet.</p>}
              {state.log.map(e => (
                <div key={e.id} className="rounded-lg bg-white/[0.02] px-2 py-1 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-right tabular-nums text-slate-600">{e.id}</span>
                    <span style={{ color: PLAYERS[e.player].main }}>♚</span>
                    <span className="flex-1 font-mono text-slate-300">{e.text}</span>
                    {e.points > 0 && (
                      <span className="rounded bg-emerald-400/15 px-1 font-bold tabular-nums text-emerald-300">
                        +{e.points}
                      </span>
                    )}
                  </div>
                  {e.note && <div className="pl-7 text-[10px] italic text-slate-500">{e.note}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {state.over && (
        <GameOverModal
          settings={settings}
          state={state}
          onRestart={onRestart}
          onMenu={onExit}
        />
      )}
    </div>
  );
}
