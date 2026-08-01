// src/game/sound.ts
function beep(_freq = 440, _ms = 60) {
  // no-op stub (keeps build/runtime safe without AudioContext requirements)
}

export const Sound = {
  enabled: true,
  move() { if (this.enabled) beep(520, 40); },
  capture() { if (this.enabled) beep(280, 70); },
  promote() { if (this.enabled) beep(700, 90); },
  select() { if (this.enabled) beep(400, 25); },
  check() { if (this.enabled) beep(880, 100); },
  eliminate() { if (this.enabled) beep(160, 140); },
  win() { if (this.enabled) beep(660, 200); },
  start() { if (this.enabled) beep(500, 80); },
  tick() { if (this.enabled) beep(900, 30); },
};
