import { motion } from 'framer-motion';
import { activeTeamIds, teamsOf, TEAM_INFO, type Settings } from '../game/settings';
import { teamCaptures, teamPoints, type MatchState } from '../game/match';
import { PLAYERS } from '../game/theme';
import { cn } from '../utils/cn';
import type { PieceType } from '../game/engine';

const ORDER: PieceType[] = ['p', 'n', 'b', 'r', 'q', 'k'];
const GLYPH: Record<PieceType, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };

export default function GameOverModal({
  settings,
  state,
  onRestart,
  onMenu,
}: {
  settings: Settings;
  state: MatchState;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const result = state.result;
  if (!result) return null;

  const teams = teamsOf(settings);
  const teamMode = settings.mode === 'team';
  const ids = activeTeamIds(settings);

  const winners = result.winningTeam === null ? [] : teams.map((t, i) => (t === result.winningTeam ? i : -1)).filter(i => i >= 0);

  const accent =
    result.winningTeam === null
      ? '#94a3b8'
      : teamMode
        ? TEAM_INFO[result.winningTeam].color
        : PLAYERS[result.winningTeam].main;

  const headline =
    result.winningTeam === null
      ? 'Draw'
      : teamMode
        ? `${TEAM_INFO[result.winningTeam].name} wins!`
        : `${settings.seats[result.winningTeam].name} wins!`;

  const board = state.stats
    .map((s, i) => ({ ...s, seat: i }))
    .sort((a, b) => b.points - a.points || b.totalCaptures - a.totalCaptures || a.seat - b.seat);

  const teamRows = ids
    .map(t => ({
      team: t,
      pts: teamPoints(state.stats, settings, t),
      caps: teamCaptures(state.stats, settings, t),
      alive: teams.some((tt, i) => tt === t && state.alive[i]),
    }))
    .sort((a, b) => b.pts - a.pts);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className="my-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl"
      >
        {/* winner banner */}
        <div
          className="relative px-6 py-7 text-center"
          style={{ background: `linear-gradient(160deg, ${accent}33, rgba(15,23,42,0) 70%)` }}
        >
          <div className="text-4xl">{result.winningTeam === null ? '🤝' : '👑'}</div>
          <h2 className="mt-2 text-3xl font-black tracking-tight" style={{ color: accent }}>
            {headline}
          </h2>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            {result.headline} · {result.method === 'points' ? 'Point increments' : 'Classic survival'}
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">{result.reason}</p>

          {teamMode && winners.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Every member wins:
              </span>
              {winners.map(i => (
                <span
                  key={i}
                  className="rounded-full border px-3 py-1 text-xs font-bold"
                  style={{ borderColor: `${PLAYERS[i].main}66`, color: PLAYERS[i].main, background: `${PLAYERS[i].main}18` }}
                >
                  {settings.seats[i].name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5 px-5 pb-6">
          {/* team standings */}
          {teamMode && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Team standings
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {teamRows.map(row => {
                  const info = TEAM_INFO[row.team];
                  const isWinner = row.team === result.winningTeam;
                  return (
                    <div
                      key={row.team}
                      className={cn(
                        'rounded-xl border p-3',
                        isWinner ? 'shadow-[0_0_0_1px_rgba(255,255,255,.12)]' : '',
                      )}
                      style={{ borderColor: `${info.color}55`, background: info.soft }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold" style={{ color: info.color }}>
                          {info.name} {isWinner && '👑'}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                          {row.alive ? 'Survived' : 'Eliminated'}
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-4">
                        <div>
                          <div className="text-2xl font-black tabular-nums text-white">{row.pts}</div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">points</div>
                        </div>
                        <div>
                          <div className="text-2xl font-black tabular-nums text-white">{row.caps}</div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">pieces eaten</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* player leaderboard */}
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Leaderboard
            </h3>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-white/[0.04] text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Player</th>
                    {teamMode && <th className="px-3 py-2">Team</th>}
                    <th className="px-3 py-2 text-right">Points</th>
                    <th className="px-3 py-2 text-right">Eaten</th>
                    <th className="px-3 py-2">Breakdown</th>
                    <th className="px-3 py-2 text-right">Checks</th>
                    <th className="px-3 py-2 text-right">Mates</th>
                  </tr>
                </thead>
                <tbody>
                  {board.map((row, idx) => {
                    const p = PLAYERS[row.seat];
                    const isWinner = teams[row.seat] === result.winningTeam;
                    return (
                      <tr
                        key={row.seat}
                        className={cn(
                          'border-t border-white/5',
                          isWinner ? 'bg-emerald-400/[0.07]' : idx % 2 ? 'bg-white/[0.015]' : '',
                        )}
                      >
                        <td className="px-3 py-2 font-bold tabular-nums text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base" style={{ color: p.main }}>♚</span>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-slate-100">
                                {settings.seats[row.seat].name}
                              </div>
                              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                                {p.name} · {state.alive[row.seat] ? 'survived' : 'eliminated'}
                              </div>
                            </div>
                          </div>
                        </td>
                        {teamMode && (
                          <td className="px-3 py-2">
                            <span
                              className="rounded-md px-2 py-0.5 text-[10px] font-bold"
                              style={{
                                background: TEAM_INFO[teams[row.seat]].soft,
                                color: TEAM_INFO[teams[row.seat]].color,
                              }}
                            >
                              {TEAM_INFO[teams[row.seat]].name}
                            </span>
                          </td>
                        )}
                        <td className="px-3 py-2 text-right text-base font-black tabular-nums text-emerald-300">
                          {row.points}
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-200">
                          {row.totalCaptures}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1.5">
                            {ORDER.filter(t => row.captures[t] > 0).map(t => (
                              <span
                                key={t}
                                className="flex items-center gap-0.5 rounded bg-white/[0.06] px-1.5 py-0.5 text-xs text-slate-200"
                              >
                                <span>{GLYPH[t]}</span>
                                <span className="tabular-nums">×{row.captures[t]}</span>
                              </span>
                            ))}
                            {row.totalCaptures === 0 && <span className="text-xs text-slate-600">—</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-300">{row.checks}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-300">{row.mates}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-1">
            <button
              onClick={onRestart}
              className="rounded-xl bg-gradient-to-r from-purple-500 to-cyan-500 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:brightness-110"
            >
              Rematch
            </button>
            <button
              onClick={onMenu}
              className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold uppercase tracking-wider text-slate-200 transition hover:bg-white/10"
            >
              Back to menu
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
