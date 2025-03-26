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

    // Initial route setup
    window.addEventListener('load', () => {
        console.log("Window load event - initializing routes");
        console.log("Current URL:", window.location.href);
        
        // Check for Supabase auth tokens
        const hash = window.location.hash;
        console.log("Current hash:", hash);

        // Handle GitHub Pages redirection when an access token is present but we're at root domain
        if (hash.includes('access_token=') && 
            window.location.hostname.includes('github.io') && 
            !window.location.pathname.includes(base)) {
            
            console.log("Detected access token at root domain, redirecting to correct path");
            
            // Determine the correct route based on the type parameter
            let redirectRoute = '/';
            const typeMatch = hash.match(/type=([^&]+)/);
            
            if (typeMatch && typeMatch[1]) {
                const authType = typeMatch[1];
                console.log("Auth type:", authType);
                
                // Route based on the auth type
                switch (authType) {
                    case 'recovery':
                        redirectRoute = '/#/reset-password';
                        break;
                    case 'email':
                        redirectRoute = '/#/verify-email';
                        break;
                    case 'signup':
                        redirectRoute = '/#/verify-email';
                        break;
                    case 'magiclink':
                        redirectRoute = '/#/login';
                        break;
                    default:
                        redirectRoute = '/';
                }
            }
            
            // Redirect to the appropriate page with the token
            const redirectUrl = `${window.location.origin}${base}${redirectRoute}${hash}`;
            console.log("Redirecting to:", redirectUrl);
            window.location.href = redirectUrl;
            return;
        }
        
        // Handle auth tokens when already on the correct domain path
        if (hash.includes('access_token=')) {
            console.log("Found access token in hash");
            
            // Determine where to navigate based on the auth type
            const typeMatch = hash.match(/type=([^&]+)/);
            if (typeMatch && typeMatch[1]) {
                const authType = typeMatch[1];
                console.log("Auth type:", authType);
                
                // Navigate based on the auth type
                switch (authType) {
                    case 'recovery':
                        navigate('/reset-password');
                        break;
                    case 'email':
                    case 'signup':
                        navigate('/verify-email');
                        break;
                    case 'magiclink':
                        navigate('/login');
                        break;
                    default:
                        navigate('/');
                }
            } else {
                // Default to home page if no type is specified
                navigate('/');
            }
        } 
        // Normal route handling
        else if (window.location.pathname.startsWith(base)) {
            const initialRoute = window.location.pathname.substring(base.length) || '/';
            navigate(initialRoute);
        }
    });
}
