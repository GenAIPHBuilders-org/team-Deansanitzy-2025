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

// Call Gemini AI function
export async function callGeminiAI(prompt, options = {}) {
    console.log('🤖 Calling Gemini AI');
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
    
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    
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
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'Kita-kita-Financial-Assistant/1.0'
            },
            body: JSON.stringify(body)
        });
        
        console.log('📡 Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ HTTP error details:', errorText);
            
            // Handle specific error cases
            if (response.status === 429) {
                throw new Error('API quota exceeded. Please try again later or upgrade your plan.');
            }
            
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.error && errorData.error.message) {
                    throw new Error(`Gemini API Error: ${errorData.error.message}`);
                }
            } catch (parseError) {
                // If we can't parse the error, use the original text
            }
            
            throw new Error(`Gemini API HTTP error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0 && 
            data.candidates[0].content && data.candidates[0].content.parts && 
            data.candidates[0].content.parts.length > 0) {
            
            const responseText = data.candidates[0].content.parts[0].text;
            console.log('💬 Response preview:', responseText.substring(0, 100) + '...');
            return responseText;
        } else if (data.promptFeedback && data.promptFeedback.blockReason) {
            throw new Error('Content was blocked by Gemini AI safety filters. Please try rephrasing your question.');
        } else {
            throw new Error('Received unexpected response format from Gemini API');
        }
    };
    
    try {
        return await retryWithBackoff(makeRequest);
    } catch (error) {
        console.error('💥 Error calling Gemini API:', error);
        
        if (error.message.includes('quota exceeded')) {
            throw new Error('API quota exceeded. The service is currently unavailable. Please try again later or contact support to upgrade your plan.');
        } else if (error.message.includes('Rate limit exceeded')) {
            throw new Error('Too many requests. Please wait a moment before trying again.');
        } else if (error.message.includes('fetch')) {
            throw new Error('Network error: Unable to connect to AI service. Please check your internet connection.');
        } else if (error.message.includes('API_KEY')) {
            throw new Error('AI service configuration error. Please contact support.');
        }
        
        throw error;
    }
} 