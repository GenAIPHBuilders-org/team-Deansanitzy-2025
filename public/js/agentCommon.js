// Common utilities for AI agents
import { GEMINI_API_KEY, GEMINI_MODEL } from './config.js';

// Rate limiting configuration
const RATE_LIMIT = {
    maxRequests: 45, // Keep under the 50 requests limit
    timeWindow: 60000, // 1 minute in milliseconds
    requests: [],
};

// Format currency function
export function formatCurrency(amount, currency = 'PHP') {
    const currencySymbols = {
        'PHP': '₱',
        'USD': '$',
        'EUR': '€'
    };
    
    const symbol = currencySymbols[currency] || '₱';
    return `${symbol}${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Format date function
export function formatDate(date) {
    if (!date) return '';
    
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Check rate limit
function checkRateLimit() {
    const now = Date.now();
    // Remove old requests outside the time window
    RATE_LIMIT.requests = RATE_LIMIT.requests.filter(time => now - time < RATE_LIMIT.timeWindow);
    
    if (RATE_LIMIT.requests.length >= RATE_LIMIT.maxRequests) {
        const oldestRequest = RATE_LIMIT.requests[0];
        const waitTime = RATE_LIMIT.timeWindow - (now - oldestRequest);
        throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }
    
    RATE_LIMIT.requests.push(now);
}

// Exponential backoff retry
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            return await fn();
        } catch (error) {
            if (error.message.includes('Rate limit exceeded')) {
                throw error; // Don't retry rate limit errors
            }
            
            retries++;
            if (retries === maxRetries) {
                throw error;
            }
            
            const delay = initialDelay * Math.pow(2, retries - 1);
            console.log(`Retrying after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * A shared function to call the Gemini AI API with proper error handling,
 * rate limiting, and exponential backoff.
 * @param {string} prompt The complete prompt to send to the AI.
 * @param {object} options Optional parameters for the generation config.
 * @returns {Promise<string>} The text response from the AI.
 */
export async function callGeminiAI(prompt, options = {}) {
    console.log('🤖 Calling Gemini AI via agentCommon.js');
    console.log('📝 Prompt preview:', prompt.substring(0, 150) + '...');
    
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key is not configured');
    }
    
    if (!GEMINI_MODEL) {
        throw new Error('Gemini model is not configured');
    }
    
    // Check rate limit before making the request
    try {
        checkRateLimit();
    } catch (error) {
        console.error('Rate limit check failed:', error);
        throw error;
    }
    
    // Corrected endpoint to use v1beta, which supports gemini-1.5-flash-latest
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    
    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            maxOutputTokens: options.maxTokens || 1000,
            temperature: options.temperature || 0.7,
            topP: options.topP || 0.95,
            topK: options.topK || 40,
            candidateCount: 1,
            stopSequences: []
        },
        safetySettings: [
            {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
        ]
    };
    
    const makeRequest = async () => {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            
            console.log('📡 Response status:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ HTTP error details:', errorText);
                
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.error && errorData.error.message) {
                        throw new Error(`Gemini API Error: ${errorData.error.message}`);
                    }
                } catch (parseError) {
                    // Fallback to raw text if JSON parsing fails
                }
                
                throw new Error(`Gemini API HTTP error ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            
            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                const responseText = data.candidates[0].content.parts[0].text;
                console.log('💬 Response preview:', responseText.substring(0, 100) + '...');
                return responseText;
            } else {
                console.warn('Unexpected API response structure:', data);
                if (data.promptFeedback?.blockReason) {
                    throw new Error(`Content blocked by Gemini AI safety filters: ${data.promptFeedback.blockReason}`);
                }
                throw new Error('Received an unexpected or empty response from the Gemini API.');
            }
        } catch (error) {
            console.error("Fetch or processing error in makeRequest:", error);
            throw error; // Re-throw to be caught by retryWithBackoff
        }
    };
    
    try {
        return await retryWithBackoff(makeRequest, 3, 2000); // Increased initial delay
    } catch (error) {
        console.error('💥 Final Error after retries in callGeminiAI:', error);
        
        // Provide more user-friendly error messages
        if (error.message.includes('quota')) {
            throw new Error('API quota exceeded. The service is currently unavailable.');
        } else if (error.message.includes('Rate limit')) {
            throw new Error('Too many requests. Please wait a moment before trying again.');
        } else if (error.message.includes('fetch') || error.message.includes('Network')) {
            throw new Error('Network error: Unable to connect to the AI service.');
        } else if (error.message.includes('API_KEY')) {
            throw new Error('AI service configuration error. Please contact support.');
        }
        
        // Default to throwing the specific Gemini API error message if available
        throw error;
    }
} 