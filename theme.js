const THEME_KEY = 'kelime-karti:tema';
const THEME_COLORS = { light: '#f6f7fb', dark: '#0e0f1a' };
const root = document.documentElement;
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function savedTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch (err) {
    return null;
  }
}

function currentTheme() {
  return root.dataset.theme || (darkQuery.matches ? 'dark' : 'light');
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  // Telefonun üst çubuk rengi de ekranla uyumlu olsun.
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
    meta.removeAttribute('media');
    meta.setAttribute('content', THEME_COLORS[theme]);
  });
}

function updateButton(button) {
  button.textContent = currentTheme() === 'dark' ? 'Beyaz ekran' : 'Koyu ekran';
}

// Sayfa çizilmeden önce kayıtlı temayı uygula (yanıp sönme olmasın).
const stored = savedTheme();
if (stored) root.dataset.theme = stored;

document.addEventListener('DOMContentLoaded', () => {
  if (stored) applyTheme(stored);

  const button = document.getElementById('theme-btn');
  updateButton(button);
  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (err) {}
    updateButton(button);
  });
});
