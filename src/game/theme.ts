// src/game/theme.ts
export const PLAYERS = [
  { name: 'Red', main: '#ef4444', mid: '#b91c1c', deep: '#7f1d1d', light: '#fecaca' },
  { name: 'Blue', main: '#3b82f6', mid: '#1d4ed8', deep: '#1e3a8a', light: '#bfdbfe' },
  { name: 'Amber', main: '#f59e0b', mid: '#b45309', deep: '#78350f', light: '#fde68a' },
  { name: 'Green', main: '#22c55e', mid: '#15803d', deep: '#14532d', light: '#bbf7d0' },
];

export const DEAD_COLORS = {
  main: '#64748b',
  mid: '#475569',
  deep: '#334155',
  light: '#cbd5e1',
};

export function playerColors(owner: number, alive: boolean) {
  return alive ? PLAYERS[owner] : { ...DEAD_COLORS, name: PLAYERS[owner].name };
}

export function fmtClock(sec: number | null): string {
  if (sec === null) return '--:--';
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${rest.toString().padStart(2, '0')}`;
}
