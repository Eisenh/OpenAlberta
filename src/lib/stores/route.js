import { writable } from 'svelte/store';

export const currentRoute = writable('/');

const base = "/OpenAlberta"; // Base path for GitHub Pages

export function navigate(path) {
    const fullPath = `#${path}`;
    currentRoute.set(path);
    history.pushState(null, '', fullPath);
}

// Handle browser back/forward navigation
if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
    // Handle hash-based routing for GitHub Pages
    const hashPath = window.location.hash.substring(1) || '/';
    currentRoute.set(hashPath);
    });

    // Ensure the app starts on the correct route
    if (window.location.pathname.startsWith(base)) {
        const initialRoute = window.location.pathname.substring(base.length) || '/';
        navigate(initialRoute);
    }
}
