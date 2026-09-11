// src/game/sound.ts
let ctx: AudioContext | null = null;

function beep(freq = 440, ms = 60, gain = 0.05) {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000);
  } catch {
    /* audio is a nicety, never fatal */
  }
}

export const Sound = {
  enabled: true,
  move() { if (this.enabled) beep(520, 40); },
  capture() { if (this.enabled) beep(280, 70); },
  promote() { if (this.enabled) beep(700, 90); },
  select() { if (this.enabled) beep(400, 25, 0.03); },
  check() { if (this.enabled) beep(880, 100); },
  eliminate() { if (this.enabled) beep(160, 140); },
  win() { if (this.enabled) beep(660, 200); },
  start() { if (this.enabled) beep(500, 80); },
  tick() { if (this.enabled) beep(900, 30, 0.02); },
};
