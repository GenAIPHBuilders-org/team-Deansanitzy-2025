export const firebaseConfig = {
    apiKey: "AIzaSyDlo8R42uN98Gseai5s6xZCY9DEgeVvLHY",
    authDomain: "deansanitzy.firebaseapp.com",
    projectId: "deansanitzy",
    storageBucket: "deansanitzy.firebasestorage.app",
    messagingSenderId: "472263423453",
    appId: "1:472263423453:web:b436bbfc1709c076f97234",
    measurementId: "G-94DCB6D4GZ"
};

// Financial Health Configuration
// This file prevents resource loading errors when config.js is imported

// Set to null to use offline analysis mode
// Replace with your actual Gemini API key if you want AI-powered analysis
export const OFFLINE_MODE = false;

// Initialize API key - Replace this with your actual Gemini API key
export const GEMINI_API_KEY = 'AIzaSyCxJe2AbtK6hzGyDE4rfk50jBaoE63Rdvg';
export const GEMINI_MODEL = 'gemini-1.5-flash';

// Helper function to check API configuration
export function isConfigured() {
    if (!GEMINI_API_KEY) {
        console.warn('Gemini API key not configured. Running in offline mode.');
        return false;
    }
    if (OFFLINE_MODE) {
        console.warn('Offline mode enabled.');
        return false;
    }
    return true;
}

// Export configuration status
export const configStatus = {
    initialized: true,
    offlineMode: OFFLINE_MODE,
    hasApiKey: !!GEMINI_API_KEY
};

console.log('Config loaded - API mode enabled, waiting for key configuration');

// Note: In production, these should be environment variables
// and not hardcoded in the client-side code

// Application Mode
export const APP_ENV = 'development';
export const DEBUG_MODE = true;
export const ENABLE_LOGGING = true;

// Feature Flags
export const FEATURES = {
    AI_INSIGHTS: true,
    REAL_TIME_UPDATES: true,
    TRANSACTION_SCANNING: true,
    ADVANCED_ANALYTICS: true
};

// API Configuration
export const API_CONFIG = {
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    BATCH_SIZE: 50
};

// UI Configuration
export const UI_CONFIG = {
    ANIMATION_SPEED: 300,
    TOAST_DURATION: 3000,
    THEME: 'dark'
};
