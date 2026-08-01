import { allLegalMoves, type Board, type Move } from './engine';

export type BotDifficulty = 'easy' | 'normal';

export function chooseBotMove(
  board: Board,
  player: number,
  difficulty: BotDifficulty,
  kingHunt: boolean,
  alive: boolean[],
): Move | null {
  const moves = allLegalMoves(board, player, kingHunt, alive);

  if (moves.length === 0) {
    return null;
  }

  const captures = moves.filter(move => move.capturedId !== undefined);

  const candidates =
    difficulty === 'normal' && captures.length > 0
      ? captures
      : moves;

  return candidates[Math.floor(Math.random() * candidates.length)];
}
