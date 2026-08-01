import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bot, Brain, ChevronRight, Crown, PencilRuler, Swords, Timer, User, Infinity as InfinityIcon, Layers } from 'lucide-react';
import { Settings, presetSeats, totalSeats } from '../game/settings';
import { PLAYERS } from '../game/theme';
import { SIZE } from '../game/engine';
import { cn } from '../utils/cn';

interface Props {
  settings: Settings;
  setSettings: (s: Settings) => void;
  onStart: () => void;
  onOpenEditor: () => void;
}

const FADE = (i: number) => ({
  initial: { opacity: 0, y: 26 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.08 * i, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
});

const PRESETS: { label: string; humans: number; hint: string }[] = [
  { label: '4 Players', humans: 4, hint: 'Hot-seat' },
  { label: '3P + 1 Bot', humans: 3, hint: '' },
  { label: '2P + 2 Bots', humans: 2, hint: '' },
  { label: '1P + 3 Bots', humans: 1, hint: 'Solo' },
  { label: 'Bot Royale', humans: 0, hint: 'Spectate' },
];

const CLOCKS: { label: string; sec: number | null }[] = [
  { label: 'No clock', sec: null },
  { label: '1:00', sec: 60 },
  { label: '3:00', sec: 180 },
  { label: '5:00', sec: 300 },
  { label: '10:00', sec: 600 },
  { label: '15:00', sec: 900 },
];

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 backdrop-blur-sm shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200/20 bg-amber-300/10 text-amber-200">{icon}</span>
        <h3 className="font-display text-sm font-bold uppercase tracking-[0.22em] text-amber-100/90">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200',
        on ? 'border-amber-300/60 bg-amber-400/80' : 'border-white/15 bg-white/10'
      )}
    >
      <span
        className={cn(
          'absolute top-1/2 h-4.5 w-4.5 -translate-y-1/2 rounded-full bg-white shadow transition-all duration-200',
          on ? 'left-[22px]' : 'left-[3px]'
        )}
        style={{ height: 18, width: 18 }}
      />
    </button>
  );
}

