import { writable } from 'svelte/store';

export const currentRoute = writable('/');


const base = import.meta.env.VITE_GITHUB_PAGES || ''; // Base path for GitHub Pages

export function navigate(path) {
    // Ensure path starts with '/' and handle hash-based routing
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const fullPath = `${window.location.pathname}#${normalizedPath}`;
    currentRoute.set(normalizedPath);
    history.pushState(null, '', fullPath);
    console.log("rjs navigating path: ", path, " fullpath: ", fullPath," currentRoute: ", currentRoute);
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
        let initialHash = window.location.hash.substring(1); // remove leading #
        console.log("rjs initialHash: ", initialHash);
        if (initialHash) {
            const hashIndex = initialHash.indexOf('#');
            if (hashIndex > 2) initialHash.replace('#','?');
        console.log("rjs hashIndex: ", hashIndex, " initialHash w ?: ", initialHash);
            // 1. Find the position of the '?' within the hash
            const questionMarkIndex = initialHash.indexOf('?');

            if (questionMarkIndex !== -1 || hashIndex > 2 ) {
                // 2. Extract the query parameter string
                const queryString = initialHash.substring(questionMarkIndex + 1);

                // 3. Parse the query parameters using URLSearchParams
                const params = new URLSearchParams(queryString);

                // 4. Access the parameter values
                const tokenType = params.get('token_type');
                const authType = params.get('type');
                const accessToken = params.get('access_token');

                console.log("rjs Params: ", accessToken);
                console.log('rjs token_type:', tokenType);
                console.log('rjs authType:', authType);

        // Do something with the parameters...
                if (accessToken) {
                    
                    console.log("rjs Detected access token");
                  
                    // Determine the correct route based on the type parameter
                    let redirectRoute = '/';  
                    // Route based on the auth type
                    switch (authType) {
                        case 'recovery':
                            console.log("rjs setting currentRoute: ", initialHash);
                            currentRoute.set(initialHash);//'/reset-password';

                            break;
                        case 'email':
                            redirectRoute = '/verify-email';
                            break;
                        case 'signup':
                            redirectRoute = '/verify-email';
                            break;
                        case 'magiclink':
                            redirectRoute = '/login';
                            break;
                        default:
                            redirectRoute = '/';
                    }
                    // Redirect to the appropriate page with the token
                    //const redirectUrl = `${window.location.origin}${base}${redirectRoute}${initialHash}`;
                    //console.log("Redirecting to:", redirectRoute);
                    //window.location.href = redirectUrl;
                    //navigate(redirectRoute);
                    return;
                }
                
            } else {
                console.log('No query parameters found in the hash.');
                // Initial hash-based route handling
                const hash = window.location.hash.substring(1) || '/';
                const cleanHash = hash.split('?')[0]; // Remove query params
                console.log("cleanHash: ", cleanHash);
                navigate(hash); //cleanHash);
            }
        } else {
            console.log('No hash found.');
        }
        // Handle GitHub Pages redirection when an access token is present but we're at root domain
        
    });
}
