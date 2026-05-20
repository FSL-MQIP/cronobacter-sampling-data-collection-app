export function attachVoiceButton(micBtn, targetId) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.style.display = 'none';
    return;
  }

  let recognition = null;
  let recording = false;

  micBtn.addEventListener('click', () => {
    if (recording) {
      recognition.stop();
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      recording = true;
      micBtn.textContent = '⏹ Stop';
    };
    recognition.onresult = e => {
      const transcript = e.results[0][0].transcript;
      const field = document.getElementById(targetId);
      if (field) field.value += (field.value ? ' ' : '') + transcript;
    };
    recognition.onend = () => {
      recording = false;
      micBtn.textContent = '🎤';
    };
    recognition.onerror = () => {
      recording = false;
      micBtn.textContent = '🎤';
    };
    recognition.start();
  });
}
