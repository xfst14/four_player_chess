import { useMemo } from 'react';
import { isValidSquare, SIZE, type Board as BoardT, type Move, type Vec } from '../game/engine';
import { PLAYERS, DEAD_COLORS } from '../game/theme';
import { TEAM_INFO } from '../game/settings';
import PieceIcon from './PieceIcon';

interface Props {
  board: BoardT;
  alive: boolean[];
  teams: number[];
  teamMode: boolean;
  turn: number;
  selected: Vec | null;
  legal: Move[];
  lastMove: { from: Vec; to: Vec } | null;
  checkedKings: Vec[];
  interactive: boolean;
  onSquare: (sq: Vec) => void;
}

const LIGHT = '#41506b';
const DARK = '#334159';

export default function Board({
  board,
  alive,
  teams,
  teamMode,
  turn,
  selected,
  legal,
  lastMove,
  checkedKings,
  interactive,
  onSquare,
}: Props) {
  const legalMap = useMemo(() => {
    const m = new Map<string, Move>();
    for (const mv of legal) m.set(`${mv.to.r}-${mv.to.c}`, mv);
    return m;
  }, [legal]);

  const checkSet = useMemo(
    () => new Set(checkedKings.map(k => `${k.r}-${k.c}`)),
    [checkedKings],
  );

  return (
    <div
      className="relative w-full select-none rounded-2xl p-[6px] shadow-[0_28px_70px_-20px_rgba(0,0,0,.85)]"
      style={{
        background: 'linear-gradient(160deg,#1a2233,#111726 55%,#0c111c)',
        border: '1px solid rgba(148,163,184,.18)',
      }}
    >
      <div
        className="grid aspect-square w-full overflow-hidden rounded-xl"
        style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0,1fr))` }}
      >
        {Array.from({ length: SIZE * SIZE }, (_, idx) => {
          const r = Math.floor(idx / SIZE);
          const c = idx % SIZE;
          const key = `${r}-${c}`;
          if (!isValidSquare(r, c)) return <div key={key} className="aspect-square" />;

          const piece = board[r][c];
          const isSel = selected?.r === r && selected?.c === c;
          const target = legalMap.get(key);
          const isLast = lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c));
          const inCheck = checkSet.has(key);
          const base = (r + c) % 2 === 0 ? LIGHT : DARK;
          const ownerColors = piece ? (alive[piece.owner] ? PLAYERS[piece.owner] : DEAD_COLORS) : null;
          const teamColor = piece && teamMode && alive[piece.owner] ? TEAM_INFO[teams[piece.owner]]?.color : null;
          const isMine = piece && piece.owner === turn && alive[piece.owner];

          return (
            <button
              key={key}
              onClick={() => onSquare({ r, c })}
              disabled={!interactive}
              className="group relative aspect-square"
              style={{ background: base }}
            >
              {isLast && <div className="absolute inset-0 bg-amber-300/20" />}
              {inCheck && (
                <div
                  className="absolute inset-0"
                  style={{ background: 'radial-gradient(circle, rgba(239,68,68,.75) 0%, rgba(239,68,68,0) 72%)' }}
                />
              )}
              {isSel && <div className="absolute inset-0 ring-2 ring-inset ring-white/80" />}

              {teamColor && (
                <div
                  className="absolute inset-x-0 bottom-0 h-[3px]"
                  style={{ background: teamColor, opacity: 0.85 }}
                />
              )}

              {piece && ownerColors && (
                <span className="absolute inset-[4%]">
                  <PieceIcon type={piece.type} color={ownerColors.main} dim={!alive[piece.owner]} />
                </span>
              )}

              {target && !piece && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="h-[26%] w-[26%] rounded-full bg-white/55 shadow" />
                </span>
              )}
              {target && piece && (
                <span className="absolute inset-[6%] rounded-full ring-[3px] ring-rose-300/85" />
              )}
              {isMine && interactive && !isSel && (
                <span className="absolute inset-0 opacity-0 transition group-hover:opacity-100" style={{ background: 'rgba(255,255,255,.12)' }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
