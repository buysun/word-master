export function speak(text: string, slow: boolean = false) {
  if (!('speechSynthesis' in window)) return;
  
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = slow ? 0.5 : 1;
  utterance.pitch = 1.1; // slightly higher for female voice feel
  
  // Try to pick a female US English voice
  const voices = window.speechSynthesis.getVoices();
  const femaleUS = voices.find(v => 
    v.lang.startsWith('en') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('karen') || v.name.toLowerCase().includes('zira'))
  ) || voices.find(v => v.lang.startsWith('en-US')) || voices[0];
  
  if (femaleUS) utterance.voice = femaleUS;
  
  window.speechSynthesis.speak(utterance);
}

// Preload voices
if ('speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
