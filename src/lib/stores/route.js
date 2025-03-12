import { writable } from 'svelte/store';

export const currentRoute = writable('/');

export function navigate(path) {
  currentRoute.set(path);
  history.pushState(null, '', path);
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    currentRoute.set(window.location.pathname);
  });
}
