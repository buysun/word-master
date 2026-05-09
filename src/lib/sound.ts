// Simple quiz sound effects using Web Audio API
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq: number, duration: number, startOffset = 0, type: OscillatorType = "sine", gain = 0.15) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = 0;
  osc.connect(g).connect(c.destination);
  const start = c.currentTime + startOffset;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playCorrect() {
  // Bright two-note chime
  tone(880, 0.15, 0, "triangle", 0.18);
  tone(1320, 0.25, 0.1, "triangle", 0.18);
}

export function playWrong() {
  // Low buzzer
  tone(220, 0.25, 0, "sawtooth", 0.15);
  tone(160, 0.3, 0.12, "sawtooth", 0.15);
}
