import type { Board } from './engine';

export interface ArmySetup {
  board: Board;
  nextId: number;
}

export type BotDifficulty = 'easy' | 'normal';

export interface Seat {
  name: string;
  kind: 'human' | 'bot';
  difficulty: BotDifficulty;
}

export interface Settings {
  seats: Seat[];
  timeSec: number | null;
  commandeer: boolean;
  kingHunt: boolean;
  setup: ArmySetup | null;
  winCondition: 'classic' | 'points';
}

export function presetSeats(humans: number): Seat[] {
  return ['Red', 'Blue', 'Amber', 'Green'].map((name, i) => ({
    name: i < humans ? `Player ${name}` : `Bot ${name[0]}`,
    kind: i < humans ? 'human' : 'bot',
    difficulty: 'easy',
  }));
}

export function defaultSeats(): Seat[] {
  return presetSeats(4);
}

export const PLAYERS = [
  { name: 'Red', color: '#ef4444' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Amber', color: '#f59e0b' },
  { name: 'Green', color: '#22c55e' },
];

export const CLOCKS = [
  { label: '1 min', value: 60 },
  { label: '3 min', value: 180 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
];

export const PRESETS = [
  { humans: 4, bots: 0 },
  { humans: 3, bots: 1 },
  { humans: 2, bots: 2 },
  { humans: 1, bots: 3 },
  { humans: 0, bots: 4 },
];

export const SIZE = 14;

export function totalSeats(seats: Seat[]) {
  return {
    humans: seats.filter(s => s.kind === 'human').length,
    bots: seats.filter(s => s.kind === 'bot').length,
  };
}

// src/game/settings.ts

export interface ScoringSettings {
  enabled: boolean;
  pawn: number;
  knight: number;
  bishop: number;
  rook: number;
  queen: number;
  king: number;
  checkBonus: number;
}

export const DEFAULT_SCORING: ScoringSettings = {
  enabled: false, // off by default so it doesn't break classic mode
  pawn: 1,
  knight: 2,
  bishop: 3,
  rook: 3,
  queen: 5,
  king: 9,
  checkBonus: 3,
};

// New Game Mode enum
export const GameMode = {
  CLASSIC: "classic",
  POINTS: "points",
} as const;

export type GameMode = typeof GameMode[keyof typeof GameMode];
// resolves to "classic" | "points"

export interface GameSettings {
  mode: GameMode;
  scoring: ScoringSettings;
  pointsTargetScore?: number; // optional: end game early at X points
  // ...existing settings (board size, timers, etc.)
}