import { writable } from 'svelte/store';

export const currentRoute = writable('/');

const base = import.meta.env.VITE_GITHUB_PAGES || ''; // Base path for GitHub Pages

export function navigate(path) {
    // Ensure path starts with '/' and handle hash-based routing
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const fullPath = `${window.location.pathname}#${normalizedPath}`;
    currentRoute.set(normalizedPath);
    history.pushState(null, '', fullPath);
}
export function getParameterByName(name, url) {
        name = name.replace(/[\[\]]/g, '\\$&');
        // Modify the regex to specifically look for '&' before the name
        const regex = new RegExp('[&?]\\b' + name + '\\b(=([^&#]*)|&|#|$)');
        const results = regex.exec(url);

        if (!results) {
          return null;
        }

        if (!results[2]) {
          return '';
        }

        const parsed = decodeURIComponent(results[2].replace(/\+/g, ' '));
        return parsed;
          
      }
// Handle browser back/forward navigation
if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
        // Handle hash changes for GitHub Pages
        const hashPath = window.location.hash.substring(1) || '/';
        const cleanPath = hashPath.split('?')[0]; // Remove query params
        currentRoute.set(cleanPath);
    });

    // Initial route setup
    window.addEventListener('load', () => {
        console.log("rjs Window load event - initializing routes");
        console.log("rjs Current URL:", window.location.href);
        
        // Check for Supabase auth tokens
        const initialHash = window.location.hash;
        console.log("rjs Current hash:", initialHash);

        // Handle GitHub Pages redirection when an access token is present but we're at root domain
        if (initialHash.includes('access_token=') && 
            window.location.hostname.includes('github.io') && 
            !window.location.pathname.includes(base)) {
            
            console.log("rjs Detected access token at root domain, redirecting to correct path");
            
            // Determine the correct route based on the type parameter
            let redirectRoute = '/';
            const typeMatch = initialHash.match(/type=([^&]+)/);
            
            if (typeMatch && typeMatch[1]) {
                const authType = typeMatch[1];
                console.log("rjs Auth type:", authType);
                
                // Route based on the auth type
                switch (authType) {
                    case 'recovery':
                        redirectRoute = '#/reset-password';
                        break;
                    case 'email':
                        redirectRoute = '#/verify-email';
                        break;
                    case 'signup':
                        redirectRoute = '#/verify-email';
                        break;
                    case 'magiclink':
                        redirectRoute = '#/login';
                        break;
                    default:
                        redirectRoute = '#/';
                }
            }
            
            // Redirect to the appropriate page with the token
            const redirectUrl = `${window.location.origin}${base}${redirectRoute}${initialHash}`;
            console.log("Redirecting to:", redirectUrl);
            window.location.href = redirectUrl;
            return;
        }
        
        // Initial hash-based route handling
        const hash = window.location.hash.substring(1) || '/';
        const cleanHash = hash.split('?')[0]; // Remove query params
        navigate(cleanHash);
    });
}
