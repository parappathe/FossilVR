// Sons sintetizados na hora (sem arquivos). Só liga depois de um clique ou da entrada no VR;
// os testes nunca chamam unlock, então nunca tocam nada.
export class Sfx {
  constructor() { this.ctx = null; this.on = true; }

  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.on ? 0.9 : 0;
      this.master.connect(this.ctx.destination);
      this.white = this.makeNoise(3, false);
      this.brown = this.makeNoise(3, true);
      this.startAmbience();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  setOn(v) {
    this.on = v;
    if (this.master) this.master.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }
  makeNoise(sec, brown) {
    const c = this.ctx;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * sec), c.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { b = 0.98 * b + 0.02 * w; d[i] = b * 7; } else d[i] = w * 0.5;
    }
    return buf;
  }
  loop(buf, type, freq, q) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    return { f, g };
  }
  tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, slide = 0, attack = 0.004 } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, { vol = 0.1, freq = 1200, q = 1, at = 0, type = 'bandpass', attack = 0, sweep = 0 } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.white;
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * sweep), t + dur);
    g.gain.setValueAtTime(attack ? 0.0001 : vol, t);
    if (attack) g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 2); src.stop(t + dur + 0.05);
  }

  click() { this.tone(880, 0.05, { vol: 0.07, type: 'square' }); }
  good() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.25, { vol: 0.1, type: 'triangle', at: i * 0.08 })); }
  bad() { this.tone(330, 0.5, { vol: 0.1, type: 'triangle', slide: 0.7 }); this.tone(262, 0.6, { vol: 0.06, type: 'sine', slide: 0.7, at: 0.12 }); }
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, i === 5 ? 0.7 : 0.18, { vol: 0.12, type: 'triangle', at: i * 0.12 })); }
  star(n) { this.tone(784 * (1 + n * 0.26), 0.35, { vol: 0.12, type: 'triangle' }); }

  // ---- Fóssil ----
  deny() { this.tone(180, 0.15, { vol: 0.08, type: 'square' }); }
  pickUp() { this.tone(520, 0.06, { vol: 0.06, type: 'triangle', slide: 1.3 }); }
  brushStart() { this.noise(0.6, { vol: 0.05, freq: 3200, q: 0.8, attack: 0.05 }); }
  brushTick() { this.noise(0.08, { vol: 0.03, freq: 3600, q: 1 }); }
  brush() { this.noise(0.2, { vol: 0.06, freq: 1800, q: 0.7, sweep: 0.5 }); }
  swing() { this.noise(0.18, { vol: 0.05, freq: 900, q: 2, sweep: 2.2, attack: 0.1 }); }
  // picareta na terra: baque com cascalho
  pick() { this.tone(90, 0.2, { vol: 0.18, type: 'sine', slide: 0.5 }); for (let k = 0; k < 5; k++) this.noise(0.05, { vol: 0.07, freq: 1400 + Math.random() * 1500, q: 2, at: 0.02 + k * 0.03 }); }
  crack() { this.noise(0.12, { vol: 0.16, freq: 2600, q: 3 }); this.tone(200, 0.3, { vol: 0.08, type: 'sawtooth', slide: 0.5, at: 0.05 }); }
  // osso aparecendo: tom de madeira oca
  bone() { this.tone(660, 0.12, { vol: 0.08, type: 'triangle' }); this.tone(990, 0.2, { vol: 0.07, type: 'triangle', at: 0.08 }); }
  complete() { [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { vol: 0.08, type: 'triangle', at: i * 0.09 })); }

  // Deserto: vento leve e um gavião de vez em quando
  startAmbience() { this.amb = this.loop(this.white, 'bandpass', 600, 0.4); this.amb.g.gain.value = 0.015; this.birdT = 6; }
  updateAmbience(dt) {
    if (!this.ctx) return;
    this.birdT -= dt;
    if (this.birdT > 0) return;
    this.birdT = 10 + Math.random() * 12;
    this.tone(2400, 0.9, { vol: 0.012, type: 'sine', slide: 0.7, attack: 0.15 });
  }
}
