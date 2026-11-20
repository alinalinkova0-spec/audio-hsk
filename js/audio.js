let zhVoices = [];
let voiceIdx = 0;
let playCount = 0;
let currentAudio = null;

function loadVoices() {
  if (!('speechSynthesis' in window)) return [];
  const all = speechSynthesis.getVoices();
  const cn = all.filter(v => v.lang && v.lang.toLowerCase().startsWith('zh'));
  if (cn.length) zhVoices = cn;
  return zhVoices;
}

if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

function speakTTS(text, rate = 1) {
  if (!('speechSynthesis' in window)) return;
  if (!zhVoices.length) loadVoices();
  speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';

  if (zhVoices.length) {
    const v = zhVoices[voiceIdx % zhVoices.length];
    u.voice = v;
    if (v.lang) u.lang = v.lang;
  }

  const pitches = [1.0, 0.92, 1.07, 0.96];
  u.pitch = pitches[voiceIdx % pitches.length];
  u.rate = rate;
  voiceIdx++;

  speechSynthesis.speak(u);
}

export function speak(text, { rate = 1 } = {}) {
  const clean = String(text || '').trim();
  if (!clean) return;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if ('speechSynthesis' in window) speechSynthesis.cancel();

  playCount++;

  const host = 'raw.' + 'github' + 'usercontent.com';
  const mp3Url = `https://${host}/hugolpz/audio-cmn/master/64k/cmn-${encodeURIComponent(clean)}.mp3`;

  const useNativeSpeaker = (rate === 1) && (playCount % 2 === 1) && clean.length <= 6;

  if (useNativeSpeaker) {
    const audio = new Audio(mp3Url);
    currentAudio = audio;
    audio.play().catch(() => {
      if (currentAudio === audio) speakTTS(clean, rate);
    });
  } else {
    speakTTS(clean, rate);
  }
}
