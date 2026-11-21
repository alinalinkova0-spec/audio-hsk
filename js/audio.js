let zhVoices = [];
let femaleVoice = null;
let maleVoice = null;
let voiceIdx = 0;
let currentAudio = null;
let dialogTimer = null;
let playSessionId = 0;
let isPaused = false;
let isPlaying = false;
let activePlayBtn = null;
const missingNativeCache = new Set();

const PLAY_SVG = '<svg width="36" height="36" viewBox="0 0 24 24" fill="#FFFDF9" style="margin-left:4px;"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE_SVG = '<svg width="34" height="34" viewBox="0 0 24 24" fill="#FFFDF9"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';

function syncPlayBtn() {
  if (!activePlayBtn || !document.body.contains(activePlayBtn)) return;
  activePlayBtn.innerHTML = (isPlaying && !isPaused) ? PAUSE_SVG : PLAY_SVG;
}

export function stopAudio() {
  playSessionId += 1;
  isPaused = false;
  isPlaying = false;
  if (dialogTimer) {
    clearTimeout(dialogTimer);
    dialogTimer = null;
  }
  if (currentAudio) {
    try { currentAudio.pause(); } catch {}
    currentAudio = null;
  }
  if ('speechSynthesis' in window) {
    try { speechSynthesis.cancel(); } catch {}
  }
  syncPlayBtn();
}

export function togglePause() {
  if (!isPlaying) return false;
  if (currentAudio) {
    if (isPaused) {
      isPaused = false;
      currentAudio.play().catch(() => {});
    } else {
      isPaused = true;
      currentAudio.pause();
    }
    syncPlayBtn();
    return true;
  }
  if ('speechSynthesis' in window) {
    if (isPaused) {
      isPaused = false;
      speechSynthesis.resume();
    } else {
      isPaused = true;
      speechSynthesis.pause();
    }
    syncPlayBtn();
    return true;
  }
  return false;
}

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

function speakTTS(text, rate = 1, speaker = null, sid = playSessionId) {
  if (!('speechSynthesis' in window)) return;
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
  isPlaying = true;
  isPaused = false;
  syncPlayBtn();

  u.onend = () => {
    if (sid !== playSessionId) return;
    isPlaying = false;
    isPaused = false;
    syncPlayBtn();
  };
  u.onerror = () => {
    if (sid !== playSessionId) return;
    isPlaying = false;
    isPaused = false;
    syncPlayBtn();
  };
  speechSynthesis.speak(u);
}
export function speak(text, { rate = 1 } = {}) {
  const clean = String(text || '').trim();
  if (!clean) return;

  stopAudio();
  const sid = playSessionId;

  const isShortWord = [...clean].length <= 4 && !/[，。！？、；：]/.test(clean);

  if (isShortWord && !missingNativeCache.has(clean)) {
    const host = 'raw.' + 'githubusercontent.com';
    const mp3Url = `https://${host}/hugolpz/audio-cmn/master/64k/cmn-${encodeURIComponent(clean)}.mp3`;
    const audio = new Audio(mp3Url);
    audio.playbackRate = Math.min(1.5, Math.max(0.65, +rate.toFixed(2)));
    currentAudio = audio;
    isPlaying = true;
    isPaused = false;
    syncPlayBtn();

    audio.onended = () => {
      if (sid !== playSessionId) return;
      currentAudio = null;
      isPlaying = false;
      isPaused = false;
      syncPlayBtn();
    };

    audio.onerror = () => {
      missingNativeCache.add(clean);
      if (sid === playSessionId && currentAudio === audio) {
        currentAudio = null;
        speakTTS(clean, rate, null, sid);
      }
    };

    audio.play().catch(() => {
      if (sid === playSessionId && currentAudio === audio) {
        currentAudio = null;
        speakTTS(clean, rate, null, sid);
      }
    });
    return;
  }

  speakTTS(clean, rate, null, sid);
}

export function speakDialog(lines, { rate = 1 } = {}) {
  if (!('speechSynthesis' in window)) return;
  stopAudio();
  const sid = playSessionId;
  if (!zhVoices.length) loadVoices();

  const items = Array.isArray(lines) ? lines : [{ speaker: 'A', text: String(lines || '') }];
  let idx = 0;
  isPlaying = true;
  isPaused = false;
  syncPlayBtn();

  function playNext() {
    if (sid !== playSessionId) return;
    if (idx >= items.length) {
      isPlaying = false;
      isPaused = false;
      syncPlayBtn();
      return;
    }
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
      if (sid !== playSessionId) return;
      if (idx < items.length) {
        dialogTimer = setTimeout(playNext, 380);
      } else {
        isPlaying = false;
        isPaused = false;
        syncPlayBtn();
      }
    };
    u.onerror = () => {
      if (sid !== playSessionId) return;
      isPlaying = false;
      isPaused = false;
      syncPlayBtn();
    };
    speechSynthesis.speak(u);
  }
  playNext();
}

