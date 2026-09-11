// src/game/settings.ts
import type { Board, PieceType } from './engine';

export interface ArmySetup {
  board: Board;
  nextId: number;
}

export type BotDifficulty = 'easy' | 'normal';
export type SeatKind = 'human' | 'bot';

/** Free-for-all (every empire for itself) or Team Mode (two alliances). */
export type GameMode = 'ffa' | 'team';

/** 'classic' = last side standing · 'points' = highest score when the game ends. */
export type WinCondition = 'classic' | 'points';

export interface Seat {
  name: string;
  kind: SeatKind;
  difficulty: BotDifficulty;
  team: 0 | 1;
}

/** Feature #3 — every point increment is user-editable. */
export interface Scoring {
  pawn: number;
  knight: number;
  bishop: number;
  rook: number;
  queen: number;
  king: number;
  checkmate: number;
  check: number;
}

export interface Settings {
  seats: Seat[];
  timeSec: number | null;
  commandeer: boolean;
  kingHunt: boolean;
  setup: ArmySetup | null;
  mode: GameMode;
  winCondition: WinCondition;
  scoring: Scoring;
  pointsToWin: number;
}

export function presetSeats(humans: number): Seat[] {
  return ['Red', 'Blue', 'Amber', 'Green'].map((name, i) => ({
    name: i < humans ? `Player ${name}` : `Bot ${name[0]}`,
    kind: i < humans ? 'human' : 'bot',
    difficulty: i % 2 === 0 ? 'normal' : 'easy',
    team: (i % 2) as 0 | 1,
  }));
}

export function defaultSeats(): Seat[] {
  return presetSeats(2);
}

export const PLAYERS = [
  { name: 'Red', main: '#ef4444' },
  { name: 'Blue', main: '#3b82f6' },
  { name: 'Amber', main: '#f59e0b' },
  { name: 'Green', main: '#22c55e' },
];

export const SEAT_NAMES = ['Red', 'Blue', 'Amber', 'Green'];

export const CLOCKS = [
  { label: 'None', value: null },
  { label: '1 min', value: 60 },
  { label: '3 min', value: 180 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
  { label: '15 min', value: 900 },
];

export const PRESETS = [
  { humans: 4, bots: 0 },
  { humans: 3, bots: 1 },
  { humans: 2, bots: 2 },
  { humans: 1, bots: 3 },
  { humans: 0, bots: 4 },
];

export const DEFAULT_SCORING: Scoring = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 20,
  checkmate: 15,
  check: 1,
};

export const SCORING_FIELDS: {
  key: keyof Scoring;
  label: string;
  hint: string;
  glyph: string;
}[] = [
  { key: 'pawn', label: 'Eating pawn', hint: 'Capture an enemy pawn', glyph: '♟' },
  { key: 'knight', label: 'Eating knight', hint: 'Capture an enemy knight', glyph: '♞' },
  { key: 'bishop', label: 'Eating bishop', hint: 'Capture an enemy bishop', glyph: '♝' },
  { key: 'rook', label: 'Eating rook', hint: 'Capture an enemy rook', glyph: '♜' },
  { key: 'queen', label: 'Eating queen', hint: 'Capture an enemy queen', glyph: '♛' },
  { key: 'king', label: 'Eating king', hint: 'Capture an enemy king (king hunt)', glyph: '♚' },
  { key: 'checkmate', label: 'Checkmating king', hint: 'Deliver a mating blow', glyph: '⚔' },
  { key: 'check', label: 'Regular check king', hint: 'Put an enemy king in check', glyph: '⚠' },
];

export function scoreForCapture(type: PieceType, s: Scoring): number {
  switch (type) {
    case 'p': return s.pawn;
    case 'n': return s.knight;
    case 'b': return s.bishop;
    case 'r': return s.rook;
    case 'q': return s.queen;
    default: return s.king;
  }
}

export const TEAM_INFO = [
  { name: 'Team Alpha', color: '#a855f7', soft: 'rgba(168,85,247,.14)' },
  { name: 'Team Omega', color: '#06b6d4', soft: 'rgba(6,182,212,.14)' },
];

/** Feature #1 — any split: 1v3, 2v2, 3v1 … */
export const TEAM_PRESETS: { label: string; detail: string; teams: (0 | 1)[] }[] = [
  { label: '2 v 2 · Cross', detail: 'Red + Amber vs Blue + Green', teams: [0, 1, 0, 1] },
  { label: '2 v 2 · Adjacent', detail: 'Red + Blue vs Amber + Green', teams: [0, 0, 1, 1] },
  { label: '1 v 3', detail: 'Red alone vs the other three', teams: [0, 1, 1, 1] },
  { label: '3 v 1', detail: 'Red, Blue, Amber vs Green', teams: [0, 0, 0, 1] },
  { label: '1 v 3 · Blue', detail: 'Blue alone vs the other three', teams: [0, 1, 0, 0] },
  { label: '3 v 1 · Amber', detail: 'Red, Blue, Green vs Amber', teams: [0, 0, 1, 0] },
];

// ✅ Single named export — object value (matches App.tsx useState)
export const defaultSettings: Settings = {
  seats: defaultSeats(),
  timeSec: 300,
  commandeer: true,
  kingHunt: false,
  setup: null,
  mode: 'ffa',
  winCondition: 'classic',
  scoring: { ...DEFAULT_SCORING },
  pointsToWin: 0,
};

/** Team index per seat for the active mode (FFA => every seat is its own team). */
export function teamsOf(settings: Settings): number[] {
  if (settings.mode === 'team') return settings.seats.map(s => s.team);
  return [0, 1, 2, 3];
}

export function teamMembers(settings: Settings, team: 0 | 1): number[] {
  return teamsOf(settings).map((t, i) => (t === team ? i : -1)).filter(i => i >= 0);
}

export function activeTeamIds(settings: Settings): number[] {
  return Array.from(new Set(teamsOf(settings))).sort((a, b) => a - b);
}

export function teamSplitLabel(settings: Settings): string {
  if (settings.mode !== 'team') return 'Free-for-all';
  return `${teamMembers(settings, 0).length} v ${teamMembers(settings, 1).length}`;
}
