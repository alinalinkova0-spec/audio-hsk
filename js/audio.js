let zhVoices = [];
let femaleVoice = null;
let maleVoice = null;
let voiceIdx = 0;
let currentAudio = null;
const missingNativeCache = new Set();

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
      /cantonese|yue|hong kong|taiwan|hokkien|minnan|wuu|hakka/.test(name)
    ) {
      return false;
    }
    return lang === 'zh-cn' || lang === 'cmn-hans-cn' || lang === 'zh';
  });

  if (cn.length) {
    cn.sort((a, b) => {
      const score = v => {
        const n = String(v.name || '').toLowerCase();
        let s = 0;
        if (n.includes('natural') || n.includes('neural') || n.includes('online')) s += 10;
        if (n.includes('xiaoxiao') || n.includes('yunxi') || n.includes('google') || n.includes('ting-ting')) s += 5;
        return s;
      };
      return score(b) - score(a);
    });
    zhVoices = cn;

    femaleVoice = cn.find(v => /xiaoxiao|xiaoyi|yaoyao|huihui|ting-ting|female|woman/i.test(v.name)) || cn.at(0);
    maleVoice = cn.find(v => /yunxi|yunyang|yunjian|kangkang|male|man/i.test(v.name)) || cn.at(1) || cn.at(0);
  }
  return zhVoices;
}

if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

function speakTTS(text, rate = 1, speaker = null) {
  if (!('speechSynthesis' in window)) return;
  if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
  if (!zhVoices.length) loadVoices();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';

  if (zhVoices.length) {
    let v = zhVoices[voiceIdx % zhVoices.length];
    if (speaker === 'A' && femaleVoice) v = femaleVoice;
    else if (speaker === 'B' && maleVoice) v = maleVoice;
    else voiceIdx++;

    u.voice = v;
    u.lang = 'zh-CN';
  }

  u.pitch = speaker === 'B' ? 0.92 : 1.0;
  u.rate = Math.min(1.8, Math.max(0.55, +(rate * 1.05).toFixed(2)));
  speechSynthesis.speak(u);
}

export function speak(text, { rate = 1 } = {}) {
  const clean = String(text || '').trim();
  if (!clean) return;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  if ('speechSynthesis' in window && (speechSynthesis.speaking || speechSynthesis.pending)) {
    speechSynthesis.cancel();
  }

  const isShortWord = [...clean].length <= 4 && !/[，。！？、；：]/.test(clean);

  if (isShortWord && !missingNativeCache.has(clean)) {
    const host = 'raw.' + 'githubusercontent.com';
    const mp3Url = `https://${host}/hugolpz/audio-cmn/master/64k/cmn-${encodeURIComponent(clean)}.mp3`;
    const audio = new Audio(mp3Url);
    audio.playbackRate = Math.min(1.5, Math.max(0.65, +rate.toFixed(2)));
    currentAudio = audio;

    audio.onerror = () => {
      missingNativeCache.add(clean);
      if (currentAudio === audio) {
        currentAudio = null;
        speakTTS(clean, rate);
      }
    };

    audio.play().catch(() => {
      if (currentAudio === audio) {
        currentAudio = null;
        speakTTS(clean, rate);
      }
    });
    return;
  }

  speakTTS(clean, rate);
}

export function speakDialog(lines, { rate = 1 } = {}) {
  if (!('speechSynthesis' in window)) return;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  speechSynthesis.cancel();
  if (!zhVoices.length) loadVoices();

  const items = Array.isArray(lines) ? lines : [{ speaker: 'A', text: String(lines || '') }];
  let idx = 0;

  function playNext() {
    if (idx >= items.length) return;
    const item = items[idx++];
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = 'zh-CN';

    if (zhVoices.length) {
      const v = item.speaker === 'B' ? (maleVoice || zhVoices.at(0)) : (femaleVoice || zhVoices.at(0));
      u.voice = v;
      u.lang = 'zh-CN';
    }

    const sameVoice = femaleVoice && maleVoice && femaleVoice.name === maleVoice.name;
    u.pitch = item.speaker === 'B' ? (sameVoice ? 0.82 : 0.95) : (sameVoice ? 1.12 : 1.02);
    u.rate = Math.min(1.8, Math.max(0.55, +(rate * 1.02).toFixed(2)));

    u.onend = () => {
      if (idx < items.length) setTimeout(playNext, 380);
    };
    speechSynthesis.speak(u);
  }
  playNext();
}
