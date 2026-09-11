// src/components/MenuScreen.tsx
import { useMemo, type ReactNode } from 'react';
import {
  CLOCKS,
  DEFAULT_SCORING,
  PLAYERS,
  PRESETS,
  SCORING_FIELDS,
  TEAM_INFO,
  TEAM_PRESETS,
  teamMembers,
  teamSplitLabel,
  type BotDifficulty,
  type Seat,
  type Settings,
} from '../game/settings';
import { cn } from '../utils/cn';

interface Props {
  settings: Settings;
  setSettings: (s: Settings) => void;
  onStart: () => void;
  onOpenEditor: () => void;
}

function Panel({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</h2>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
  accent = '#fbbf24',
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  accent?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
        active ? 'text-slate-950' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10',
      )}
      style={active ? { background: accent, borderColor: accent } : undefined}
    >
      {children}
    </button>
  );
}

function Toggle({
  on,
  onChange,
  title,
  desc,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  title: string;
  desc: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-200">{title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={cn('relative h-5 w-9 shrink-0 rounded-full transition', on ? 'bg-amber-400' : 'bg-slate-700')}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
            on ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function MenuScreen({ settings, setSettings, onStart, onOpenEditor }: Props) {
  const seats = settings.seats;
  const teamMode = settings.mode === 'team';
  const humans = useMemo(() => seats.filter(s => s.kind === 'human').length, [seats]);
  const bots = 4 - humans;
  const alpha = teamMembers(settings, 0).length;
  const omega = teamMembers(settings, 1).length;
  const badTeams = teamMode && (alpha === 0 || omega === 0);

  const setSeat = (i: number, patch: Partial<Seat>) =>
    setSettings({ ...settings, seats: seats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });

  const applyTeams = (teams: (0 | 1)[]) =>
    setSettings({
      ...settings,
      mode: 'team',
      seats: seats.map((s, i) => ({ ...s, team: teams[i] })),
    });

  const setScoring = (key: keyof Settings['scoring'], value: number) =>
    setSettings({
      ...settings,
      scoring: { ...settings.scoring, [key]: Math.max(0, Math.min(999, Math.round(value) || 0)) },
    });

  const customMinutes = settings.timeSec ? settings.timeSec / 60 : '';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* ---------- header ---------- */}
      <header className="mb-8 text-center">
        <div className="mb-1 flex items-center justify-center gap-1.5 text-3xl leading-none">
          {PLAYERS.map(p => (
            <span key={p.name} style={{ color: p.main }}>♚</span>
          ))}
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-100 sm:text-4xl">
          Four Kings <span className="text-slate-600">·</span>{' '}
          <span className="text-amber-300">Four-Player Chess Royale</span>
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          Last empire standing — or highest score. Add alliances, edit the point bounties, forge custom armies.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------- GAME MODE (feature 1) ---------- */}
        <Panel label="Game Mode" hint="Free-for-all royale or a two-team war.">
          <div className="mb-3 flex gap-2">
            <Chip active={!teamMode} accent="#fbbf24" onClick={() => setSettings({ ...settings, mode: 'ffa' })}>
              Free-for-All
            </Chip>
            <Chip active={teamMode} accent="#a855f7" onClick={() => setSettings({ ...settings, mode: 'team' })}>
              Team Mode
            </Chip>
          </div>

          {!teamMode ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs leading-relaxed text-slate-500">
              Four separate empires. Every crown plays for itself — the last army on the board wins.
              Allies don't exist: anything that isn't yours can be eaten.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {TEAM_PRESETS.map(p => {
                  const active = seats.every((s, i) => s.team === p.teams[i]);
                  return (
                    <Chip
                      key={p.label}
                      active={active}
                      accent="#a855f7"
                      title={p.detail}
                      onClick={() => applyTeams(p.teams)}
                    >
                      {p.label}
                    </Chip>
                  );
                })}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {([0, 1] as const).map(t => {
                  const info = TEAM_INFO[t];
                  const members = teamMembers(settings, t);
                  return (
                    <div
                      key={info.name}
                      className="rounded-xl border p-3"
                      style={{ borderColor: `${info.color}55`, background: info.soft }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold" style={{ color: info.color }}>{info.name}</span>
                        <span className="text-xs font-bold text-slate-300">
                          {members.length} member{members.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {members.map(i => (
                          <span
                            key={i}
                            className="rounded-md bg-slate-950/50 px-1.5 py-0.5 text-[11px] font-bold"
                            style={{ color: PLAYERS[i].main }}
                          >
                            {PLAYERS[i].name}
                          </span>
                        ))}
                        {members.length === 0 && (
                          <span className="text-[11px] italic text-rose-300">empty — pick a member below</span>
                        )}
                      </div>
                      <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                        {members.length > 0
                          ? 'All members win together when this team wins.'
                          : 'Both teams need at least one member.'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Panel>

        {/* ---------- WIN CONDITION (feature 2) ---------- */}
        <Panel label="Win Condition" hint="Classic survival or point increments.">
          <div className="mb-3 flex gap-2">
            <Chip
              active={settings.winCondition === 'classic'}
              accent="#22c55e"
              onClick={() => setSettings({ ...settings, winCondition: 'classic' })}
            >
              Classic (FFA survival)
            </Chip>
            <Chip
              active={settings.winCondition === 'points'}
              accent="#38bdf8"
              onClick={() => setSettings({ ...settings, winCondition: 'points' })}
            >
              Point increments
            </Chip>
          </div>

          {settings.winCondition === 'classic' ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs leading-relaxed text-slate-500">
              Winner = the side that <strong className="text-slate-300">survives last</strong>. Points are still
              tracked for the leaderboard, but they don't decide the match.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-3 text-xs leading-relaxed text-slate-400">
                Winner = the side that <strong className="text-sky-200">gains the most points</strong> when the game
                ends (captures, checks and checkmates all pay out). Bounties are editable below.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Target score</span>
                <input
                  type="number"
                  min={0}
                  value={settings.pointsToWin}
                  onChange={e =>
                    setSettings({ ...settings, pointsToWin: Math.max(0, parseInt(e.target.value, 10) || 0) })
                  }
                  className="h-8 w-24 rounded-lg border border-white/10 bg-slate-950/60 px-2 text-center text-sm font-bold tabular-nums text-sky-200 outline-none focus:border-sky-400/60"
                />
                <span className="text-xs text-slate-500">0 = play until one side remains.</span>
              </div>
            </div>
          )}
        </Panel>

        {/* ---------- SCORING (feature 3) ---------- */}
        <Panel
          label="Point Bounties"
          hint="Editable any time — including mid-game. Values feed the leaderboard."
        >
          <div className="grid grid-cols-2 gap-2">
            {SCORING_FIELDS.map(f => (
              <label key={f.key} className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                  <span className="text-base leading-none text-slate-200">{f.glyph}</span>
                  <span className="truncate">{f.label}</span>
                </span>
                <span className="mt-1 flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    value={settings.scoring[f.key]}
                    onChange={e => setScoring(f.key, parseInt(e.target.value, 10))}
                    className="h-7 w-full min-w-0 rounded-md border border-white/10 bg-slate-950/60 text-center text-sm font-bold tabular-nums text-emerald-300 outline-none focus:border-emerald-400/60"
                  />
                </span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip active={false} onClick={() => setSettings({ ...settings, scoring: { ...DEFAULT_SCORING } })}>
              Classic values
            </Chip>
            <Chip
              active={false}
              onClick={() =>
                setSettings({
                  ...settings,
                  scoring: { pawn: 2, knight: 5, bishop: 5, rook: 8, queen: 14, king: 30, checkmate: 25, check: 3 },
                })
              }
            >
              Aggressive
            </Chip>
            <Chip
              active={false}
              onClick={() =>
                setSettings({
                  ...settings,
                  scoring: { pawn: 1, knight: 2, bishop: 2, rook: 3, queen: 4, king: 10, checkmate: 40, check: 0 },
                })
              }
            >
              Mate hunter
            </Chip>
          </div>
        </Panel>

        {/* ---------- SEATS ---------- */}
        <Panel label="Players" hint="Hot-seat humans, bots, or any mix.">
          <div className="mb-3 flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <Chip
                key={p.humans}
                active={humans === p.humans}
                onClick={() => {
                  const teams = seats.map(s => s.team);
                  setSettings({ ...settings, seats: PRESET_SEATS(p.humans, teams) });
                }}
              >
                {p.humans}H / {p.bots}B
              </Chip>
            ))}
          </div>

          <div className="space-y-2">
            {seats.map((seat, i) => {
              const P = PLAYERS[i];
              return (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2">
                  <span className="w-14 shrink-0 text-xs font-bold uppercase tracking-wide" style={{ color: P.main }}>
                    {P.name}
                  </span>
                  <input
                    value={seat.name}
                    onChange={e => setSeat(i, { name: e.target.value.slice(0, 14) })}
                    className="w-28 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-200 outline-none transition-colors hover:border-white/10 focus:border-amber-300/40 focus:bg-white/5 sm:flex-none"
                  />
                  <div className="flex overflow-hidden rounded-lg border border-white/10">
                    {(['human', 'bot'] as const).map(k => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setSeat(i, { kind: k })}
                        className={cn(
                          'px-2.5 py-1 text-[11px] font-bold uppercase transition',
                          seat.kind === k ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:bg-white/5',
                        )}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                  {seat.kind === 'bot' && (
                    <select
                      value={seat.difficulty}
                      onChange={e => setSeat(i, { difficulty: e.target.value as BotDifficulty })}
                      className="h-7 rounded-lg border border-white/10 bg-slate-950/60 px-1.5 text-[11px] text-slate-300 outline-none"
                    >
                      <option value="easy">Casual (random)</option>
                      <option value="normal">Sharp (search AI)</option>
                    </select>
                  )}
                  {teamMode && (
                    <div className="flex overflow-hidden rounded-lg border border-white/10">
                      {TEAM_INFO.map((t, ti) => (
                        <button
                          key={t.name}
                          type="button"
                          title={t.name}
                          onClick={() => setSeat(i, { team: ti as 0 | 1 })}
                          className={cn(
                            'px-2 py-1 text-[10px] font-black transition',
                            seat.team === ti ? 'text-slate-950' : 'text-slate-400 hover:bg-white/5',
                          )}
                          style={seat.team === ti ? { background: t.color } : undefined}
                        >
                          {ti === 0 ? 'A' : 'O'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Turn order — Red → Blue → Amber → Green · any king taken = team wipe
          </p>
          <p className="mt-1 text-[11px] text-slate-600">
            Casual bots play random legal moves. Sharp bots run a multi-ply paranoid alpha-beta search with
            quiescence, hanging-piece detection and team awareness — and they read your point bounties.
          </p>
        </Panel>

        {/* ---------- CLOCK ---------- */}
        <Panel label="Clock" hint="Optional per-player clock. Flag fall wipes the army.">
          <div className="flex flex-wrap items-center gap-2">
            {CLOCKS.map(c => (
              <Chip
                key={c.label}
                active={settings.timeSec === c.value}
                onClick={() => setSettings({ ...settings, timeSec: c.value })}
              >
                {c.label}
              </Chip>
            ))}
            <span className="ml-1 flex items-center gap-1 text-xs text-slate-500">
              Custom:
              <input
                type="number"
                min={0}
                step={0.5}
                value={customMinutes}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  setSettings({ ...settings, timeSec: isNaN(v) || v <= 0 ? null : Math.round(v * 60) });
                }}
                className="h-7 w-16 rounded-lg border border-white/10 bg-slate-950/60 px-2 text-center text-xs text-slate-200 outline-none focus:border-amber-300/40"
              />
              minutes each
            </span>
          </div>
        </Panel>

        {/* ---------- HOUSE RULES + ARMY FORGE ---------- */}
        <Panel label="House Rules & Army Forge">
          <div className="space-y-2">
            <Toggle
              on={settings.commandeer}
              onChange={v => setSettings({ ...settings, commandeer: v })}
              title="Claim defeated armies"
              desc={
                <>
                  Team wiped → you seize their remaining pieces <em>(kings are always removed)</em>. Off → survivors
                  freeze as obstacles.
                </>
              }
            />
            <Toggle
              on={settings.kingHunt}
              onChange={v => setSettings({ ...settings, kingHunt: v })}
              title="King hunt"
              desc="Kings can be captured outright — any capture eliminates that whole team, even if they had 5 kings."
            />
            <button
              type="button"
              onClick={onOpenEditor}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] p-3 text-left transition hover:bg-amber-300/[0.12]"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-amber-200">
                  Army Forge — customize the board pieces
                </span>
                <span className="block text-xs text-slate-500">
                  Place unlimited kings, queens, rooks… for any colour. {settings.setup ? 'Custom position loaded.' : 'Standard starting position in use.'}
                </span>
              </span>
              <span className="shrink-0 text-lg text-amber-200">⚒</span>
            </button>
            {settings.setup && (
              <button
                type="button"
                onClick={() => setSettings({ ...settings, setup: null })}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-white/10"
              >
                Discard custom position
              </button>
            )}
          </div>
        </Panel>
      </div>

      {/* ---------- footer / start ---------- */}
      <div className="mt-6 space-y-3 text-center">
        <button
          type="button"
          disabled={badTeams}
          onClick={onStart}
          className={cn(
            'w-full rounded-2xl px-8 py-4 text-base font-black uppercase tracking-[0.25em] transition sm:w-auto',
            badTeams
              ? 'cursor-not-allowed bg-slate-800 text-slate-600'
              : 'bg-amber-400 text-slate-950 shadow-[0_18px_40px_-18px_rgba(251,191,36,.9)] hover:bg-amber-300',
          )}
        >
          {badTeams ? 'Fill both teams' : 'Start Battle'}
        </button>
        <p className="text-xs leading-relaxed text-slate-500">
          {bots === 4
            ? 'Bot Royale — 4 AIs brawl, you spectate.'
            : humans === 4
              ? 'Four humans, one device — hot-seat multi-king warfare.'
              : `${humans}H vs ${bots}B.`}{' '}
          {teamMode ? `${TEAM_INFO[0].name} (${alpha}) vs ${TEAM_INFO[1].name} (${omega}) · ` : ''}
          {settings.winCondition === 'points'
            ? 'Winner by points'
            : 'Winner by survival'}
          {' · '}Multi-king rule: one king falls = whole army falls. Auto-queens on far rank. No castling.
        </p>
        <p className="text-[11px] text-slate-600">
          Mode: {teamSplitLabel(settings)} · Bounties:{' '}
          {SCORING_FIELDS.map(f => `${f.glyph}${settings.scoring[f.key]}`).join(' ')}
        </p>
      </div>
    </div>
  );
}

/** Keeps the chosen teams when switching a human/bot preset. */
function PRESET_SEATS(humans: number, teams: (0 | 1)[]): Seat[] {
  const base = (
    [
      ['Red', 'R'],
      ['Blue', 'B'],
      ['Amber', 'A'],
      ['Green', 'G'],
    ] as const
  ).map(([name, letter], i) => ({
    name: i < humans ? `Player ${name}` : `Bot ${letter}`,
    kind: (i < humans ? 'human' : 'bot') as Seat['kind'],
    difficulty: (i % 2 === 0 ? 'normal' : 'easy') as BotDifficulty,
    team: teams[i],
  }));
  return base;
}

export default MenuScreen;
