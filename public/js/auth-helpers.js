import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";

/**
 * Enhanced Google Sign-In with improved popup handling and redirect fallback
 */
export async function improvedGoogleSignIn(provider, options = {}) {
    const auth = getAuth();
    const { 
        useRedirectFallback = true, 
        popupTimeout = 30000,
        onLoading = () => {},
        onSuccess = () => {},
        onError = () => {}
    } = options;

    try {
        onLoading(true);

        // Use Firebase's built-in popup method
        console.log('Attempting Google sign-in with popup...');
        
        const result = await signInWithPopup(auth, provider);

        console.log('Google sign-in successful with popup');
        onLoading(false);
        onSuccess(result);
        return result;

    } catch (error) {
        console.error('Popup sign-in failed:', error);
        onLoading(false);

        // If popup fails and redirect fallback is enabled
        if (useRedirectFallback && (
            error.code === 'auth/popup-blocked' || 
            error.code === 'auth/popup-closed-by-user' ||
            error.message.includes('Popup blocked')
        )) {
            console.log('Falling back to redirect method...');
            
            try {
                // Set a flag to know we're doing a redirect
                setRedirectFlag();
                await signInWithRedirect(auth, provider);
                // Note: This will redirect the page, so code after this won't execute
                return null;
            } catch (redirectError) {
                console.error('Redirect sign-in also failed:', redirectError);
                clearRedirectFlag();
                onError(redirectError);
                throw redirectError;
            }
        } else {
            // Only call onError if user didn't cancel
            if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                onError(error);
            }
            throw error;
        }
    }
}

/**
 * Handle redirect result on page load
 */
export async function handleRedirectResult() {
    const auth = getAuth();
    
    try {
        const result = await getRedirectResult(auth);
        if (result) {
            console.log('Redirect sign-in successful:', result.user);
            return result;
        }
        return null;
    } catch (error) {
        console.error('Error handling redirect result:', error);
        throw error;
    }
}

/**
 * Check if we should handle redirect result on page load
 */
export function shouldHandleRedirectResult() {
    // Check if we're returning from a redirect
    const urlParams = new URLSearchParams(window.location.search);
    const state = urlParams.get('state');
    const code = urlParams.get('code');
    
    // Also check localStorage for redirect flag
    const redirectFlag = localStorage.getItem('firebase-auth-redirect');
    
    return !!(state || code || redirectFlag);
}

/**
 * Set redirect flag before redirect
 */
export function setRedirectFlag() {
    localStorage.setItem('firebase-auth-redirect', 'true');
}

/**
 * Clear redirect flag after handling
 */
export function clearRedirectFlag() {
    localStorage.removeItem('firebase-auth-redirect');
}

/**
 * Improved error handling for authentication errors
 */
export function getReadableAuthError(error) {
    const errorMessages = {
        'auth/api-key-not-valid': 'Authentication configuration error. Please contact support.',
        'auth/network-request-failed': 'Network error. Please check your internet connection and try again.',
        'auth/popup-blocked': 'Sign-in popup was blocked. Please allow popups for this site and try again.',
        'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
        'auth/cancelled-popup-request': 'Multiple sign-in attempts detected. Please try again.',
        'auth/operation-not-allowed': 'Google authentication is not enabled. Please contact support.',
        'auth/invalid-api-key': 'Invalid API key. Please contact support.',
        'auth/app-deleted': 'Firebase app has been deleted. Please contact support.',
        'auth/invalid-user-token': 'Your session has expired. Please sign in again.',
        'auth/user-disabled': 'Your account has been disabled. Please contact support.',
        'auth/user-token-expired': 'Your session has expired. Please sign in again.',
        'auth/web-storage-unsupported': 'Your browser does not support web storage. Please enable cookies and try again.',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
        'auth/unauthorized-domain': 'This domain is not authorized for authentication. Please contact support.'
    };

    return errorMessages[error.code] || `Authentication error: ${error.message}`;
} 