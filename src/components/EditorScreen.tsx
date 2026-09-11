// src/components/EditorScreen.tsx
import { useMemo, useState } from 'react';
import {
  cloneBoard,
  isValidSquare,
  SIZE,
  standardSetup,
  type Board,
  type GPiece,
  type PieceType,
} from '../game/engine';
import { PLAYERS, type ArmySetup } from '../game/settings';
import { cn } from '../utils/cn';
import PieceIcon from './PieceIcon';

const TYPES: { t: PieceType; label: string; glyph: string }[] = [
  { t: 'k', label: 'King', glyph: '♚' },
  { t: 'q', label: 'Queen', glyph: '♛' },
  { t: 'r', label: 'Rook', glyph: '♜' },
  { t: 'b', label: 'Bishop', glyph: '♝' },
  { t: 'n', label: 'Knight', glyph: '♞' },
  { t: 'p', label: 'Pawn', glyph: '♟' },
];

interface Props {
  initial: ArmySetup | null;
  onSave: (setup: ArmySetup) => void;
  onBack: () => void;
}

export default function EditorScreen({ initial, onSave, onBack }: Props) {
  const [board, setBoard] = useState<Board>(() =>
    initial ? cloneBoard(initial.board) : cloneBoard(standardSetup().board),
  );
  const [nextId, setNextId] = useState<number>(() => initial?.nextId ?? standardSetup().nextId);
  const [tool, setTool] = useState<{ type: PieceType; owner: number }>({ type: 'q', owner: 0 });
  const [erase, setErase] = useState(false);

  const counts = useMemo(() => {
    const out = [0, 1, 2, 3].map(() => ({ k: 0, total: 0 }) as { k: number; total: number });
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const p = board[r][c];
        if (!p) continue;
        out[p.owner].total += 1;
        if (p.type === 'k') out[p.owner].k += 1;
      }
    }
    return out;
  }, [board]);

  const place = (r: number, c: number, rightClick = false) => {
    const next = board.map(row => row.map(p => (p ? { ...p } : null)));
    if (rightClick || erase) {
      next[r][c] = null;
      setBoard(next);
      return;
    }
    const id = nextId + 1;
    const piece: GPiece = { id, type: tool.type, owner: tool.owner, dir: tool.owner };
    next[r][c] = piece;
    setNextId(id);
    setBoard(next);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-100">
            Army Forge <span className="text-amber-300">⚒</span>
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Click to place the selected piece · right-click to erase. Unlimited pieces per colour — multi-king is
            legal, zero kings means that seat starts eliminated.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const s = standardSetup();
              setBoard(s.board);
              setNextId(s.nextId);
            }}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
          >
            Load standard
          </button>
          <button
            type="button"
            onClick={() => setBoard(Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null)))}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
          >
            Clear board
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={() => onSave({ board, nextId })}
            className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-amber-300"
          >
            Save position
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* board */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div
            className="grid w-full overflow-hidden rounded-lg"
            style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0,1fr))` }}
          >
            {Array.from({ length: SIZE * SIZE }, (_, idx) => {
              const r = Math.floor(idx / SIZE);
              const c = idx % SIZE;
              if (!isValidSquare(r, c)) return <div key={`${r}-${c}`} className="aspect-square bg-slate-950/60" />;
              const piece = board[r][c];
              const base = (r + c) % 2 === 0 ? '#41506b' : '#334159';
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => place(r, c)}
                  onContextMenu={e => {
                    e.preventDefault();
                    place(r, c, true);
                  }}
                  className="relative aspect-square transition hover:brightness-125"
                  style={{ background: base }}
                >
                  {piece && (
                    <span className="absolute inset-[6%]">
                      <PieceIcon type={piece.type} color={PLAYERS[piece.owner].main} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* palette */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Piece</h2>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map(x => (
                <button
                  key={x.t}
                  type="button"
                  onClick={() => {
                    setTool(s => ({ ...s, type: x.t }));
                    setErase(false);
                  }}
                  className={cn(
                    'rounded-xl border p-2 transition',
                    !erase && tool.type === x.t
                      ? 'border-amber-300/70 bg-amber-300/10'
                      : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]',
                  )}
                >
                  <div className="text-2xl leading-none text-slate-100">{x.glyph}</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {x.label}
                  </div>
                </button>
              ))}
            </div>

            <h2 className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Colour</h2>
            <div className="grid grid-cols-4 gap-2">
              {PLAYERS.map((p, i) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    setTool(s => ({ ...s, owner: i }));
                    setErase(false);
                  }}
                  className={cn(
                    'rounded-lg border py-2 text-[10px] font-bold uppercase transition',
                    !erase && tool.owner === i ? 'border-white/60' : 'border-white/10',
                  )}
                  style={{ background: `${p.main}22`, color: p.main }}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setErase(e => !e)}
              className={cn(
                'mt-4 w-full rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider transition',
                erase
                  ? 'border-rose-400/60 bg-rose-400/15 text-rose-200'
                  : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10',
              )}
            >
              {erase ? 'Eraser active' : 'Eraser (or right-click)'}
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Army census</h2>
            <div className="space-y-1.5">
              {PLAYERS.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2 py-1.5 text-xs">
                  <span className="font-bold" style={{ color: p.main }}>{p.name}</span>
                  <span className="tabular-nums text-slate-400">
                    {counts[i].total} pieces · {counts[i].k} king{counts[i].k === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              {counts.some(c => c.k === 0)
                ? 'A colour with zero kings starts already eliminated.'
                : 'Every colour has a king — all four seats start alive.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
