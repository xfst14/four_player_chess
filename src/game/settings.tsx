// src/game/settings.ts

export interface Seat {
  name: string;
  type: 'human' | 'bot';
}

export interface Settings {
  seats: Seat[];
  timeSec: number | null;
  commandeer: boolean;
  kingHunt: boolean;
  setup: any | null;
}

export function defaultSeats(): Seat[] {
  return [
    { name: 'Red', type: 'human' },
    { name: 'Blue', type: 'human' },
    { name: 'Amber', type: 'human' },
    { name: 'Green', type: 'human' },
  ];
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
    humans: seats.filter(s => s.type === 'human').length,
    bots: seats.filter(s => s.type === 'bot').length,
  };
}
