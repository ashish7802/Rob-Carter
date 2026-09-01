import { VoiceFilterType } from '../types';

export class AudioProcessor {
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private filterNodes: AudioNode[] = [];
  private currentFilter: VoiceFilterType = 'none';

  public init(rawStream: MediaStream): { processedStream: MediaStream; analyser: AnalyserNode } {
    if (this.audioCtx) {
      this.destroy();
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioCtx = new AudioContextClass();

    this.sourceNode = this.audioCtx.createMediaStreamSource(rawStream);
    this.destinationNode = this.audioCtx.createMediaStreamDestination();
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 128;
    this.analyserNode.smoothingTimeConstant = 0.8;

    this.applyFilter(this.currentFilter);

    return {
      processedStream: this.destinationNode.stream,
      analyser: this.analyserNode,
    };
  }

  public applyFilter(filterType: VoiceFilterType) {
    this.currentFilter = filterType;
    if (!this.audioCtx || !this.sourceNode || !this.destinationNode || !this.analyserNode) return;

    // Disconnect previous nodes
    try {
      this.sourceNode.disconnect();
      for (const node of this.filterNodes) {
        node.disconnect();
      }
    } catch (e) {
      // Ignore disconnect errors
    }
    this.filterNodes = [];

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    if (filterType === 'none') {
      // Direct pass-through
      this.sourceNode.connect(this.destinationNode);
      this.sourceNode.connect(this.analyserNode);
      return;
    }

    if (filterType === 'deep') {
      // Deep Voice: Low-pass filter + Bass boost
      const biquad = this.audioCtx.createBiquadFilter();
      biquad.type = 'lowshelf';
      biquad.frequency.value = 320;
      biquad.gain.value = 14;

      const lowpass = this.audioCtx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 1600;

      this.sourceNode.connect(biquad);
      biquad.connect(lowpass);
      lowpass.connect(this.destinationNode);
      lowpass.connect(this.analyserNode);

      this.filterNodes = [biquad, lowpass];
    } else if (filterType === 'helium') {
      // Helium / High Voice: High-pass filter + Treble boost
      const highshelf = this.audioCtx.createBiquadFilter();
      highshelf.type = 'highshelf';
      highshelf.frequency.value = 1800;
      highshelf.gain.value = 15;

      const highpass = this.audioCtx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 850;

      this.sourceNode.connect(highpass);
      highpass.connect(highshelf);
      highshelf.connect(this.destinationNode);
      highshelf.connect(this.analyserNode);

      this.filterNodes = [highpass, highshelf];
    } else if (filterType === 'robot') {
      // Cyber Robot: Ring Modulator (Oscillator + Gain)
      const osc = this.audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 65; // Robotic modulation carrier frequency
      osc.start();

      const gain = this.audioCtx.createGain();
      gain.gain.value = 0.8;

      const bandpass = this.audioCtx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1200;
      bandpass.Q.value = 3;

      this.sourceNode.connect(gain);
      osc.connect(gain.gain);
      gain.connect(bandpass);
      bandpass.connect(this.destinationNode);
      bandpass.connect(this.analyserNode);

      this.filterNodes = [osc, gain, bandpass];
    } else if (filterType === 'whisper') {
      // Whisper / Espionage: Bandpass with gentle compression
      const bandpass = this.audioCtx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 2400;
      bandpass.Q.value = 1.8;

      const highpass = this.audioCtx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 1400;

      const compressor = this.audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-30, this.audioCtx.currentTime);
      compressor.knee.setValueAtTime(40, this.audioCtx.currentTime);
      compressor.ratio.setValueAtTime(12, this.audioCtx.currentTime);

      this.sourceNode.connect(bandpass);
      bandpass.connect(highpass);
      highpass.connect(compressor);
      compressor.connect(this.destinationNode);
      compressor.connect(this.analyserNode);

      this.filterNodes = [bandpass, highpass, compressor];
    } else if (filterType === 'radio') {
      // Walkie-Talkie / Radio Comm: Low + High pass + Slight distortion
      const highpass = this.audioCtx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 500;

      const lowpass = this.audioCtx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 2200;

      const waveShaper = this.audioCtx.createWaveShaper();
      waveShaper.curve = this.makeDistortionCurve(20);

      this.sourceNode.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(waveShaper);
      waveShaper.connect(this.destinationNode);
      waveShaper.connect(this.analyserNode);

      this.filterNodes = [highpass, lowpass, waveShaper];
    }
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public destroy() {
    for (const node of this.filterNodes) {
      try {
        if ('stop' in node && typeof (node as any).stop === 'function') {
          (node as any).stop();
        }
        node.disconnect();
      } catch (e) {}
    }
    this.filterNodes = [];
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
