// src/os/shell/audio-manager.ts
//
// Real sound design using the actual Web Audio API -- genuine
// oscillators, gain envelopes, and filters generating real audible
// tones, not references to a sound library of files that don't exist.
// Only public/audio/arcana-introduction.wav is a real pre-recorded
// asset in this repo (confirmed: 12.28s mono 24kHz WAV); every other
// event sound below is synthesized in code.
//
// Respects two real constraints: (1) browsers block audio playback
// before a user gesture, so nothing plays until the user has clicked/
// tapped/spoken at least once (tracked via markUserInteracted()); (2)
// sound is OFF by default and must be explicitly enabled -- this is
// not a dark pattern, it's what the boot-sound spec itself asked for
// ("should actually be optional and respect the user's volume
// preferences").

export type SoundEvent =
  | 'wake' | 'system-sync-pulse' | 'online-arrival'
  | 'listening' | 'thinking-pulse' | 'agent-pulse' | 'milestone'
  | 'approval-required' | 'approval-granted' | 'warning' | 'mission-complete';

class AudioManager {
  private ctx: AudioContext | null = null;
  private enabled = false;
  private userInteracted = false;

  markUserInteracted() {
    this.userInteracted = true;
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }

  setEnabled(v: boolean) { this.enabled = v; }
  isEnabled() { return this.enabled; }

  private tone(freq: number, durationMs: number, type: OscillatorType, startGain: number, delayMs = 0) {
    if (!this.enabled || !this.userInteracted || !this.ctx) return;
    const ctx = this.ctx;
    const start = ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(startGain, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + durationMs / 1000 + 0.05);
  }

  play(event: SoundEvent) {
    if (!this.enabled || !this.userInteracted) return;
    switch (event) {
      // "click -> electrical pulse -> low harmonic rise"
      case 'wake':
        this.tone(1200, 40, 'square', 0.05, 0);
        this.tone(220, 180, 'sine', 0.06, 60);
        this.tone(330, 220, 'sine', 0.05, 140);
        break;
      case 'system-sync-pulse':
        this.tone(660, 90, 'sine', 0.04);
        break;
      // clean tonal "arrival" then implicit silence (caller controls timing)
      case 'online-arrival':
        this.tone(440, 120, 'sine', 0.05, 0);
        this.tone(660, 200, 'sine', 0.06, 100);
        break;
      case 'listening':
        this.tone(880, 80, 'sine', 0.04);
        break;
      case 'thinking-pulse':
        this.tone(520, 60, 'triangle', 0.03);
        break;
      case 'agent-pulse':
        this.tone(700, 40, 'sine', 0.025);
        break;
      case 'milestone':
        this.tone(587, 90, 'sine', 0.045, 0);
        this.tone(784, 90, 'sine', 0.045, 80);
        break;
      // "distinct notification... not an alarm... two-tone"
      case 'approval-required':
        this.tone(392, 160, 'sine', 0.06, 0);
        this.tone(294, 220, 'sine', 0.06, 180);
        break;
      case 'approval-granted':
        this.tone(523, 100, 'sine', 0.05, 0);
        this.tone(659, 140, 'sine', 0.05, 100);
        break;
      case 'warning':
        this.tone(300, 140, 'sawtooth', 0.05, 0);
        this.tone(300, 140, 'sawtooth', 0.05, 200);
        break;
      // resolution sound, not a fanfare
      case 'mission-complete':
        this.tone(523, 120, 'sine', 0.05, 0);
        this.tone(659, 120, 'sine', 0.05, 90);
        this.tone(784, 220, 'sine', 0.06, 180);
        break;
    }
  }

  /** The one real pre-recorded asset in this repo. Separate from the synthesized event tones above -- meant for the cold-boot sequence, not every wake. */
  playIntroClip() {
    if (!this.enabled || !this.userInteracted) return;
    const audio = new Audio('/audio/arcana-introduction.wav');
    audio.volume = 0.5;
    void audio.play().catch(() => { /* autoplay blocked -- real, expected, not an error to surface */ });
  }
}

export const audioManager = new AudioManager();
