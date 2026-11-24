// Web Audio API engine for realistic DTMF dual-tones, telephony G.711 filtering, and TTS preview

class TelephonyAudioEngine {
  private audioCtx: AudioContext | null = null;
  private telephonyFilterNode: BiquadFilterNode | null = null;
  private lowpassFilterNode: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;
  private isTelephonyFilterActive = true;
  private ringbackInterval: any = null;
  private holdMusicInterval: any = null;

  // Standard Bell System / ITU DTMF frequency matrix
  private dtmfFreqs: Record<string, [number, number]> = {
    '1': [697, 1209],
    '2': [697, 1336],
    '3': [697, 1477],
    '4': [770, 1209],
    '5': [770, 1336],
    '6': [770, 1477],
    '7': [852, 1209],
    '8': [852, 1336],
    '9': [852, 1477],
    '*': [941, 1209],
    '0': [941, 1336],
    '#': [941, 1477],
  };

  private initContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();

      // Master output gain
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 0.8;

      // Telephone standard G.711 Bandpass (300 Hz - 3400 Hz)
      this.telephonyFilterNode = this.audioCtx.createBiquadFilter();
      this.telephonyFilterNode.type = 'highpass';
      this.telephonyFilterNode.frequency.value = 300;
      this.telephonyFilterNode.Q.value = 0.8;

      this.lowpassFilterNode = this.audioCtx.createBiquadFilter();
      this.lowpassFilterNode.type = 'lowpass';
      this.lowpassFilterNode.frequency.value = 3400;
      this.lowpassFilterNode.Q.value = 0.8;

      // Chain: node -> highpass -> lowpass -> master -> destination
      this.telephonyFilterNode.connect(this.lowpassFilterNode);
      this.lowpassFilterNode.connect(this.masterGain);
      this.masterGain.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public setTelephonyFilter(enabled: boolean) {
    this.isTelephonyFilterActive = enabled;
  }

  public getTelephonyFilter(): boolean {
    return this.isTelephonyFilterActive;
  }

  public setVolume(vol: number) {
    this.initContext();
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, vol));
    }
  }

  // Play standard DTMF touch-tone
  public playDTMF(digit: string, durationMs = 180): Promise<void> {
    return new Promise((resolve) => {
      this.initContext();
      if (!this.audioCtx) {
        resolve();
        return;
      }

      const freqs = this.dtmfFreqs[digit];
      if (!freqs) {
        resolve();
        return;
      }

      const [rowFreq, colFreq] = freqs;
      const startTime = this.audioCtx.currentTime;
      const stopTime = startTime + durationMs / 1000;

      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const toneGain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(rowFreq, startTime);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(colFreq, startTime);

      toneGain.gain.setValueAtTime(0.2, startTime);
      toneGain.gain.exponentialRampToValueAtTime(0.001, stopTime);

      const targetDestination = this.isTelephonyFilterActive && this.telephonyFilterNode
        ? this.telephonyFilterNode
        : this.masterGain || this.audioCtx.destination;

      osc1.connect(toneGain);
      osc2.connect(toneGain);
      toneGain.connect(targetDestination);

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(stopTime);
      osc2.stop(stopTime);

      setTimeout(() => {
        resolve();
      }, durationMs);
    });
  }

  // Play realistic North American Ringback tone (440Hz + 480Hz, 2s on, 4s off)
  public startRingback(): () => void {
    this.initContext();
    this.stopRingback();

    if (!this.audioCtx) return () => {};

    const playCycle = () => {
      if (!this.audioCtx) return;
      const startTime = this.audioCtx.currentTime;
      const ringDuration = 1.6;
      const stopTime = startTime + ringDuration;

      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, startTime);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(480, startTime);

      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.setValueAtTime(0.12, stopTime - 0.05);
      gain.gain.linearRampToValueAtTime(0.001, stopTime);

      const target = this.isTelephonyFilterActive && this.telephonyFilterNode
        ? this.telephonyFilterNode
        : this.masterGain || this.audioCtx.destination;

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(target);

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(stopTime);
      osc2.stop(stopTime);
    };

    playCycle();
    this.ringbackInterval = setInterval(playCycle, 4000);

    return () => this.stopRingback();
  }

  public stopRingback() {
    if (this.ringbackInterval) {
      clearInterval(this.ringbackInterval);
      this.ringbackInterval = null;
    }
  }

  // Synthesize realistic soft hold music chords (representing Asterisk MOH class default)
  public startHoldMusic(): () => void {
    this.initContext();
    this.stopHoldMusic();

    if (!this.audioCtx) return () => {};

    const chords = [
      [261.63, 329.63, 392.0], // C
      [220.0, 261.63, 329.63], // Am
      [174.61, 220.0, 261.63], // F
      [196.0, 246.94, 293.66], // G
    ];
    let chordIdx = 0;

    const playChord = () => {
      if (!this.audioCtx) return;
      const chord = chords[chordIdx % chords.length];
      chordIdx++;
      const startTime = this.audioCtx.currentTime;
      const duration = 2.2;
      const stopTime = startTime + duration;

      chord.forEach((freq) => {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.04, startTime);
        gain.gain.linearRampToValueAtTime(0.005, stopTime);

        const target = this.isTelephonyFilterActive && this.telephonyFilterNode
          ? this.telephonyFilterNode
          : this.masterGain || this.audioCtx.destination;

        osc.connect(gain);
        gain.connect(target);

        osc.start(startTime);
        osc.stop(stopTime);
      });
    };

    playChord();
    this.holdMusicInterval = setInterval(playChord, 2400);

    return () => this.stopHoldMusic();
  }

  public stopHoldMusic() {
    if (this.holdMusicInterval) {
      clearInterval(this.holdMusicInterval);
      this.holdMusicInterval = null;
    }
  }

  // TTS Speech Synthesis with cancellation and completion promise
  public speakTTS(
    text: string,
    options?: {
      voiceName?: string;
      rate?: number;
      pitch?: number;
      onBoundary?: (charIndex: number) => void;
    }
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        // Fallback for environment without Web Speech
        setTimeout(resolve, Math.max(1000, text.length * 60));
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options?.rate || 1.0;
      utterance.pitch = options?.pitch || 1.0;

      // Select matching voice if available
      const voices = window.speechSynthesis.getVoices();
      if (options?.voiceName && voices.length > 0) {
        const found = voices.find(
          (v) =>
            v.name.toLowerCase().includes(options.voiceName!.toLowerCase()) ||
            v.lang.startsWith('en')
        );
        if (found) utterance.voice = found;
      }

      utterance.onend = () => {
        resolve();
      };

      utterance.onerror = () => {
        resolve();
      };

      if (options?.onBoundary) {
        utterance.onboundary = (e) => {
          options.onBoundary?.(e.charIndex);
        };
      }

      window.speechSynthesis.speak(utterance);
    });
  }

  public stopAllAudio() {
    this.stopRingback();
    this.stopHoldMusic();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const telephonyAudio = new TelephonyAudioEngine();
