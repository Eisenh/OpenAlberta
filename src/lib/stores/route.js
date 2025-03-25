import { writable } from 'svelte/store';

export const currentRoute = writable('/');

const base = "/OpenAlberta";

export function navigate(path) {
  
  const fullPath =  import.meta.env.VITE_GITHUB_PAGES ? path : base + path ;
  console.log("Env. ", import.meta.env.VITE_GITHUB_PAGES, "Navigate to ", fullPath);
  currentRoute.set(fullPath);
  history.pushState(null, '', fullPath);
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    currentRoute.set(window.location.pathname);
  });
}
