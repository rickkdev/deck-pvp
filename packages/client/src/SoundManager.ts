// Web Audio API sound manager — generates simple tones for game events

type SoundName = 'cardPlay' | 'damage' | 'block' | 'turnStart' | 'victory' | 'defeat';

class SoundManager {
  private ctx: AudioContext | null = null;
  private _muted = false;

  get muted() {
    return this._muted;
  }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    // Resume if suspended (browsers require user gesture)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    return this._muted;
  }

  play(sound: SoundName) {
    if (this._muted) return;

    try {
      switch (sound) {
        case 'cardPlay':
          this.playTone(440, 0.08, 'sine', 0.3);
          this.playTone(660, 0.08, 'sine', 0.2, 0.05);
          break;
        case 'damage':
          this.playNoise(0.12, 0.4);
          this.playTone(200, 0.15, 'sawtooth', 0.25);
          break;
        case 'block':
          this.playTone(800, 0.06, 'sine', 0.2);
          this.playTone(1000, 0.06, 'sine', 0.15, 0.04);
          this.playTone(1200, 0.06, 'sine', 0.1, 0.08);
          break;
        case 'turnStart':
          this.playTone(523, 0.1, 'sine', 0.2);
          this.playTone(659, 0.1, 'sine', 0.2, 0.08);
          this.playTone(784, 0.15, 'sine', 0.2, 0.16);
          break;
        case 'victory':
          this.playTone(523, 0.2, 'sine', 0.3);
          this.playTone(659, 0.2, 'sine', 0.3, 0.15);
          this.playTone(784, 0.2, 'sine', 0.3, 0.3);
          this.playTone(1047, 0.4, 'sine', 0.3, 0.45);
          break;
        case 'defeat':
          this.playTone(400, 0.25, 'sine', 0.3);
          this.playTone(350, 0.25, 'sine', 0.3, 0.2);
          this.playTone(300, 0.25, 'sine', 0.3, 0.4);
          this.playTone(200, 0.5, 'sine', 0.3, 0.6);
          break;
      }
    } catch {
      // Silently ignore audio errors
    }
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ) {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.01);
  }

  private playNoise(duration: number, volume: number) {
    const ctx = this.getCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }
}

export const soundManager = new SoundManager();