export function mountAudioControl(container, onPlayFn, { autoPlay = true } = {}) {
  const SPEEDS = [0.8, 1.0, 1.2];
  let rate = Number(localStorage.getItem('hsk_speed'));
  if (!SPEEDS.includes(rate)) rate = 1.0;

  container.innerHTML = `
    <div style="display:flex;flex-direction:row;align-items:center;justify-content:center;gap:20px;">
      <button type="button" data-role="play" class="big-play" aria-label="Прослушать / Пауза" style="width:92px;height:92px;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;">
        ${PLAY_SVG}
      </button>
      <div data-role="speedWrap" style="position:relative;display:inline-flex;flex-direction:column;align-items:center;background:#EDF5F0;border:1.5px solid var(--border);border-radius:20px;padding:4px;user-select:none;touch-action:none;cursor:pointer;">
        <div data-role="speedThumb" style="position:absolute;left:4px;right:4px;top:4px;height:34px;background:var(--jade);border-radius:15px;transition:transform 0.2s cubic-bezier(.4,0,.2,1);box-shadow:0 2px 6px rgba(30,126,94,0.28);"></div>
        ${SPEEDS.map(s => `<button type="button" data-speed="${s}" style="position:relative;z-index:1;width:66px;height:34px;padding:0;border:none;background:transparent;font-family:'Inter',sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:color 0.2s;color:${s === rate ? '#FFFDF9' : 'var(--fg)'};">${s.toFixed(1)}x</button>`).join('')}
      </div>
    </div>`;

  const playBtn = container.querySelector('[data-role="play"]');
  const speedWrap = container.querySelector('[data-role="speedWrap"]');
  const speedThumb = container.querySelector('[data-role="speedThumb"]');
  const speedBtns = Array.from(speedWrap.querySelectorAll('button[data-speed]'));
  activePlayBtn = playBtn;

  function setSpeed(newRate, shouldPlay = true) {
    rate = newRate;
    localStorage.setItem('hsk_speed', String(rate));
    const idx = SPEEDS.indexOf(rate);
    speedThumb.style.transform = `translateY(${idx * 34}px)`;
    speedBtns.forEach(b => {
      b.style.color = Number(b.dataset.speed) === rate ? '#FFFDF9' : 'var(--fg)';
    });
    if (shouldPlay) {
      activePlayBtn = playBtn;
      onPlayFn(rate);
    }
  }

  setSpeed(rate, false);

  speedBtns.forEach(b => {
    b.onclick = () => setSpeed(Number(b.dataset.speed), true);
  });

  let touchStartY = 0;
  speedWrap.addEventListener('touchstart', e => {
    touchStartY = e.changedTouches[0].clientY;
  }, { passive: true });
  speedWrap.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dy) < 15) return;
    const idx = SPEEDS.indexOf(rate);
    const nextIdx = dy > 0 ? Math.min(SPEEDS.length - 1, idx + 1) : Math.max(0, idx - 1);
    if (nextIdx !== idx) setSpeed(SPEEDS[nextIdx], true);
  }, { passive: true });

  playBtn.onclick = () => {
    if (activePlayBtn === playBtn && isPlaying) {
      togglePause();
      return;
    }
    activePlayBtn = playBtn;
    onPlayFn(rate);
  };

  if (autoPlay) {
    activePlayBtn = playBtn;
    onPlayFn(rate);
  }

  return {
    getRate: () => rate,
    replay: () => {
      activePlayBtn = playBtn;
      onPlayFn(rate);
    }
  };
}
let sfxCtx = null;

export function playFeedback(ok) {
  if (localStorage.getItem('hsk_sfx_off') === '1') return;
  const theme = localStorage.getItem('hsk_sfx_theme') || 'jade';
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!sfxCtx) sfxCtx = new AC();
    if (sfxCtx.state === 'suspended') sfxCtx.resume();

    const now = sfxCtx.currentTime;

    if (theme === 'guzheng') {
      const notes = ok ? [523.25, 659.25, 783.99] : [293.66, 220.0];
      notes.forEach((freq, i) => {
        const t = now + i * 0.055;
        const osc = sfxCtx.createOscillator();
        const gain = sfxCtx.createGain();
        osc.type = ok ? 'triangle' : 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(ok ? 0.1 : 0.06, t + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.24);
        osc.connect(gain);
        gain.connect(sfxCtx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      });
      return;
    }

    if (theme === 'guqin') {
      const osc = sfxCtx.createOscillator();
      const gain = sfxCtx.createGain();
      osc.type = 'triangle';
      if (ok) {
        osc.frequency.setValueAtTime(196.0, now);
        osc.frequency.exponentialRampToValueAtTime(293.66, now + 0.12);
        osc.frequency.setValueAtTime(293.66, now + 0.13);
      } else {
        osc.frequency.setValueAtTime(174.61, now);
        osc.frequency.exponentialRampToValueAtTime(130.81, now + 0.2);
      }
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.13, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.32);
      osc.connect(gain);
      gain.connect(sfxCtx.destination);
      osc.start(now);
      osc.stop(now + 0.34);
      return;
    }

    if (theme === 'dizi') {
      const notes = ok ? [880.0, 1046.5, 1318.5] : [659.25, 523.25];
      notes.forEach((freq, i) => {
        const t = now + i * 0.06;
        const osc = sfxCtx.createOscillator();
        const gain = sfxCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 0.985, t);
        osc.frequency.exponentialRampToValueAtTime(freq, t + 0.025);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(0.085, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.18);
        osc.connect(gain);
        gain.connect(sfxCtx.destination);
        osc.start(t);
        osc.stop(t + 0.19);
      });
      return;
    }

    if (ok) {
      const notes = [392.0, 587.33];
      notes.forEach((freq, i) => {
        const t = now + i * 0.075;
        const osc = sfxCtx.createOscillator();
        const gain = sfxCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(0.11, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.19);
        osc.connect(gain);
        gain.connect(sfxCtx.destination);
        osc.start(t);
        osc.stop(t + 0.2);
      });
    } else {
      const notes = [329.63, 246.94];
      notes.forEach((freq, i) => {
        const t = now + i * 0.07;
        const osc = sfxCtx.createOscillator();
        const gain = sfxCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.15);
        osc.connect(gain);
        gain.connect(sfxCtx.destination);
        osc.start(t);
        osc.stop(t + 0.16);
      });
    }
  } catch {}
}
