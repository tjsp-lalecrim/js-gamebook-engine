let soundEnabled = true;
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

export function playSound(type) {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'click') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.05);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === 'dice') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(280 + Math.random() * 200, now);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.04);
    osc.start(now);
    osc.stop(now + 0.04);
  } else if (type === 'success') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.setValueAtTime(440, now + 0.1);
    osc.frequency.setValueAtTime(660, now + 0.2);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.4);
  } else if (type === 'fail') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.35);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.35);
  }
}

export function toggleAudio() {
  soundEnabled = !soundEnabled;
  return soundEnabled;
}