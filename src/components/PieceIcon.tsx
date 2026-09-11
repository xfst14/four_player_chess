import type { PieceType } from '../game/engine';

const GLYPHS: Record<PieceType, string> = {
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

/**
 * Pieces are drawn as SVG text so they always scale with their square,
 * with a dark outline (paint-order: stroke) for readability on any colour.
 */
export default function PieceIcon({
  type,
  color,
  dim = false,
  scale = 78,
  className,
}: {
  type: PieceType;
  color: string;
  dim?: boolean;
  scale?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className ?? 'h-full w-full'}
      style={{
        opacity: dim ? 0.5 : 1,
        filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.55))',
      }}
      aria-hidden
    >
      <text
        x="50"
        y="54"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={scale}
        fill={color}
        stroke="rgba(6,10,20,.85)"
        strokeWidth={2.4}
        paintOrder="stroke"
        style={{ fontFamily: '"Segoe UI Symbol","Apple Symbols","Noto Sans Symbols 2",sans-serif' }}
      >
        {GLYPHS[type]}
      </text>
    </svg>
  );
}

export { GLYPHS };
