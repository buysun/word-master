function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v =>
      v.lang.startsWith('en') && (
        v.name.toLowerCase().includes('female') ||
        v.name.toLowerCase().includes('samantha') ||
        v.name.toLowerCase().includes('karen') ||
        v.name.toLowerCase().includes('zira')
      )
    ) || voices.find(v => v.lang.startsWith('en-US')) || voices[0]
  );
}

function buildUtterance(text: string, slow: boolean): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = slow ? 0.5 : 1;
  u.pitch = 1.1;
  const voice = pickVoice();
  if (voice) u.voice = voice;
  return u;
}

export function speak(text: string, slow: boolean = false) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(buildUtterance(text, slow));
}

/**
 * Speak the text twice sequentially — the second utterance starts only
 * after the first one finishes, with a small gap so it never overlaps.
 */
export function speakTwice(text: string, slow: boolean = false, gapMs: number = 400) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const first = buildUtterance(text, slow);
  first.onend = () => {
    setTimeout(() => {
      const second = buildUtterance(text, slow);
      window.speechSynthesis.speak(second);
    }, gapMs);
  };
  window.speechSynthesis.speak(first);
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
