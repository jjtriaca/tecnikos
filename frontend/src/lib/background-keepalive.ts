/**
 * Background Keep-Alive for PWA GPS Tracking
 *
 * Problem: Chrome on Android suspends background tabs, killing watchPosition.
 * Solution: Play a silent audio loop — Chrome won't suspend tabs playing audio.
 * Combined with Wake Lock API to prevent screen from turning off.
 *
 * Usage:
 *   const keepalive = startBackgroundKeepAlive();
 *   // ... do GPS tracking ...
 *   keepalive.stop();
 */

let audioContext: AudioContext | null = null;
let oscillatorNode: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let wakeLockSentinel: WakeLockSentinel | null = null;

export function startBackgroundKeepAlive(): { stop: () => void } {
  // 1. Silent audio oscillator — keeps Chrome alive in background
  try {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    oscillatorNode = audioContext.createOscillator();
    gainNode = audioContext.createGain();

    // Frequency 1Hz (inaudible), gain 0.001 (essentially silent)
    oscillatorNode.frequency.value = 1;
    gainNode.gain.value = 0.001;

    oscillatorNode.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillatorNode.start();
  } catch {
    // AudioContext not supported — continue without it
  }

  // 2. Wake Lock — prevents screen from turning off (good for driving)
  requestWakeLock();

  // Re-acquire wake lock when page becomes visible again (user returns to app)
  const handleVisibility = () => {
    if (document.visibilityState === "visible") {
      requestWakeLock();
      // Resume AudioContext if suspended (Chrome suspends on tab switch)
      if (audioContext?.state === "suspended") {
        audioContext.resume().catch(() => {});
      }
    }
  };
  document.addEventListener("visibilitychange", handleVisibility);

  return {
    stop() {
      // Stop audio
      try {
        oscillatorNode?.stop();
        oscillatorNode?.disconnect();
        gainNode?.disconnect();
        audioContext?.close();
      } catch { /* ignore */ }
      oscillatorNode = null;
      gainNode = null;
      audioContext = null;

      // Release wake lock
      try {
        wakeLockSentinel?.release();
      } catch { /* ignore */ }
      wakeLockSentinel = null;

      document.removeEventListener("visibilitychange", handleVisibility);
    },
  };
}

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
    }
  } catch {
    // Wake Lock not supported or permission denied — not critical
  }
}
