import React from 'react';
import { PieceType } from '../game/engine';
import { PLAYERS, DEAD_COLORS } from '../game/theme';

interface Props {
  type: PieceType;
  colorIdx: number; // 0..3, or -1 for a neutral / dead piece
  className?: string;
}

/** Hand-drawn stylised piece silhouettes (45x45 grid), tinted per army. */
export const PieceIcon = React.memo(function PieceIcon({ type, colorIdx, className }: Props) {
  const dead = colorIdx < 0;
  const cols = dead ? DEAD_COLORS : PLAYERS[colorIdx];
  const gid = `pg${dead ? 'x' : colorIdx}`;
  const fill = `url(#${gid})`;
  const stroke = cols.deep;

  return (
    <svg viewBox="0 0 45 45" className={className} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cols.light} />
          <stop offset="52%" stopColor={cols.main} />
          <stop offset="100%" stopColor={cols.mid} />
        </linearGradient>
      </defs>
      <g fill={fill} stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round">
        {type === 'p' && (
          <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" />
        )}

        {type === 'r' && (
          <>
            <path d="M9 39h27v-3H9z" />
            <path d="M12 36v-4h21v4z" />
            <path d="M12 32l2-2.5V17h17v12.5l2 2.5z" />
            <path d="M14 17l-3-3V9h4v2h5V9h5v2h5V9h4v5l-3 3z" />
          </>
        )}

        {type === 'n' && (
          <>
            <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" />
            <path d="M24 18c.4 2.9-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.04-.94 1.41-3.04 0-3-1 0 1.19 1.23-1 2-1 0-4 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.99-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.99 2.5-3c1 0 1 3 1 3z" />
            <circle cx={9.6} cy={16.4} r={1.05} fill={stroke} stroke="none" />
          </>
        )}

        {type === 'b' && (
          <>
            <path d="M25 8a2.5 2.5 0 11-5 0 2.5 2.5 0 115 0z" />
            <path d="M22.5 11.5c-4 3-4.2 6-4.2 8.5 0 2.6 1.9 4 4.2 4s4.2-1.4 4.2-4c0-2.5-.2-5.5-4.2-8.5z" />
            <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-7.5-4-7.5-4s-7.5 1.5-7.5 4c0 0-.5.5 0 2z" />
            <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2z" />
            <path d="M22.5 15v4.6M20.2 17.3h4.6" fill="none" strokeWidth={1.3} />
          </>
        )}

        {type === 'q' && (
          <>
            <path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6L22.5 11l-3 13.5L14.3 10.9 14 25l-7.5-11.5L9 26z" />
            <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1 2.5-1 2.5-1.5 1.5 0 2.5 0 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1-.5-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" />
            <circle cx={6} cy={12} r={2.05} />
            <circle cx={14} cy={9.1} r={2.05} />
            <circle cx={22.5} cy={8.6} r={2.05} />
            <circle cx={31} cy={9.1} r={2.05} />
            <circle cx={39} cy={12} r={2.05} />
          </>
        )}

        {type === 'k' && (
          <>
            <path d="M24.3 12.5a1.8 1.8 0 11-3.6 0 1.8 1.8 0 113.6 0z" />
            <path d="M14 29.5C14.3 24 17 19 22.5 16.8 28 19 30.7 24 31 29.5c-5.7-1.4-11.3-1.4-17 0z" />
            <path d="M14 33.5c5.7-1.6 11.3-1.6 17 0V30c-5.7-1.4-11.3-1.4-17 0v3.5z" />
            <path d="M11 38.5c7.7-2.5 15.3-2.5 23 0l1.3-2.8c-8.6-2-17-2-25.6 0l1.3 2.8z" />
            <path d="M22.5 10.7V5.8M20 8.2h5" fill="none" strokeWidth={1.5} />
          </>
        )}
      </g>
    </svg>
  );
});
