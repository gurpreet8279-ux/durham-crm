/**
 * Realistic Phone Notification Sound Synthesizer & Vibration
 * Uses Web Audio API & Navigator Vibration for an authentic iOS/Android phone push alert sound
 */

export function playPhoneNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Harmonic double-chime (iOS / Android style tri-tone push notification)
    // Note 1: E6 (1318.51 Hz) -> G#6 (1661.22 Hz) -> B6 (1975.53 Hz)
    const playNote = (freq: number, startTime: number, duration: number, gainValue: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(gainValue, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Note 1
    playNote(1046.50, now, 0.12, 0.25); // C6
    // Note 2
    playNote(1318.51, now + 0.09, 0.14, 0.3); // E6
    // Note 3
    playNote(1567.98, now + 0.18, 0.35, 0.35); // G6

    // Trigger haptic vibration if supported on mobile phone
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([80, 60, 120]);
    }
  } catch (err) {
    console.debug('Audio notification context blocked or not active yet:', err);
  }
}
