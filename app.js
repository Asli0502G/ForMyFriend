const WORDS_URL = 'word.json';
const EXAMPLES_URL = 'examples.json';
const MISSED_KEY = 'kelime-karti:bilemediklerim';
const ROUND_SIZE = 20; // bir turda kaç kelime çıksın
const LONG_TEXT = 28; // bundan uzun yazılar küçük puntoyla gösterilir

const screens = {
  start: document.getElementById('start-screen'),
  study: document.getElementById('study-screen'),
  result: document.getElementById('result-screen'),
};

const els = {
  startBtn: document.getElementById('start-btn'),
  reviewBtn: document.getElementById('review-btn'),
  homeBtn: document.getElementById('home-btn'),
  modeTag: document.getElementById('mode-tag'),
  progress: document.getElementById('progress'),
  barFill: document.getElementById('bar-fill'),
  card: document.getElementById('card'),
  word: document.getElementById('word'),
  meaning: document.getElementById('meaning'),
  example: document.getElementById('example'),
  hint: document.getElementById('hint'),
  knownBtn: document.getElementById('known-btn'),
  missedBtn: document.getElementById('missed-btn'),
  resultText: document.getElementById('result-text'),
  resultSub: document.getElementById('result-sub'),
  restartBtn: document.getElementById('restart-btn'),
  homeResultBtn: document.getElementById('home-result-btn'),
};

let allWords = null;
let missed = loadMissed();
let mode = 'normal'; // 'normal' ya da 'review' (Bilemediklerim)
let cards = [];
let index = 0;
let knownCount = 0;
let revealed = false;

// Bilemediklerim listesi telefonda saklanır; bozuk veri gelirse boş liste ile başlar.
function loadMissed() {
  try {
    const data = JSON.parse(localStorage.getItem(MISSED_KEY));
    if (Array.isArray(data)) return new Set(data.filter(word => typeof word === 'string'));
  } catch (err) {}
  return new Set();
}

function saveMissed() {
  try {
    localStorage.setItem(MISSED_KEY, JSON.stringify([...missed]));
  } catch (err) {}
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// word.json: { "yabancı kelime": "Türkçe anlam" }, examples.json: { "yabancı kelime": "örnek cümle" }
function parseWords(data, examples) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const sentences = examples && typeof examples === 'object' ? examples : {};
  return Object.entries(data)
    .filter(([word, meaning]) => typeof meaning === 'string' && word.trim() && meaning.trim())
    .map(([word, meaning]) => ({
      word: word.trim(),
      meaning: meaning.trim(),
      example: typeof sentences[word] === 'string' ? sentences[word].trim() : '',
    }));
}

async function loadWords() {
  if (allWords) return allWords;
  const [data, examples] = await Promise.all([
    fetchJson(WORDS_URL),
    fetchJson(EXAMPLES_URL).catch(() => ({})), // örnek cümleler isteğe bağlı
  ]);
  allWords = parseWords(data, examples);
  return allWords;
}

// Listeden silinmiş kelimeler Bilemediklerim'de de kalmasın.
function pruneMissed(words) {
  const known = new Set(words.map(card => card.word));
  for (const word of missed) {
    if (!known.has(word)) missed.delete(word);
  }
  saveMissed();
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.hidden = key !== name;
  }
}

function showHome() {
  els.reviewBtn.textContent = missed.size ? `Bilemediklerim (${missed.size})` : 'Bilemediklerim';
  els.reviewBtn.disabled = missed.size === 0;
  showScreen('start');
}

// Anlam bir kez görüldükten sonra karta tekrar dokununca kelimeye dönülür,
// ama Bildim/Bilemedim butonları açık kalır.
function setFlipped(flipped) {
  els.card.classList.toggle('flipped', flipped);
  els.card.setAttribute('aria-pressed', String(flipped));
  if (flipped) revealed = true;
  els.hint.hidden = revealed;
  els.knownBtn.disabled = !revealed;
  els.missedBtn.disabled = !revealed;
}

function setText(el, text) {
  el.textContent = text;
  el.classList.toggle('long', text.length > LONG_TEXT);
}

function showCard() {
  const { word, meaning, example } = cards[index];
  setText(els.word, word);
  setText(els.meaning, meaning);
  els.example.textContent = example;
  els.example.hidden = !example;
  els.progress.textContent = `${index + 1} / ${cards.length}`;
  els.barFill.style.transform = `scaleX(${index / cards.length})`;

  // Yeni kart animasyonsuz öne dönsün; yoksa dönerken yeni kartın anlamı görünür.
  revealed = false;
  els.card.classList.add('instant');
  setFlipped(false);
  void els.card.offsetWidth;
  els.card.classList.remove('instant');
}

function showResult(message, sub = '') {
  els.resultText.textContent = message;
  els.resultSub.textContent = sub;
  els.resultSub.hidden = !sub;
  els.restartBtn.hidden = mode === 'review' && missed.size === 0;
  showScreen('result');
}

function finishRound() {
  const message = `${cards.length} kelimeden ${knownCount} tanesini bildin`;
  if (mode === 'review') {
    showResult(message, missed.size ? `Listede ${missed.size} kelime kaldı` : 'Bilemediklerim listesi boşaldı!');
  } else {
    showResult(message, missed.size ? `Bilemediklerim listesinde ${missed.size} kelime var` : '');
  }
}

function answer(known) {
  const { word } = cards[index];
  if (known) {
    knownCount++;
    if (mode === 'review') missed.delete(word); // sadece Bilemediklerim içinde listeden çıkar
  } else {
    missed.add(word);
  }
  saveMissed();

  index++;
  if (index < cards.length) {
    showCard();
  } else {
    finishRound();
  }
}

async function startRound(nextMode) {
  mode = nextMode;
  const buttons = [els.startBtn, els.reviewBtn, els.restartBtn];
  buttons.forEach(btn => (btn.disabled = true));

  let failed = false;
  try {
    const words = await loadWords();
    pruneMissed(words);
    const pool = mode === 'review' ? words.filter(card => missed.has(card.word)) : words;
    cards = shuffle([...pool]).slice(0, ROUND_SIZE);
  } catch (err) {
    cards = [];
    failed = true;
  }

  buttons.forEach(btn => (btn.disabled = false));

  if (failed) {
    showResult('Kelime listesi yüklenemedi');
    return;
  }
  if (cards.length === 0) {
    showHome();
    return;
  }

  index = 0;
  knownCount = 0;
  els.modeTag.hidden = mode !== 'review';
  showScreen('study');
  showCard();
}

function flip() {
  setFlipped(!els.card.classList.contains('flipped'));
}

els.startBtn.addEventListener('click', () => startRound('normal'));
els.reviewBtn.addEventListener('click', () => startRound('review'));
els.restartBtn.addEventListener('click', () => startRound(mode));
els.homeBtn.addEventListener('click', showHome);
els.homeResultBtn.addEventListener('click', showHome);
els.card.addEventListener('click', flip);
els.card.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    flip();
  }
});
els.knownBtn.addEventListener('click', () => answer(true));
els.missedBtn.addEventListener('click', () => answer(false));

// Açılışta listeyi yükle ki Bilemediklerim sayısı doğru görünsün.
loadWords().then(pruneMissed).catch(() => {}).finally(showHome);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
