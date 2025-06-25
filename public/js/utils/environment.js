/**
 * Environment utilities for proper development/production code separation
 * Centralizes all environment-specific logic
 */

// Environment detection
export const isProduction = () => {
    return window.location.hostname !== 'localhost' && 
           window.location.hostname !== '127.0.0.1' && 
           !window.location.hostname.includes('local') &&
           !window.location.search.includes('debug=true');
};

export const isDevelopment = () => !isProduction();

// Debug mode detection (only available in development)
export const isDebugMode = () => {
    return isDevelopment() && window.location.search.includes('debug=true');
};

// Test mode detection (only available in development)
export const isTestMode = () => {
    return isDevelopment() && window.location.search.includes('test=true');
};

// Simple mode detection (available in both environments)
export const isSimpleMode = () => {
    return window.location.search.includes('simple=true');
};

// Environment-aware console logging
export const devLog = (...args) => {
    if (isDevelopment()) {
        console.log(...args);
    }
};

export const devWarn = (...args) => {
    if (isDevelopment()) {
        console.warn(...args);
    }
};

export const devError = (...args) => {
    if (isDevelopment()) {
        console.error(...args);
    }
};

// Production-safe console logging (always available for important messages)
export const prodLog = (...args) => {
    console.log(...args);
};

export const prodWarn = (...args) => {
    console.warn(...args);
};

export const prodError = (...args) => {
    console.error(...args);
};

// Environment-specific configuration
export const getEnvironmentConfig = () => {
    return {
        environment: isProduction() ? 'production' : 'development',
        isProduction: isProduction(),
        isDevelopment: isDevelopment(),
        enableDebugLogs: isDevelopment(),
        enableVerboseLogging: isDebugMode(),
        enableTestMode: isTestMode(),
        enableSimpleMode: isSimpleMode(),
        features: {
            // Development-only features
            mockData: isDevelopment() && isTestMode(),
            debugUI: isDevelopment() && isDebugMode(),
            performanceMetrics: isDevelopment(),
            // Production features
            errorReporting: isProduction(),
            analytics: isProduction(),
            securityHeaders: isProduction()
        }
    };
};

// Development-only code execution
export const runInDevelopment = (callback) => {
    if (isDevelopment() && typeof callback === 'function') {
        return callback();
    }
};

// Production-only code execution
export const runInProduction = (callback) => {
    if (isProduction() && typeof callback === 'function') {
        return callback();
    }
};

// Safe development fallback
export const withDevelopmentFallback = (productionFn, developmentFallback) => {
    if (isProduction()) {
        return productionFn();
    } else if (typeof developmentFallback === 'function') {
        return developmentFallback();
    }
    return null;
}; 