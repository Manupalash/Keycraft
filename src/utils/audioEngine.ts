import { AmbientTrack, SwitchProfile } from '../types/typing';

interface AmbientNodeGroup {
  source: AudioBufferSourceNode;
  gain: GainNode;
  lfo?: OscillatorNode;
}

class MechanicalAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ambientNodes: Partial<Record<AmbientTrack, AmbientNodeGroup>> = {};
  private ambientMasterGain: GainNode | null = null;
  private masterMuted = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (!this.noiseBuffer && this.ctx) {
      this.noiseBuffer = this.createWhiteNoiseBuffer(this.ctx, 3);
    }
    if (!this.ambientMasterGain && this.ctx) {
      this.ambientMasterGain = this.ctx.createGain();
      this.ambientMasterGain.gain.value = this.masterMuted ? 0 : 1;
      this.ambientMasterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private createWhiteNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private createBrownNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let lastOut = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.4;
      }
      // Crossfade loop boundary to eliminate any seam
      const fadeSamples = Math.min(2048, Math.floor(length / 10));
      for (let i = 0; i < fadeSamples; i++) {
        const ratio = i / fadeSamples;
        data[i] = data[i] * ratio + data[length - fadeSamples + i] * (1 - ratio);
      }
    }
    return buffer;
  }

  private createRainBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        let sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
        // Subtle gentle raindrop transient speckles
        if (Math.random() < 0.0012) {
          sample += (Math.random() * 0.4 - 0.2);
        }
        data[i] = Math.max(-1, Math.min(1, sample));
      }
      const fadeSamples = Math.min(4096, Math.floor(length / 10));
      for (let i = 0; i < fadeSamples; i++) {
        const ratio = i / fadeSamples;
        data[i] = data[i] * ratio + data[length - fadeSamples + i] * (1 - ratio);
      }
    }
    return buffer;
  }

  public setMasterMuted(muted: boolean): void {
    this.masterMuted = muted;
    if (this.ctx && this.ambientMasterGain) {
      const now = this.ctx.currentTime;
      this.ambientMasterGain.gain.cancelScheduledValues(now);
      this.ambientMasterGain.gain.setValueAtTime(
        this.ambientMasterGain.gain.value,
        now
      );
      this.ambientMasterGain.gain.linearRampToValueAtTime(
        muted ? 0 : 1,
        now + 0.08
      );
    }
  }

  public playKeyClick(
    key: string,
    profile: SwitchProfile,
    volume: number,
    isError = false
  ): void {
    if (this.masterMuted || profile === 'muted' || volume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const isSpaceOrModifier = key === ' ' || key === 'Enter' || key === 'Backspace';
    const pitchFactor = isSpaceOrModifier
      ? 0.78
      : 0.94 + ((key.charCodeAt(0) % 13) / 13) * 0.14;
    const masterGain = Math.min(1, Math.max(0, volume)) * (isError ? 0.5 : 0.75);

    if (isError) {
      // Muted, dull bottom-out tap so errors feel distinct without harsh beeps
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(115, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.045);
      g.gain.setValueAtTime(masterGain * 0.35, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.055);
      return;
    }

    if (profile === 'tactile') {
      // Crisp noise snap + warm tactile housing thump
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1650 * pitchFactor, now);
      bp.Q.setValueAtTime(2.2, now);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(masterGain * 0.42, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
      noise.connect(bp);
      bp.connect(ng);
      ng.connect(ctx.destination);
      noise.start(now, Math.random() * 1.5, 0.028);

      const bodyOsc = ctx.createOscillator();
      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(195 * pitchFactor, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(88 * pitchFactor, now + 0.032);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(masterGain * 0.36, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.036);
      bodyOsc.connect(bg);
      bg.connect(ctx.destination);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.04);
    } else if (profile === 'clicky') {
      // Sharp click-jacket snap
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(2900 * pitchFactor, now);
      hp.Q.setValueAtTime(3.6, now);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(masterGain * 0.55, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.016);
      noise.connect(hp);
      hp.connect(ng);
      ng.connect(ctx.destination);
      noise.start(now, Math.random() * 1.5, 0.02);

      const snapOsc = ctx.createOscillator();
      snapOsc.type = 'sine';
      snapOsc.frequency.setValueAtTime(980 * pitchFactor, now);
      snapOsc.frequency.exponentialRampToValueAtTime(320 * pitchFactor, now + 0.014);
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(masterGain * 0.25, now);
      sg.gain.exponentialRampToValueAtTime(0.001, now + 0.016);
      snapOsc.connect(sg);
      sg.connect(ctx.destination);
      snapOsc.start(now);
      snapOsc.stop(now + 0.02);
    } else if (profile === 'thocky') {
      // Deep PBT keycap thock
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(740 * pitchFactor, now);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(masterGain * 0.34, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
      noise.connect(lp);
      lp.connect(ng);
      ng.connect(ctx.destination);
      noise.start(now, Math.random() * 1.5, 0.038);

      const thockOsc = ctx.createOscillator();
      thockOsc.type = 'sine';
      thockOsc.frequency.setValueAtTime(145 * pitchFactor, now);
      thockOsc.frequency.exponentialRampToValueAtTime(62 * pitchFactor, now + 0.048);
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(masterGain * 0.5, now);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.052);
      thockOsc.connect(tg);
      tg.connect(ctx.destination);
      thockOsc.start(now);
      thockOsc.stop(now + 0.055);
    }
  }

  public updateAmbientTrack(track: AmbientTrack, volume: number): void {
    const clamped = Math.min(1, Math.max(0, volume));
    if (clamped <= 0.01) {
      const existing = this.ambientNodes[track];
      if (existing && this.ctx) {
        const now = this.ctx.currentTime;
        existing.gain.gain.cancelScheduledValues(now);
        existing.gain.gain.setValueAtTime(existing.gain.gain.value, now);
        existing.gain.gain.linearRampToValueAtTime(0, now + 0.12);
        const toStop = existing;
        delete this.ambientNodes[track];
        setTimeout(() => {
          try {
            toStop.source.stop();
            toStop.lfo?.stop();
          } catch {
            // Already stopped
          }
        }, 160);
      }
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx || !this.ambientMasterGain) return;

    let group = this.ambientNodes[track];
    if (!group) {
      group = this.startAmbientNode(ctx, track, this.ambientMasterGain);
      this.ambientNodes[track] = group;
    }

    const now = ctx.currentTime;
    const scale = track === 'rain' ? 0.34 : track === 'cafe' ? 0.32 : 0.28;
    group.gain.gain.cancelScheduledValues(now);
    group.gain.gain.setValueAtTime(group.gain.gain.value, now);
    group.gain.gain.linearRampToValueAtTime(clamped * scale, now + 0.15);
  }

  private startAmbientNode(
    ctx: AudioContext,
    track: AmbientTrack,
    destination: AudioNode
  ): AmbientNodeGroup {
    const source = ctx.createBufferSource();
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    if (track === 'rain') {
      source.buffer = this.createRainBuffer(ctx, 6);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 260;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3400;
      source.connect(hp);
      hp.connect(lp);
      lp.connect(gain);
      gain.connect(destination);
      source.start();
      return { source, gain };
    }

    if (track === 'cafe') {
      // Warm distant cafe room murmur with subtle slow swell
      source.buffer = this.createBrownNoiseBuffer(ctx, 6);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 460;
      bp.Q.value = 0.65;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.18;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 110;
      lfo.connect(lfoGain);
      lfoGain.connect(bp.frequency);

      source.connect(bp);
      bp.connect(gain);
      gain.connect(destination);
      source.start();
      lfo.start();
      return { source, gain, lfo };
    }

    // Warm brown noise
    source.buffer = this.createBrownNoiseBuffer(ctx, 6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 340;
    source.connect(lp);
    lp.connect(gain);
    gain.connect(destination);
    source.start();
    return { source, gain };
  }

  public playMilestoneTick(
    streak: number,
    profile: SwitchProfile,
    volume: number
  ): void {
    if (this.masterMuted || profile === 'muted' || volume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Gentle ascending pentatonic interval as streak climbs
    const tier = Math.min(4, Math.floor(streak / 25));
    const freqs = [523.25, 587.33, 659.25, 783.99, 880.0];
    const freq = freqs[tier] ?? 659.25;
    const gainLevel = Math.min(1, Math.max(0, volume)) * 0.14;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(gainLevel, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.24);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playCompletionChime(
    isPersonalBest: boolean,
    profile: SwitchProfile,
    volume: number
  ): void {
    if (this.masterMuted || profile === 'muted' || volume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const baseGain = Math.min(1, Math.max(0, volume)) * 0.16;
    // Warm C-major ninth arpeggio for PB; serene fifth for standard finish
    const notes = isPersonalBest
      ? [523.25, 659.25, 783.99, 1174.66]
      : [523.25, 783.99];
    const step = isPersonalBest ? 0.075 : 0.09;

    notes.forEach((freq, i) => {
      const start = now + i * step;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(baseGain * (1 - i * 0.1), start + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0008, start + 0.45);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.48);
    });
  }

  public syncAmbientState(
    volumes: Record<AmbientTrack, number>,
    masterMuted: boolean
  ): void {
    this.setMasterMuted(masterMuted);
    (Object.keys(volumes) as AmbientTrack[]).forEach((track) => {
      if (volumes[track] > 0.01 || this.ambientNodes[track]) {
        this.updateAmbientTrack(track, volumes[track]);
      }
    });
  }
}

export const audioEngine = new MechanicalAudioEngine();
