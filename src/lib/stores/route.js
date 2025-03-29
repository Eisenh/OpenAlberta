import { writable } from 'svelte/store';

export const currentRoute = writable('/');


const projectPath = import.meta.env.VITE_GITHUB_PAGES || ''; // Base path for GitHub Pages

export function navigate(path) {
    // Ensure path starts with '/' and handle hash-based routing
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const fullPath = `${window.location.pathname}#${normalizedPath}`;
    currentRoute.set(normalizedPath);
    history.pushState(null, '', fullPath);  // so that browser history includes base url
    console.log("rjs navigating path: ", path, " normalizedPath: ", normalizedPath," currentRoute: ", currentRoute);
}
export function handleUrl(){
    // checks for token, an converts # to ? if needed before navigating. If no token, adds the url 
    // to browser history. If there is a token, skips adding url to browser history.
    // then navigates to cleanPath.
    if (window.location.hash && window.location.hash.includes('access_token=')) {
        let initialHash = window.location.hash.substring(1); // remove leading #
        let hashQuery = initialHash.replace('#access','?access');
        console.log("rjs23 initialHash: ", initialHash, " cleanHash: ",hashQuery);
        
        //currentRoute.set(hashQuery);
        //navigate('#' + hashQuery);
       
    
        // 1. Find the position of the '?' within the hash
        const questionMarkIndex = hashQuery.indexOf('?');

        if (questionMarkIndex !== -1 ) {
            // 2. Extract the query parameter string
            const queryString = hashQuery.substring(questionMarkIndex + 1);

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
        
            
            console.log("rjs Detected access token");
            
            // Determine the correct route based on the type parameter
            let redirectRoute = '/';  
            // Route based on the auth type
            switch (authType) {
                case 'recovery':
                    redirectRoute = '/reset-password'
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
            currentRoute.set(redirectRoute);  // this loads the appropriate page component
            // Redirect to the appropriate page with the token
            //const redirectUrl = `${window.location.origin}${base}${redirectRoute}${initialHash}`;
            console.log("Redirecting to:", redirectRoute);
            //window.location.href = redirectUrl;
            //navigate(redirectRoute);
            //return;
            
            
        }   
     
    } else {
        console.log('No token found in the hash.');
        // Initial hash-based route handling
        const hash = window.location.hash.substring(1) || '/';
        const cleanHash = hash.split('?')[0]; // Remove query params
        console.log("cleanHash: ", cleanHash);
        navigate(hash); //cleanHash);
    }
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
        let newUrl = '';
        let currentUrl = window.location.href;
        if (currentUrl.includes('#access')) {
            newUrl = currentUrl.replace('#access','?access');
            window.location.href = newUrl;  // refires the event without the '#access'
        } else {
            const hashPath = window.location.hash.substring(1) || '/';
            const cleanPath = hashPath.split('?')[0]; // Remove query params
            console.log("Window popstate 120, newUrl ", newUrl, " cleanPath: ", cleanPath);
            currentRoute.set(cleanPath);
        }
        

    });

    // Initial route setup
    window.addEventListener('load', () => {
        console.log("rjs Window load event - initializing routes");
        console.log("rjs Current URL:", window.location.href);
        
        let newUrl = '';
        let currentUrl = window.location.href;
        if (currentUrl.includes('#access')) {
            newUrl = currentUrl.replace('#access','?access');
            window.location.href = newUrl;  // refires the event without the '#access'
        } else {
            const hashPath = window.location.hash.substring(1) || '/';
            const cleanPath = hashPath.split('?')[0]; // Remove query params
            console.log("Window popstate 120, newUrl ", newUrl, " cleanPath: ", cleanPath);
            currentRoute.set(cleanPath);
        }
        //handleUrl(window.location.href);
        // Check for Supabase auth tokens
        
        // Handle GitHub Pages redirection when an access token is present but we're at root domain
        
    });
}
