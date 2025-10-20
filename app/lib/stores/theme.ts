import { atom } from 'nanostores';
import { logStore } from './logs';

export type Theme = 'dark';

export const kTheme = 'bolt_theme';

export function themeIsDark() {
  return true; // Always dark mode
}

export const DEFAULT_THEME = 'dark';

export const themeStore = atom<Theme>('dark');

function initStore() {
  // Always return dark theme
  if (!import.meta.env.SSR) {
    // Set HTML attribute to dark
    document.querySelector('html')?.setAttribute('data-theme', 'dark');
  }
  return 'dark';
}

export function toggleTheme() {
  // Do nothing - theme is permanently dark
  logStore.logSystem('Theme is permanently set to dark mode');
}
