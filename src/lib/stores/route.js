import { writable } from 'svelte/store';

export const currentRoute = writable('/');

const base = "/OpenAlberta/";

export function navigate(path) {
  const fullPath = import.meta.env.GITHUB_PAGES ? base + path : path;
  currentRoute.set(fullPath);
  history.pushState(null, '', fullPath);
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    currentRoute.set(window.location.pathname);
  });
}
