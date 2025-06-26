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
export const GEMINI_API_KEY = 'AIzaSyC2OxnjdS9mb-dlypkbQ36EQ72LHX5ZwdI';
export const GEMINI_MODEL = 'gemini-pro';

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
const featureFlags = {
    DARK_MODE: true,
    NOTIFICATIONS: true,
    ANALYTICS: true,
    EXPORT: true,
    IMPORT: true,
    BUDGET_TRACKING: true,
    GOALS: true,
    INVESTMENTS: true,
    REPORTS: true,
    CATEGORIES: true,
    TAGS: true,
    SEARCH: true,
    FILTERS: true,
    SORTING: true,
    PAGINATION: true,
    CHARTS: true,
    INSIGHTS: true,
    FORECASTING: true,
    REMINDERS: true,
    SHARING: true,
    COLLABORATION: true,
    BACKUP: true,
    SYNC: true,
    OFFLINE: true,
    SECURITY: true,
    PRIVACY: true,
    SUPPORT: true,
    HELP: true,
    FEEDBACK: true,
    UPDATES: true
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
