/*
  JARVIS Voice UI (Dutch) — Wake/Shutdown, TTS, Photos, Clock
  - Wake: "Jarvis wake up" (or Dutch variants)
  - Shutdown: "Jarvis shut down" (or Dutch variants)
  - Commands (when awake):
    * Foto's: "toon foto van <onderwerp>" / "foto van <onderwerp>"
    * Tekst: "toon tekst <zin>" of "zeg <zin>"
    * Verberg: "verberg tekst" / "wis tekst"
    * Help: "help" / "wat kun je"
*/

const dom = {
  permissionGate: document.getElementById('permission-gate'),
  startBtn: document.getElementById('start-btn'),
  clockTime: document.getElementById('clock-time'),
  clockDate: document.getElementById('clock-date'),
  ledAwake: document.getElementById('led-awake'),
  ledMic: document.getElementById('led-mic'),
  statusAwake: document.getElementById('status-awake'),
  statusMic: document.getElementById('status-mic'),
  textDisplay: document.getElementById('text-display'),
  clearTextBtn: document.getElementById('clear-text'),
  photoGrid: document.getElementById('photo-grid'),
  clearPhotosBtn: document.getElementById('clear-photos'),
  log: document.getElementById('log'),
  clearLogBtn: document.getElementById('clear-log'),
};

const state = {
  awake: false,
  listening: false,
  autoRestartRecognition: true,
  maxPhotos: 9,
  recognition: null,
  ttsVoice: null,
  speechQueue: [],
  speaking: false,
  lang: 'nl-NL',
};

function updateClock() {
  const now = new Date();
  const hh = now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dd = now.toLocaleDateString('nl-NL', { weekday: 'long', day: '2-digit', month: 'long' });
  dom.clockTime.textContent = hh;
  dom.clockDate.textContent = dd;
}
setInterval(updateClock, 1000);
updateClock();

function setAwake(isAwake) {
  state.awake = isAwake;
  dom.ledAwake.classList.toggle('on', isAwake);
  dom.statusAwake.textContent = isAwake ? 'Actief' : 'Slaapstand';
  if (!isAwake) {
    // Optional: hide UI elements upon sleep
  }
}

function setMicListening(isOn) {
  state.listening = isOn;
  dom.ledMic.classList.toggle('on', isOn);
  dom.statusMic.textContent = isOn ? 'Microfoon aan' : 'Microfoon uit';
}

function appendLog(kind, text) {
  const row = document.createElement('div');
  row.className = 'log-entry';
  const tag = document.createElement('div');
  tag.className = 'tag';
  tag.textContent = kind === 'user' ? 'USER' : 'JARVIS';
  const body = document.createElement('div');
  body.innerHTML = kind === 'user' ? `<span class="me">${escapeHtml(text)}</span>` : `<span class="ai">${escapeHtml(text)}</span>`;
  row.append(tag, body);
  dom.log.prepend(row);
}

function escapeHtml(str) {
  return str.replace(/[&<>"]+/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
}

// TTS — choose Dutch voice if available
function loadVoices() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return;
  const dutchVoices = voices.filter(v => (v.lang || '').toLowerCase().startsWith('nl'));
  state.ttsVoice = dutchVoices[0] || voices.find(v => (v.lang || '').toLowerCase().startsWith('en')) || voices[0];
}
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function speak(text, opts = {}) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'nl-NL';
  if (state.ttsVoice) utter.voice = state.ttsVoice;
  utter.rate = opts.rate ?? 1.0;
  utter.pitch = opts.pitch ?? 1.0;
  utter.onstart = () => { state.speaking = true; };
  utter.onend = () => {
    state.speaking = false;
    processSpeechQueue();
  };
  state.speechQueue.push(utter);
  processSpeechQueue();
}

function processSpeechQueue() {
  if (state.speaking) return;
  const next = state.speechQueue.shift();
  if (!next) return;
  window.speechSynthesis.speak(next);
}

// Recognition
function createRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = state.lang; // Dutch by default
  rec.maxAlternatives = 1;
  return rec;
}

function startRecognitionFlow() {
  if (state.recognition) {
    try { state.recognition.stop(); } catch {}
  }
  const rec = createRecognition();
  if (!rec) {
    appendLog('jarvis', 'Spraakherkenning wordt niet ondersteund in deze browser.');
    speak('Spraakherkenning wordt niet ondersteund in deze browser.');
    return;
  }

  state.recognition = rec;
  rec.onresult = (event) => {
    let finalText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) {
        finalText += r[0].transcript;
      }
    }
    if (finalText) {
      const transcript = normalizeTranscript(finalText);
      appendLog('user', transcript);
      handleTranscript(transcript);
    }
  };
  rec.onend = () => {
    setMicListening(false);
    if (state.autoRestartRecognition) {
      try { rec.start(); setMicListening(true); } catch {}
    }
  };
  rec.onerror = (e) => {
    appendLog('jarvis', `Fout spraakherkenning: ${e.error || e.message || e}`);
  };

  try {
    rec.start();
    setMicListening(true);
  } catch (e) {
    appendLog('jarvis', 'Kon de microfoon niet starten.');
  }
}

