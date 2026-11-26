// Self-contained Web Audio API synthesizer for classroom sound effects

class ClassroomSoundEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Ignore autoplay restrictions until next user gesture
      });
    }
    return this.ctx;
  }

  public unlock(): void {
    this.getContext();
  }

  /**
   * Soft marimba-style tick during the random picker roll.
   * Pitch gently rises as progress goes from 0 -> 1.
   */
  public playTick(progress: number = 0.5): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Pentatonic-inspired frequency curve from ~440Hz to ~660Hz
    const freq = 420 + Math.min(Math.max(progress, 0), 1) * 260;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.72, now + 0.055);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  /**
   * Bright, celebratory chime chord when a student is selected.
   */
  public playWinnerFanfare(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // C5 - E5 - G5 - C6 bright chime arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.075;
      const duration = idx === notes.length - 1 ? 0.75 : 0.4;

      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 2, startTime);

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.04, startTime);
      overtoneGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.5);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      overtone.connect(overtoneGain);
      overtoneGain.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      overtone.start(startTime);
      osc.stop(startTime + duration + 0.02);
      overtone.stop(startTime + duration + 0.02);
    });
  }

  /**
   * Cascading shuffle chime for automatic group generation.
   */
  public playShuffleChime(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [392.0, 493.88, 587.33, 783.99]; // G4 - B4 - D5 - G5

    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  /**
   * Subtle tactile UI click.
   */
  public playClick(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.025);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.03);
  }
}

export const soundEngine = new ClassroomSoundEngine();
