let zhVoices = [];
let voiceIdx = 0;
let playCount = 0;
let currentAudio = null;

function loadVoices() {
  if (!('speechSynthesis' in window)) return [];
  const all = speechSynthesis.getVoices();
  const cn = all.filter(v => {
    const lang = String(v.lang || '').toLowerCase().replace('_', '-');
    const name = String(v.name || '').toLowerCase();
    if (
      lang.includes('hk') ||
      lang.includes('tw') ||
      lang.includes('mo') ||
      name.includes('cantonese') ||
      name.includes('yue') ||
      name.includes('hong kong') ||
      name.includes('taiwan')
    ) {
      return false;
    }
    return lang === 'zh-cn' || lang === 'cmn-hans-cn' || lang === 'zh';
  });
  if (cn.length) zhVoices = cn;
  return zhVoices;
}

if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

function speakTTS(text, rate = 1) {
  if (!('speechSynthesis' in window)) return;
if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
  speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';

  if (zhVoices.length) {
    const v = zhVoices[voiceIdx % zhVoices.length];
    u.voice = v;
    if (v.lang) u.lang = v.lang;
    voiceIdx++;
  }

  u.pitch = 1.0;
  u.rate = Math.min(2.0, +(rate * 1.3).toFixed(2));

  speechSynthesis.speak(u);
}
export function speak(text, { rate = 1, instant = false } = {}) {
  const clean = String(text || '').trim();
  if (!clean) return;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  if (instant) {
    speakTTS(clean, rate);
    return;
  }

  if ('speechSynthesis' in window && (speechSynthesis.speaking || speechSynthesis.pending)) {
    speechSynthesis.cancel();
  }

  playCount++;

  const host = 'raw.' + 'githubusercontent.com';
  const mp3Url = `https://${host}/hugolpz/audio-cmn/master/64k/cmn-${encodeURIComponent(clean)}.mp3`;

  const useNativeSpeaker = (rate >= 0.9) && (playCount % 2 === 1) && [...clean].length <= 4;

  if (useNativeSpeaker) {
    const audio = new Audio(mp3Url);
    audio.playbackRate = Math.min(1.6, +(rate * 1.15).toFixed(2));
    currentAudio = audio;
    audio.play().catch(() => {
      if (currentAudio === audio) speakTTS(clean, rate);
    });
  } else {
    speakTTS(clean, rate);
  }
}