function normalizeTranscript(t) {
  const lower = t.toLowerCase();
  return lower.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function sayAwakeGreeting() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Goedemorgen.' : hour < 18 ? 'Goedemiddag.' : 'Goedenavond.';
  speak(`${greeting} Ik ben wakker. Waarmee kan ik helpen?`);
  appendLog('jarvis', 'Ik ben wakker.');
}

function saySleepAcknowledgement() {
  speak('Ik ga slapen. Tot later.');
  appendLog('jarvis', 'Ga naar slaapstand.');
}

// Command handling
function handleTranscript(text) {
  // Wake / shutdown work even when asleep
  if (matchesWake(text)) {
    if (!state.awake) {
      setAwake(true);
      sayAwakeGreeting();
    } else {
      speak('Ik ben al actief.');
    }
    return;
  }
  if (matchesShutdown(text)) {
    if (state.awake) {
      setAwake(false);
      saySleepAcknowledgement();
    } else {
      speak('Ik ben al in slaapstand.');
    }
    return;
  }

  if (!state.awake) {
    // Ignore other commands while sleeping
    return;
  }

  // Help
  if (/\b(help|wat kan je|wat kun je)\b/.test(text)) {
    const help = 'Ik kan tekst voorlezen en tonen, en foto\'s van internet laten zien. Zeg bijvoorbeeld: toon tekst hallo wereld. Of: toon foto van katten.';
    speak(help);
    appendLog('jarvis', help);
    return;
  }

  // Clear text
  if (/(verberg|wis|clear)\s+tekst/.test(text)) {
    dom.textDisplay.textContent = '';
    dom.textDisplay.classList.add('hidden');
    speak('Tekst verborgen.');
    appendLog('jarvis', 'Tekst verborgen.');
    return;
  }

  // Show text: "toon tekst ..." or "zeg ..."
  const textMatch = text.match(/(?:toon\s+tekst|schrijf\s+tekst|laat\s+tekst\s+zien|zeg|spreek)\s+(.+)/);
  if (textMatch && textMatch[1]) {
    const content = textMatch[1].trim();
    dom.textDisplay.textContent = content;
    dom.textDisplay.classList.remove('hidden');
    speak(content);
    appendLog('jarvis', `Tekst getoond en uitgesproken.`);
    return;
  }

  // Photos: "toon foto van <onderwerp>" / "foto van <onderwerp>" / "toon foto <onderwerp>"
  const photoMatch = text.match(/(?:toon|laat|geef).*?(?:foto|afbeelding).*?(?:van|over)?\s+(.+)/)
                   || text.match(/(?:foto|afbeelding)\s+van\s+(.+)/)
                   || text.match(/(?:toon|laat)\s+(?:mij\s+)?(?:een\s+)?(?:foto|afbeelding)\s+(.+)/);
  if (photoMatch && photoMatch[1]) {
    const query = sanitizeQuery(photoMatch[1]);
    showPhoto(query);
    const reply = `Toon een foto van ${query}.`;
    speak(reply);
    appendLog('jarvis', reply);
    return;
  }

  // Default fallback: acknowledge
  const fallback = 'Begrepen.';
  speak(fallback);
  appendLog('jarvis', fallback);
}

function matchesWake(text) {
  return /\b(jarvis\s*(wake\s*up|start)|jarvis\s*word\s*wakker|jarvis\s*start)\b/.test(text);
}

function matchesShutdown(text) {
  return /\b(jarvis\s*(shut\s*down|stop|slaap|ga\s+slapen|slaapstand))\b/.test(text);
}

function sanitizeQuery(q) {
  // Remove common trailing punctuation
  return q.replace(/[.!?\s]+$/g, '').slice(0, 80);
}

function showPhoto(query) {
  const url = `https://source.unsplash.com/featured/800x600/?${encodeURIComponent(query)}`;
  const img = document.createElement('img');
  img.src = url;
  img.alt = `Foto van ${query}`;
  img.loading = 'lazy';

  img.onerror = () => {
    const fallback = document.createElement('div');
    fallback.className = 'placeholder';
    fallback.textContent = `Geen afbeelding gevonden voor "${query}"`;
    dom.photoGrid.prepend(fallback);
    trimPhotoGrid();
  };

  img.onload = () => {
    dom.photoGrid.prepend(img);
    trimPhotoGrid();
  };
}

function trimPhotoGrid() {
  const children = Array.from(dom.photoGrid.children);
  for (let i = state.maxPhotos; i < children.length; i++) {
    children[i].remove();
  }
}

// UI buttons
if (dom.clearTextBtn) dom.clearTextBtn.addEventListener('click', () => {
  dom.textDisplay.textContent = '';
  dom.textDisplay.classList.add('hidden');
});
if (dom.clearPhotosBtn) dom.clearPhotosBtn.addEventListener('click', () => {
  dom.photoGrid.innerHTML = '';
});
if (dom.clearLogBtn) dom.clearLogBtn.addEventListener('click', () => {
  dom.log.innerHTML = '';
});

// Permission gate
if (dom.startBtn) dom.startBtn.addEventListener('click', async () => {
  dom.permissionGate.classList.remove('visible');
  // Attempt to get audio permission to improve recognition start reliability
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {}
  startRecognitionFlow();
  speak('Microfoon actief. Zeg: Jarvis wake up.');
});

// Graceful handling if speech synthesis is busy
window.addEventListener('beforeunload', () => {
  try { window.speechSynthesis.cancel(); } catch {}
});
