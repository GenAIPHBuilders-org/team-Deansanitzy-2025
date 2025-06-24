/**
 * Security Utilities for XSS Prevention
 * Provides safe DOM manipulation methods to prevent Cross-Site Scripting attacks
 */

/**
 * Sanitizes text content to prevent XSS attacks
 * @param {string} text - The text to sanitize
 * @returns {string} - Sanitized text safe for HTML insertion
 */
export function sanitizeText(text) {
    if (typeof text !== 'string') return '';
    
    // Create a temporary div element to leverage browser's built-in HTML escaping
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Safely creates HTML elements with text content
 * @param {string} tagName - The HTML tag name
 * @param {string} textContent - The text content to set
 * @param {string} className - Optional CSS class name
 * @param {Object} attributes - Optional attributes to set
 * @returns {HTMLElement} - The created element
 */
export function createSafeElement(tagName, textContent = '', className = '', attributes = {}) {
    const element = document.createElement(tagName);
    element.textContent = textContent; // textContent is safe from XSS
    
    if (className) element.className = className;
    
    // Set additional attributes safely
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'style' && typeof value === 'object') {
            // Handle style object
            Object.assign(element.style, value);
        } else if (typeof value === 'string' || typeof value === 'number') {
            element.setAttribute(key, value);
        }
    });
    
    return element;
}

/**
 * Safely sets text content with basic formatting (bold, italic, line breaks)
 * @param {HTMLElement} element - The target element
 * @param {string} text - The text with markdown-style formatting
 */
export function setSafeFormattedText(element, text) {
    if (!element || typeof text !== 'string') return;
    
    // Clear existing content
    element.innerHTML = '';
    
    // Split text by formatting markers and create safe elements
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|_.*?_|\n)/);
    
    parts.forEach(part => {
        if (part.startsWith('**') && part.endsWith('**')) {
            // Bold text - remove markers and create strong element
            const boldText = part.slice(2, -2);
            const strongElement = createSafeElement('strong', sanitizeText(boldText));
            element.appendChild(strongElement);
        } else if ((part.startsWith('*') && part.endsWith('*')) || 
                   (part.startsWith('_') && part.endsWith('_'))) {
            // Italic text - remove markers and create em element
            const italicText = part.slice(1, -1);
            const emElement = createSafeElement('em', sanitizeText(italicText));
            element.appendChild(emElement);
        } else if (part === '\n') {
            // Line break
            element.appendChild(document.createElement('br'));
        } else if (part.trim()) {
            // Regular text - create text node
            const textNode = document.createTextNode(part);
            element.appendChild(textNode);
        }
    });
}

/**
 * Safely appends multiple child elements to a parent
 * @param {HTMLElement} parent - The parent element
 * @param {HTMLElement[]} children - Array of child elements to append
 */
export function safeAppendChildren(parent, children) {
    if (!parent || !Array.isArray(children)) return;
    
    children.forEach(child => {
        if (child instanceof HTMLElement) {
            parent.appendChild(child);
        }
    });
}

/**
 * Validates and sanitizes URL to prevent javascript: and data: URL attacks
 * @param {string} url - The URL to validate
 * @returns {string|null} - Sanitized URL or null if invalid
 */
export function sanitizeUrl(url) {
    if (typeof url !== 'string') return null;
    
    // Remove any whitespace
    url = url.trim();
    
    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:'];
    const lowerUrl = url.toLowerCase();
    
    for (const protocol of dangerousProtocols) {
        if (lowerUrl.startsWith(protocol)) {
            console.warn('Blocked potentially dangerous URL:', url);
            return null;
        }
    }
    
    // Allow http, https, mailto, tel, and relative URLs
    const allowedPatterns = [
        /^https?:\/\//i,
        /^mailto:/i,
        /^tel:/i,
        /^\/[^\/]/,  // Relative URLs starting with /
        /^[^:\/]+$/  // Relative URLs without protocol
    ];
    
    const isAllowed = allowedPatterns.some(pattern => pattern.test(url));
    
    if (!isAllowed) {
        console.warn('Blocked URL with unallowed protocol:', url);
        return null;
    }
    
    return url;
}

/**
 * Safely sets an element's href attribute after URL validation
 * @param {HTMLElement} element - The element (usually <a> tag)
 * @param {string} url - The URL to set
 * @returns {boolean} - True if URL was set, false if blocked
 */
export function setSafeHref(element, url) {
    const safeUrl = sanitizeUrl(url);
    if (safeUrl) {
        element.href = safeUrl;
        return true;
    }
    return false;
}

/**
 * Creates a safe link element with XSS protection
 * @param {string} url - The URL for the link
 * @param {string} text - The link text
 * @param {string} className - Optional CSS class
 * @param {Object} attributes - Optional additional attributes
 * @returns {HTMLElement|null} - The link element or null if URL is unsafe
 */
export function createSafeLink(url, text, className = '', attributes = {}) {
    const safeUrl = sanitizeUrl(url);
    if (!safeUrl) return null;
    
    const link = createSafeElement('a', sanitizeText(text), className, attributes);
    link.href = safeUrl;
    
    // Add security attributes for external links
    if (safeUrl.startsWith('http') && !safeUrl.includes(window.location.hostname)) {
        link.rel = 'noopener noreferrer';
        link.target = '_blank';
    }
    
    return link;
}

/**
 * Input validation for common data types
 */
export const validators = {
    /**
     * Validates email format
     * @param {string} email - Email to validate
     * @returns {boolean} - True if valid email format
     */
    email: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return typeof email === 'string' && emailRegex.test(email);
    },
    
    /**
     * Validates phone number (Philippine format)
     * @param {string} phone - Phone number to validate
     * @returns {boolean} - True if valid phone format
     */
    phone: (phone) => {
        const phoneRegex = /^(\+63|0)?[0-9]{10}$/;
        return typeof phone === 'string' && phoneRegex.test(phone.replace(/\s|-/g, ''));
    },
    
    /**
     * Validates numeric input
     * @param {any} value - Value to validate
     * @returns {boolean} - True if valid number
     */
    number: (value) => {
        return !isNaN(value) && isFinite(value);
    },
    
    /**
     * Validates currency amount (Philippine Peso)
     * @param {any} amount - Amount to validate
     * @returns {boolean} - True if valid currency amount
     */
    currency: (amount) => {
        const num = parseFloat(amount);
        return validators.number(num) && num >= 0;
    }
};

/**
 * Rate limiting utility to prevent API abuse
 */
export class RateLimiter {
    constructor(maxRequests = 10, timeWindow = 60000) { // 10 requests per minute by default
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = [];
    }
    
    /**
     * Checks if a request is allowed based on rate limiting
     * @returns {boolean} - True if request is allowed
     */
    isAllowed() {
        const now = Date.now();
        
        // Remove old requests outside the time window
        this.requests = this.requests.filter(time => now - time < this.timeWindow);
        
        // Check if we're under the limit
        if (this.requests.length < this.maxRequests) {
            this.requests.push(now);
            return true;
        }
        
        return false;
    }
    
    /**
     * Gets the time until the next request is allowed
     * @returns {number} - Milliseconds until next request allowed
     */
    getTimeUntilReset() {
        if (this.requests.length === 0) return 0;
        
        const oldestRequest = Math.min(...this.requests);
        const timeUntilReset = this.timeWindow - (Date.now() - oldestRequest);
        
        return Math.max(0, timeUntilReset);
    }
}

// Export a default rate limiter instance for API calls
export const apiRateLimiter = new RateLimiter(30, 60000); // 30 requests per minute 