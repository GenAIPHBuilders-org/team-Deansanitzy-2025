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
 * Calls a local AI model via Ollama.
 * @param {string} prompt The complete prompt to send to the AI.
 * @param {object} options Optional parameters for the generation config.
 * @returns {Promise<string>} The text response from the AI.
 */
export async function callLocalAI(prompt, options = {}) {
    console.log('🤖 Calling LOCAL AI (Ollama) via agentCommon.js');
    const endpoint = 'http://localhost:11434/api/generate';
    const body = {
        model: "llama3:latest", // Updated to use Llama 3
        prompt: prompt,
        stream: false, // Receive the full response at once
        options: {
            temperature: options.temperature || 0.2,
            top_p: options.topP || 0.95,
            top_k: options.topK || 40,
            num_ctx: 4096,
            num_predict: options.maxTokens || 4096, // Increased token limit
        }
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 120-second timeout

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Ollama API error response:', errorText);
            throw new Error(`Ollama API error: ${response.status}`);
        }

        const data = await response.json();
        return data.response;

    } catch (error) {
        console.error('💥 Error calling local AI model:', error);
        if (error.name === 'AbortError') {
            throw new Error('Local AI call timed out. The model may be taking too long to respond.');
        }
        // General error for other fetch-related issues
        throw new Error('Local AI call failed. Is the Ollama server running and accessible?');
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
            maxOutputTokens: options.maxTokens || 2048,
            temperature: options.temperature || 0.5,
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
        // Use the retry mechanism for the request
        return await retryWithBackoff(makeRequest, 3, 2000); // Increased initial delay
    } catch (error) {
        console.error('💥 Final Error after retries in callGeminiAI:', error);
        
        // Provide more user-friendly error messages
        if (error.message.includes('API key not valid')) {
            throw new Error("The Gemini API key is invalid. Please check your configuration.");
        } else if (error.message.includes('Rate limit exceeded')) {
            throw new Error("You've made too many requests in a short period. Please wait a moment before trying again.");
        } else if (error.message.includes('Content blocked')) {
            throw new Error("The request was blocked by Gemini's safety filters. Please modify your prompt and try again.");
        }
        
        // Default to throwing the specific Gemini API error message if available
        throw error;
    }
}

/**
 * A fallback function to call the Gemini AI API when the local model fails.
 * This provides a layer of resilience for the user.
 * @param {string} prompt The complete prompt to send to the AI.
 * @param {object} options Optional parameters for the generation config.
 * @returns {Promise<string>} The text response from the AI.
 */
export async function callBackupAPI(prompt, options = {}) {
    console.warn('Local AI failed, switching to backup API.');

    // Remove any JSON-only constraints from the prompt
    const modifiedPrompt = prompt.replace(/JSON ONLY/g, '').replace(/Your entire response must be a single, valid JSON object./g, '');

    try {
        // Here we explicitly call the Gemini part of the logic
        const response = await executeApiCall(modifiedPrompt, options);
        return response;

    } catch (error) {
        console.error('Backup API call also failed:', error);
        // If the backup also fails, we provide a generic error message
        // This prevents the application from crashing completely
        return JSON.stringify({
            error: "AI_SYSTEM_FAILURE",
            message: "Both primary and backup AI services are currently unavailable. Please try again later."
        });
    }
}

// Extracted the original Gemini call logic into its own function
async function executeApiCall(prompt, options) {
    console.log('🤖 Calling Gemini AI via agentCommon.js');
    console.log('📝 Prompt preview:', prompt.substring(0, 150) + '...');

    if (!GEMINI_API_KEY) throw new Error('Gemini API key is not configured');
    if (!GEMINI_MODEL) throw new Error('Gemini model is not configured');

    try {
        checkRateLimit();
    } catch (error) {
        console.error('Rate limit check failed:', error);
        throw error;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            maxOutputTokens: options.maxTokens || 4096,
            temperature: options.temperature || 0.5,
            topP: options.topP || 0.95,
            topK: options.topK || 40,
        },
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        ]
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP error details:', errorText);
        throw new Error(`Gemini API HTTP error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        const responseText = data.candidates[0].content.parts[0].text;
        return responseText;
    } else {
        if (data.promptFeedback?.blockReason) {
            throw new Error(`Content blocked by Gemini AI safety filters: ${data.promptFeedback.blockReason}`);
        }
        throw new Error('Received an unexpected or empty response from the Gemini API.');
    }
}

/**
 * A robust function to find and parse a JSON object from a string
 * that might contain extra text or markdown.
 * @param {string} text The raw string response from the AI.
 * @returns {object|null} The parsed JSON object or null if parsing fails.
 */
export function cleanAndParseJson(text) {
    if (!text || typeof text !== 'string') {
        console.warn("cleanAndParseJson received invalid input:", text);
        return null;
    }

    // Find the start of the JSON object
    const startIndex = text.indexOf('{');
    if (startIndex === -1) {
        console.error("No JSON object found in AI response:", text);
        return null;
    }

    // Find the last closing brace.
    const lastIndex = text.lastIndexOf('}');
    if (lastIndex === -1 || lastIndex < startIndex) {
        console.error("Incomplete JSON object in AI response:", text);
        return null;
    }
    
    const jsonString = text.substring(startIndex, lastIndex + 1);
    
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Failed to parse JSON from AI response:", e.message);
        console.error("Attempted to parse this string:", jsonString);
        return null;
    }
}