export function MenuScreen({ settings, setSettings, onStart, onOpenEditor }: Props) {
  const seats = settings.seats;
  const setSeat = (i: number, patch: Partial<Settings['seats'][0]>) => {
    const next = seats.map((s, j) => (j === i ? { ...s, ...patch } : s));
    setSettings({ ...settings, seats: next });
  };
  const { humans, bots } = totalSeats(seats);
  const activePreset = PRESETS.findIndex(p => p.humans === humans);

  const customSummary = useMemo(() => {
    if (!settings.setup) return null;
    const counts = [0, 1, 2, 3].map(() => ({ kings: 0, total: 0 }));
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        const p = settings.setup.board[r][c];
        if (p) { counts[p.owner].total++; if (p.type === 'k') counts[p.owner].kings++; }
      }
    return counts;
  }, [settings.setup]);

  return (
      <div className="relative min-h-screen overflow-x-hidden overflow-y-auto bg-[#07080c] text-slate-200">
      <img src="/images/hero.jpg" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45" />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(7,8,12,0.55) 0%, rgba(7,8,12,0.82) 45%, rgba(7,8,12,0.97) 100%)' }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(80% 60% at 50% 0%, rgba(232,196,104,0.10), transparent 60%)' }} />

      <div className="relative mx-auto w-full max-w-6xl px-3 pb-16 pt-8 sm:px-8 sm:pt-10">
        <motion.header {...FADE(0)} className="mb-10 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-300/[0.07] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-200/90">
            <Crown className="h-3.5 w-3.5" />
            Four-player chess · multi-king variant
          </div>
          <h1 className="font-display text-[clamp(2.6rem,7vw,5.2rem)] font-black leading-[0.95] tracking-tight text-transparent"
            style={{ background: 'linear-gradient(180deg,#FFF7E0 0%, #E8C468 55%, #8A5F1B 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>
            FOUR KINGS
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
            Place <span className="text-amber-200/90">any number of kings</span> — losing any one ends that team. Checkmated or devoured, every empire crumbles when a crown falls.
            Then <span className="text-amber-200/90">claim the survivors</span>.
          </p>
        </motion.header>

        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <motion.div {...FADE(1)}>
            <Card title="Players — 5 modes + custom" icon={<Swords className="h-4 w-4" />}>
              <div className="mb-4 flex flex-wrap gap-2">
                {PRESETS.map((p, i) => (
                  <button
                    key={p.label}
                    onClick={() => setSettings({ ...settings, seats: presetSeats(p.humans) })}
                    className={cn(
                      'rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all duration-200',
                      activePreset === i
                        ? 'border-amber-300/70 bg-amber-300/15 text-amber-100 shadow-[0_0_18px_rgba(232,196,104,0.15)]'
                        : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/25 hover:text-slate-200'
                    )}
                  >
                    {p.label}
                    {p.hint && <span className="ml-1.5 opacity-50">{p.hint}</span>}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5">
                {seats.map((seat, i) => {
                  const P = PLAYERS[i];
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/25 p-2.5 pl-3"
                      style={{ boxShadow: `inset 3px 0 0 ${P.main}` }}>
                      <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: P.main, boxShadow: `0 0 10px ${P.main}` }} />
                      <span className="hidden w-14 text-xs font-bold uppercase tracking-wider sm:block" style={{ color: P.light }}>{P.name}</span>
                      <input
                        value={seat.name}
                        onChange={e => setSeat(i, { name: e.target.value.slice(0, 14) })}
                        className="w-28 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-200 outline-none transition-colors hover:border-white/10 focus:border-amber-300/40 focus:bg-white/5 sm:flex-none"
                      />
                      <div className="ml-auto flex items-center gap-2">
                        <div className="flex overflow-hidden rounded-lg border border-white/10">
                          {(['human', 'bot'] as const).map(k => (
                            <button
                              key={k}
                              onClick={() => {
                                const name = k === 'bot' && !seat.name.toLowerCase().startsWith('bot')
                                  ? `Bot ${P.label}` : k === 'human' && seat.name.toLowerCase().startsWith('bot') ? `Player ${P.name}` : seat.name;
                                setSeat(i, { kind: k, name });
                              }}
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors',
                                seat.kind === k ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300'
                              )}
                            >
                              {k === 'human' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                              {k === 'human' ? 'Human' : 'Bot'}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setSeat(i, { difficulty: seat.difficulty === 'easy' ? 'normal' : 'easy' })}
                          disabled={seat.kind === 'human'}
                          title="Bot difficulty"
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all',
                            seat.kind === 'human'
                              ? 'cursor-not-allowed border-white/5 text-slate-600'
                              : seat.difficulty === 'normal'
                                ? 'border-sky-300/40 bg-sky-300/10 text-sky-200'
                                : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
                          )}
                        >
                          <Brain className="h-3.5 w-3.5" />
                          {seat.difficulty === 'normal' ? 'Sharp' : 'Casual'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Turn order — Red → Blue → Amber → Green · any king taken = team wipe
              </p>
            </Card>
          </motion.div>

          <div className="flex flex-col gap-5">
            <motion.div {...FADE(2)}>
              <Card title="Game clock" icon={<Timer className="h-4 w-4" />}>
                <div className="flex flex-wrap gap-2">
                  {CLOCKS.map(c => (
                    <button
                      key={c.label}
                      onClick={() => setSettings({ ...settings, timeSec: c.sec })}
                      className={cn(
                        'rounded-xl border px-3.5 py-2 font-mono text-xs font-semibold transition-all',
                        settings.timeSec === c.sec
                          ? 'border-amber-300/70 bg-amber-300/15 text-amber-100'
                          : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/25 hover:text-slate-200'
                      )}
                    >
                      {c.sec === null ? <InfinityIcon className="h-3.5 w-3.5" /> : c.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                  <span>Custom:</span>
                  <input
                    type="number" min={0.5} max={120} step={0.5}
                    placeholder="min"
                    className="w-20 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-amber-300/50"
                    onChange={e => {
                      const v = parseFloat(e.target.value);
                      setSettings({ ...settings, timeSec: isNaN(v) || v <= 0 ? null : Math.round(v * 60) });
                    }}
                  />
                  <span className="text-slate-500">minutes each · flag = wipe</span>
                </div>
              </Card>
            </motion.div>

            <motion.div {...FADE(3)}>
              <Card title="House rules" icon={<Crown className="h-4 w-4" />}>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-200">
                        Claim defeated armies
                      </p>
                      <p className="mt-0.5 break-words text-xs leading-relaxed text-slate-500">
                        Team wiped → <span className="text-slate-300">you seize their remaining pieces</span> 
                        {' '}(kings are always removed). Off → survivors freeze as obstacles.
                      </p>
                    </div>

                    <Toggle on={settings.commandeer} onClick={() => setSettings({ ...settings, commandeer: !settings.commandeer })}/>
                  </div>
                  <div className="h-px bg-white/[0.06]" />
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-200">
                        King hunt
                      </p>
                      <p className="mt-0.5 break-words text-xs leading-relaxed text-slate-500">
                        Kings can be <span className="text-slate-300">captured outright</span> — any capture eliminates that whole team, even if they had 5 kings.
                      </p>
                    </div>

                    <Toggle on={settings.kingHunt} onClick={() => setSettings({ ...settings, kingHunt: !settings.kingHunt })} />
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div {...FADE(4)} className="flex flex-col gap-3">
              <button
                onClick={onStart}
                className="group relative overflow-hidden rounded-2xl px-6 py-4 text-center font-display text-base font-black uppercase tracking-[0.25em] text-[#241A06] shadow-[0_10px_40px_rgba(232,196,104,0.25)] transition-transform duration-200 hover:scale-[1.015] active:scale-[0.99]"
                style={{ background: 'linear-gradient(135deg,#FFE9AE 0%,#E8C468 45%,#C99A35 100%)' }}
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  <Swords className="h-5 w-5" />
                  Start the battle
                  <ChevronRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </button>

              <button
                onClick={onOpenEditor}
                className="flex flex-col gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3.5 text-left transition-all hover:border-amber-200/40"
              >
                <span className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-[0.2em] text-slate-200">
                  <PencilRuler className="h-4 w-4" />
                  {settings.setup ? 'Armies customized — override' : 'Customize the armies — any kings'}
                </span>
                {customSummary ? (
                  <span className="flex flex-wrap gap-1.5">
                    {customSummary.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[11px]">
                        <span className="h-2 w-2 rounded-full" style={{ background: PLAYERS[i].main }} />
                        <span className="font-mono text-slate-300">{PLAYERS[i].name}: {s.kings}♔</span>
                        <Crown className="h-3 w-3 opacity-60" /> {s.total}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Layers className="h-3.5 w-3.5" /> Place any number of kings, queens, etc anywhere. Right-click removes. Save to override.
                  </span>
                )}
              </button>

              <p className="mt-1 text-center text-[11px] leading-relaxed text-slate-500">
                {bots === 4
                  ? 'Bot Royale — 4 AIs brawl, you spectate.'
                  : humans === 4
                    ? 'Four humans, one device — hot-seat multi-king warfare.'
                    : `${humans}H vs ${bots}B.`}{' '}
                Multi-king rule: <span className="text-slate-300">one king falls = whole army falls</span>. Auto-queens on far rank. No castling.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
