const MAX_VOICES = 24;
const FLOOR = 0.0001;

/** Short synthesised effects. Constructing this class never opens an audio device. */
export class GameAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.compressor = null;
    this.noise = null;
    this.volume = 0.25;
    this.enabled = false;
    this.voices = new Set();
    this.unavailable = false;
  }

  get state() {
    if (this.unavailable || !(globalThis.AudioContext || globalThis.webkitAudioContext)) {
      return 'unavailable';
    }
    if (!this.context) return 'locked';
    if (this.context.state === 'closed') return 'unavailable';
    return this.context.state === 'running' ? 'running' : 'suspended';
  }

  async unlock() {
    try {
      if (!this.context || this.context.state === 'closed') {
        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContext) {
          this.unavailable = true;
          return false;
        }

        this.stop();
        this.context = new AudioContext({ latencyHint: 'interactive' });
        this.master = this.context.createGain();
        this.compressor = this.context.createDynamicsCompressor();
        this.compressor.threshold.value = -16;
        this.compressor.knee.value = 12;
        this.compressor.ratio.value = 10;
        this.compressor.attack.value = 0.002;
        this.compressor.release.value = 0.09;
        this.compressor.connect(this.master);
        this.master.connect(this.context.destination);
        this.master.gain.value = this.enabled ? this.volume : 0;

        this.noise = this.context.createBuffer(1, this.context.sampleRate / 2, this.context.sampleRate);
        const samples = this.noise.getChannelData(0);
        for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;
        this.unavailable = false;
      }

      if (this.context.state !== 'running') await this.context.resume();
      return this.context.state === 'running';
    } catch {
      if (!this.context) this.unavailable = true;
      return false;
    }
  }

  setVolume(value) {
    const volume = Number(value);
    if (!Number.isFinite(volume)) return;
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.master) this.master.gain.value = this.enabled ? this.volume : 0;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.master) this.master.gain.value = this.enabled ? this.volume : 0;
    if (!this.enabled) this.stop();
  }

  play(events, settings) {
    if (!this.enabled || !settings.sound || this.state !== 'running') return;

    for (const event of events) {
      const pan = Number.isFinite(event.x) ? Math.max(-0.65, Math.min(0.65, (event.x / 1280 - 0.5) * 1.3)) : 0;

      switch (event.type) {
        case 'shot': {
          const player = event.owner === 'player';
          this.tone(player ? 760 : 380, 130, 0.055, player ? 0.15 : 0.09, 'triangle', pan);
          this.hiss(0.055, player ? 0.12 : 0.07, player ? 2100 : 1100, pan);
          if (settings.bass) this.tone(player ? 115 : 80, 40, 0.10, 0.16, 'sine', pan);
          break;
        }
        case 'hit':
          if (event.target === 'player') {
            this.tone(560, 130, 0.17, 0.16, 'sawtooth', 0);
            this.hiss(0.09, 0.12, 1500, 0);
            if (settings.bass) this.tone(95, 35, 0.16, 0.19, 'sine', 0);
          } else {
            this.tone(310, 140, event.lethal ? 0.04 : 0.075, 0.13, 'triangle', pan);
            this.hiss(0.045, 0.10, 2800, pan);
          }
          break;
        case 'death':
          this.tone(event.kind === 'hound' ? 280 : 210, 55, 0.18, 0.15, 'triangle', pan);
          this.hiss(0.13, 0.13, 1200, pan);
          if (settings.bass) this.tone(105, 30, 0.19, 0.19, 'sine', pan);
          break;
        case 'gameover':
          this.stop();
          [330, 247, 165].forEach((frequency, index) => {
            this.tone(frequency, frequency * 0.75, 0.22, 0.15, 'triangle', 0, index * 0.13);
          });
          if (settings.bass) this.tone(85, 30, 0.35, 0.20, 'sine', 0);
          break;
        default:
          break;
      }
    }
  }

  stop() {
    for (const voice of this.voices) this.removeVoice(voice, true);
  }

  tone(frequency, endFrequency, duration, volume, type, pan, delay = 0) {
    if (this.voices.size >= MAX_VOICES) return;
    const source = this.context.createOscillator();
    const start = this.context.currentTime + delay;
    source.type = type;
    source.frequency.setValueAtTime(frequency, start);
    source.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    this.startVoice(source, duration, volume, pan, delay);
  }

  hiss(duration, volume, cutoff, pan) {
    if (this.voices.size >= MAX_VOICES) return;
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    this.startVoice(source, duration, volume, pan, 0, filter);
  }

  startVoice(source, duration, volume, pan, delay, filter = null) {
    const context = this.context;
    const start = context.currentTime + delay;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume, start + 0.003);
    envelope.gain.exponentialRampToValueAtTime(FLOOR, start + duration);
    envelope.gain.linearRampToValueAtTime(0, start + duration + 0.01);

    const nodes = [source];
    if (filter) {
      source.connect(filter);
      filter.connect(envelope);
      nodes.push(filter);
    } else {
      source.connect(envelope);
    }
    nodes.push(envelope);

    if (context.createStereoPanner) {
      const panner = context.createStereoPanner();
      panner.pan.value = pan;
      envelope.connect(panner);
      panner.connect(this.compressor);
      nodes.push(panner);
    } else {
      envelope.connect(this.compressor);
    }

    const voice = { source, nodes };
    this.voices.add(voice);
    source.onended = () => this.removeVoice(voice);
    if (source.buffer) {
      source.start(start, Math.random() * Math.max(0, this.noise.duration - duration - 0.02));
    } else {
      source.start(start);
    }
    source.stop(start + duration + 0.015);
  }

  removeVoice(voice, stop = false) {
    if (!this.voices.delete(voice)) return;
    voice.source.onended = null;
    if (stop) {
      try {
        voice.source.stop();
      } catch {
        // A source may already have ended before its event reaches JavaScript.
      }
    }
    for (const node of voice.nodes) node.disconnect();
  }
}
