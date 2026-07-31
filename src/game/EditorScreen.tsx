import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Crown, Eraser, Layers, PencilRuler, RotateCcw, Save, Trash2, Undo2 } from 'lucide-react';
import { Board as BoardT, GPiece, PieceType, SIZE, standardSetup } from '../game/engine';
import { ArmySetup } from '../game/settings';
import { PLAYERS } from '../game/theme';
import { GameBoard } from './Board';
import { PieceIcon } from './PieceIcon';
import { cn } from '../utils/cn';

interface Props {
  initial: ArmySetup | null;
  onSave: (setup: ArmySetup | null) => void;
  onBack: () => void;
}

const PIECE_TYPES: { type: PieceType; label: string }[] = [
  { type: 'k', label: 'King' },
  { type: 'q', label: 'Queen' },
  { type: 'r', label: 'Rook' },
  { type: 'b', label: 'Bishop' },
  { type: 'n', label: 'Knight' },
  { type: 'p', label: 'Pawn' },
];

interface Palette {
  color: number;
  type: PieceType | 'erase';
}

export function EditorScreen({ initial, onSave, onBack }: Props) {
  const [{ board, nextId }, setState] = useState<ArmySetup>(() =>
    initial
      ? { board: initial.board.map(row => row.map(p => (p ? { ...p } : null))), nextId: initial.nextId }
      : standardSetup()
  );
  const [palette, setPalette] = useState<Palette>({ color: 0, type: 'p' });

  const counts = useMemo(() => {
    const c: Record<number, { kings: number; byType: Record<PieceType, number>; total: number }> = {
      0: { kings: 0, byType: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 }, total: 0 },
      1: { kings: 0, byType: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 }, total: 0 },
      2: { kings: 0, byType: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 }, total: 0 },
      3: { kings: 0, byType: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 }, total: 0 },
    };
    for (let r = 0; r < SIZE; r++)
      for (let cc = 0; cc < SIZE; cc++) {
        const p = board[r][cc];
        if (p) {
          c[p.owner].total++;
          c[p.owner].byType[p.type]++;
          if (p.type === 'k') c[p.owner].kings++;
        }
      }
    return c;
  }, [board]);

  const place = (r: number, c: number) => {
    const b2 = board.map(row => row.map(p => (p ? { ...p } : null)));
    if (palette.type === 'erase') {
      b2[r][c] = null;
      setState({ board: b2, nextId });
    } else {
      const piece: GPiece = { id: nextId, type: palette.type, owner: palette.color, dir: palette.color };
      b2[r][c] = piece;
      setState({ board: b2, nextId: nextId + 1 });
    }
  };

  const removeAt = (r: number, c: number) => {
    const b2 = board.map(row => row.map(p => (p ? { ...p } : null)));
    b2[r][c] = null;
    setState({ board: b2, nextId });
  };

  const totalKings = [0, 1, 2, 3].reduce((s, i) => s + counts[i].kings, 0);
  const totalPieces = [0, 1, 2, 3].reduce((s, i) => s + counts[i].total, 0);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07080c] text-slate-200">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(90% 70% at 50% -10%, rgba(232,196,104,0.10), transparent 60%), radial-gradient(60% 50% at 100% 100%, rgba(94,142,242,0.08), transparent 60%)' }} />
      <div className="relative mx-auto flex min-h-screen max-w-[1440px] flex-col gap-6 px-5 py-8 lg:flex-row lg:items-start lg:justify-center lg:gap-8">

        {/* panel */}
        <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full shrink-0 lg:w-[380px]">
          <button onClick={onBack} className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 transition-colors hover:text-amber-200">
            <ArrowLeft className="h-4 w-4" /> Back to menu
          </button>

          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-600 text-[#241A06] shadow-[0_0_24px_rgba(232,196,104,0.25)]">
              <PencilRuler className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-3xl font-black tracking-tight text-amber-50">Army Forge</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Place <span className="text-amber-200">as many kings as you want</span> — zero to a board full. Any king eaten or checkmated wipes that whole team. Right-click or eraser removes.
              </p>
            </div>
          </div>

          {initial && (
            <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3.5 py-2.5 text-xs text-amber-100/90">
              <span className="font-bold">Custom army loaded.</span> Editing it now will <span className="underline">override</span> the previous setup when you save.
            </div>
          )}

          {/* stats */}
          <div className="mt-5 flex gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <Crown className="h-4 w-4 text-amber-300" />
              <span className="text-xs font-bold text-slate-200">{totalKings} king{totalKings === 1 ? '' : 's'}</span>
              <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-500">total</span>
            </div>
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <Layers className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-200">{totalPieces} pieces</span>
              <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-500">total</span>
            </div>
          </div>

          {/* color picker */}
          <div className="mt-5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Active army</p>
            <div className="flex gap-2">
              {PLAYERS.map((P, i) => (
                <button key={P.name} onClick={() => setPalette(p => ({ ...p, color: i }))}
                  className={cn('group flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 transition-all flex-1')}>
                  <div className={cn('h-10 w-full rounded-lg border flex items-center justify-center')}
                    style={{
                      borderColor: palette.color === i ? P.main : 'rgba(255,255,255,0.08)',
                      background: palette.color === i ? `${P.main}18` : 'rgba(255,255,255,0.03)',
                      boxShadow: palette.color === i ? `0 0 16px ${P.main}33` : 'none',
                    }}>
                    <span className="h-3 w-3 rounded-full" style={{ background: P.main, boxShadow: `0 0 8px ${P.main}` }} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: palette.color === i ? P.light : '#64748b' }}>{P.name}</span>
                  <span className="text-[10px] font-mono text-slate-500">{counts[i].kings}♔ · {counts[i].total}⨉</span>
                </button>
              ))}
            </div>
          </div>

          {/* piece picker */}
          <div className="mt-5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Piece brush — unlimited</p>
            <div className="grid grid-cols-4 gap-2">
              {PIECE_TYPES.map(pt => (
                <button key={pt.type}
                  onClick={() => setPalette(p => ({ ...p, type: pt.type }))}
                  title={pt.label}
                  className={cn(
                    'group flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border p-1.5 transition-all',
                    palette.type === pt.type
                      ? 'border-amber-300/70 bg-amber-300/10 shadow-[0_0_16px_rgba(232,196,104,0.22)]'
                      : 'border-white/10 bg-white/[0.04] hover:border-white/25'
                  )}>
                  <PieceIcon type={pt.type} colorIdx={palette.color} className="h-[60%] w-[60%]" />
                  <span className={cn('text-[10px] font-bold uppercase tracking-wider', palette.type === pt.type ? 'text-amber-200' : 'text-slate-500')}>{pt.label}</span>
                </button>
              ))}
              <button
                onClick={() => setPalette(p => ({ ...p, type: 'erase' }))}
                title="Eraser"
                className={cn(
                  'flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border transition-all',
                  palette.type === 'erase'
                    ? 'border-rose-300/70 bg-rose-400/10 text-rose-200'
                    : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/25'
                )}>
                <Eraser className="h-6 w-6" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Erase</span>
              </button>
            </div>
          </div>

          {/* per army breakdown */}
          <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
            <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              <Crown className="h-3.5 w-3.5" /> Army census — any king count allowed
            </p>
            <div className="space-y-2.5">
              {PLAYERS.map((P, i) => {
                const c = counts[i];
                const zero = c.kings === 0;
                const many = c.kings > 1;
                return (
                  <div key={P.name} className="flex items-center gap-2.5 rounded-xl bg-black/20 px-2.5 py-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: P.main }} />
                    <span className="w-12 text-xs font-bold" style={{ color: P.light }}>{P.name}</span>
                    <div className="flex items-center gap-1">
                      {(['k', 'q', 'r', 'b', 'n', 'p'] as PieceType[]).map(t => (
                        c.byType[t] > 0 && (
                          <span key={t} className="flex items-center gap-0.5 rounded bg-white/10 px-1 py-0.5 text-[10px] font-mono">
                            {t.toUpperCase()}:{c.byType[t]}
                          </span>
                        )
                      ))}
                    </div>
                    <span className={cn('ml-auto text-[10px] font-semibold', zero ? 'text-rose-300' : many ? 'text-amber-300' : 'text-emerald-300')}>
                      {zero ? '0 kings — will start dead' : many ? `${c.kings} kings — first loss = wipe` : `${c.kings} king`}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2.5 text-[10px] leading-relaxed text-slate-500">
              Tip: give Red three kings in a triangle to make hunting harder — but any single capture ends that team.
              Zero kings is allowed; that army joins already eliminated.
            </p>
          </div>

          {/* actions */}
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              onClick={() => onSave({ board, nextId })}
              className="flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-display text-sm font-black uppercase tracking-[0.2em] text-[#241A06] shadow-[0_10px_30px_rgba(232,196,104,0.25)] transition-transform hover:scale-[1.01]"
              style={{ background: 'linear-gradient(135deg,#FFE9AE,#E8C468 45%,#C99A35)' }}>
              <Save className="h-4 w-4" /> {initial ? 'Override custom armies' : 'Save as custom armies'}
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => setState(standardSetup())}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 transition-colors hover:border-white/25">
                <RotateCcw className="h-3.5 w-3.5" /> Load standard
              </button>
              <button
                onClick={() => {
                  const empty = board.map(row => row.map(() => null as GPiece | null));
                  setState({ board: empty, nextId });
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-rose-200/80 transition-colors hover:border-rose-300/40">
                <Trash2 className="h-3.5 w-3.5" /> Clear board
              </button>
            </div>

            {initial && (
              <button onClick={() => onSave(null)}
                className="flex items-center justify-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-amber-200/80 transition-colors hover:border-amber-300/40">
                <Undo2 className="h-3.5 w-3.5" /> Discard custom — use standard
              </button>
            )}

            <p className="text-center text-[10px] uppercase tracking-[0.18em] text-slate-600">
              Saves override the previous custom. You can re-open and edit again anytime before battle.
            </p>
          </div>
        </motion.div>

        {/* board */}
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="flex justify-center">
          <GameBoard
            board={board as BoardT}
            alive={[true, true, true, true]}
            selected={null}
            targets={null}
            lastMove={null}
            checkSquares={[]}
            interactive
            size="min(88vmin, 740px)"
            onSquare={place}
            onSquareRight={removeAt}
          />
        </motion.div>
      </div>
    </div>
  );
}
