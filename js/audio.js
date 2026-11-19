let zhVoice = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  return voices.find(v => v.lang === 'zh-CN')
      || voices.find(v => v.lang.startsWith('zh'))
      || null;
}

if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => { zhVoice = pickVoice(); };
  zhVoice = pickVoice();
}

export function speak(text, { rate = 1 } = {}) {
  if (!('speechSynthesis' in window)) {
    alert('Браузер не поддерживает озвучку. Откройте в Chrome или Edge.');
    return;
  }
  if (!zhVoice) zhVoice = pickVoice();
  if (!zhVoice) {
    alert('Китайский голос не найден. Откройте в Chrome или Edge.');
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.voice = zhVoice;
  u.rate = rate;
  speechSynthesis.speak(u);
}
