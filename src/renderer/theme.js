const THEME_KEY = 'theme';

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  try {
    localStorage.setItem(THEME_KEY, theme === 'light' ? 'light' : 'dark');
  } catch (e) {}
}

export function initTheme() {
  let theme = 'dark';
  try {
    theme = localStorage.getItem(THEME_KEY) || 'dark';
  } catch (e) {}
  applyTheme(theme);
}
