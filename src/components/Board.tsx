import React from 'react';
import { Board, Move, Vec, isValidSquare, SIZE } from '../game/engine';
import { PieceIcon } from './PieceIcon';
import { PLAYERS } from '../game/theme';

interface BoardProps {
  board: Board;
  alive: boolean[];
  selected: Vec | null;
  targets: Move[] | null;
  lastMove: Move | null;
  checkSquares: Vec[];
  interactive: boolean;
  size?: string;
  onSquare: (r: number, c: number) => void;
  onSquareRight?: (r: number, c: number) => void;
}

const FILES = 'abcdefghijklmn';

export const GameBoard = React.memo(function GameBoard({
  board, alive, selected, targets, lastMove, checkSquares, interactive, size, onSquare, onSquareRight,
}: BoardProps) {
  const cell = 100 / SIZE;

  const targetAt = (r: number, c: number) => targets?.find(m => m.to.r === r && m.to.c === c);
  const isLast = (r: number, c: number) =>
    lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c));
  const isCheck = (r: number, c: number) => checkSquares.some(s => s.r === r && s.c === c);
  const isSel = (r: number, c: number) => selected && selected.r === r && selected.c === c;

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const key = `${r}-${c}`;
      if (!isValidSquare(r, c)) {
        cells.push(<div key={key} className="invisible" />);
        continue;
      }
      const light = (r + c) % 2 === 0;
      const t = targetAt(r, c);
      const capture = t && t.capturedId !== undefined;
      const showFile = !isValidSquare(r + 1, c);
      const showRank = !isValidSquare(r, c - 1);

      cells.push(
        <div
          key={key}
          onClick={() => onSquare(r, c)}
          onContextMenu={e => { e.preventDefault(); onSquareRight?.(r, c); }}
          className={`relative ${interactive ? 'cursor-pointer' : ''} transition-[filter] duration-150 ${interactive ? 'hover:brightness-125' : ''}`}
          style={{
            background: light
              ? 'linear-gradient(135deg,#525c72 0%,#475064 60%,#414a5e 100%)'
              : 'linear-gradient(135deg,#272c39 0%,#222736 60%,#1e2330 100%)',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.28)',
          }}
        >
          {/* coordinates */}
          {showRank && (
            <span className={`absolute left-[6%] top-[2%] text-[clamp(6px,1vmin,10px)] font-semibold ${light ? 'text-slate-800/50' : 'text-slate-400/40'}`}>
              {SIZE - r}
            </span>
          )}
          {showFile && (
            <span className={`absolute bottom-[1%] right-[6%] text-[clamp(6px,1vmin,10px)] font-semibold uppercase ${light ? 'text-slate-800/50' : 'text-slate-400/40'}`}>
              {FILES[c]}
            </span>
          )}

          {/* last move */}
          {isLast(r, c) && <div className="absolute inset-0" style={{ background: 'rgba(232,196,104,0.20)' }} />}

          {/* selected */}
          {isSel(r, c) && (
            <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 0 3px rgba(232,196,104,0.95), inset 0 0 14px rgba(232,196,104,0.45)', background: 'rgba(232,196,104,0.12)' }} />
          )}

          {/* check pulse */}
          {isCheck(r, c) && (
            <div className="absolute inset-0 check-pulse" style={{ background: 'radial-gradient(circle, rgba(255,60,60,0.55) 0%, rgba(255,60,60,0.12) 62%, transparent 75%)' }} />
          )}

          {/* move targets */}
          {t && !capture && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ width: '30%', height: '30%', background: 'radial-gradient(circle, rgba(232,196,104,0.9), rgba(232,196,104,0.55))', boxShadow: '0 0 8px rgba(232,196,104,0.8)' }} />
          )}
          {capture && (
            <div className="absolute rounded-full"
              style={{ inset: '5%', border: '3px solid rgba(255,120,110,0.95)', background: 'rgba(255,80,70,0.14)', boxShadow: '0 0 12px rgba(255,80,70,0.55), inset 0 0 10px rgba(255,80,70,0.35)' }} />
          )}
        </div>
      );
    }
  }

  const pieces: React.ReactNode[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (!p) continue;
      const dead = !alive[p.owner];
      const sel = isSel(r, c);
      pieces.push(
        <div
          key={p.id}
          className="absolute left-0 top-0"
          style={{
            width: `${cell}%`,
            height: `${cell}%`,
            transform: `translate(${c * 100}%, ${r * 100}%)`,
            transition: 'transform 260ms cubic-bezier(.25,.9,.3,1.15)',
            zIndex: sel ? 30 : 20,
            pointerEvents: 'none',
          }}
        >
          <div
            className="h-full w-full"
            style={{
              padding: '4%',
              transform: sel ? 'translateY(-5%) scale(1.1)' : 'none',
              transition: 'transform 180ms ease',
              filter: dead ? 'saturate(0) opacity(0.5)' : `drop-shadow(0 ${sel ? 6 : 3}px 3px rgba(0,0,0,0.55))`,
            }}
          >
            <PieceIcon type={p.type} colorIdx={dead ? -1 : p.owner} className="h-full w-full" />
          </div>
        </div>
      );
    }
  }

  return (
    <div
      className="relative mx-auto select-none touch-manipulation"
      style={{
        width: size ?? 'min(92vmin, 780px)',
        maxWidth: 'min(100%, calc(100vw - 32px))',
        aspectRatio: '1 / 1',
        boxShadow: '0 30px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.05)',
        borderRadius: '6px',
        background: '#12151d',
      }}
    >
      <div
        className="absolute inset-0 grid overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gridTemplateRows: `repeat(${SIZE}, 1fr)`, borderRadius: '6px' }}
      >
        {cells}
      </div>
      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>{pieces}</div>
    </div>
  );
});

/** Four glowing arena strips marking each army's side; active side is lit. */
export function TurnRing({ turn, winner }: { turn: number; winner: number | null }) {
  const strip = (i: number, style: React.CSSProperties) => {
    const active = winner === null && turn === i;
    const win = winner !== null && winner === i;
    const col = PLAYERS[i].main;
    return (
      <div
        style={{
          position: 'absolute', ...style,
          background: col,
          opacity: active || win ? 1 : 0.18,
          boxShadow: active || win ? `0 0 18px ${col}, 0 0 40px ${col}` : 'none',
          transition: 'opacity 300ms, box-shadow 300ms',
          borderRadius: 999,
        }}
      />
    );
  };
  return (
    <>
      {strip(2, { left: '3%', right: '3%', top: -13, height: 5 })}    {/* Amber — top */}
      {strip(0, { left: '3%', right: '3%', bottom: -13, height: 5 })} {/* Red — bottom */}
      {strip(1, { top: '3%', bottom: '3%', left: -13, width: 5 })}    {/* Blue — left */}
      {strip(3, { top: '3%', bottom: '3%', right: -13, width: 5 })}   {/* Green — right */}
    </>
  );
}
