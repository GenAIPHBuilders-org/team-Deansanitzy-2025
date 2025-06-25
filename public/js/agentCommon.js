// Common utilities for AI agents
import { GEMINI_API_KEY, GEMINI_MODEL } from './config.js';

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
    
    try {
        console.log('🚀 Sending request to Gemini API...');
        
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
        console.log('✅ Received response from Gemini API');
        
        if (data.candidates && data.candidates.length > 0 && 
            data.candidates[0].content && data.candidates[0].content.parts && 
            data.candidates[0].content.parts.length > 0) {
            
            const responseText = data.candidates[0].content.parts[0].text;
            console.log('💬 Response preview:', responseText.substring(0, 100) + '...');
            return responseText;
        } else if (data.promptFeedback && data.promptFeedback.blockReason) {
            console.error('🚫 Gemini API blocked:', data.promptFeedback.blockReason);
            throw new Error('Content was blocked by Gemini AI safety filters. Please try rephrasing your question.');
        } else {
            console.error('⚠️ Unexpected API response structure:', JSON.stringify(data, null, 2));
            throw new Error('Received unexpected response format from Gemini API');
        }
    } catch (error) {
        console.error('💥 Error calling Gemini API:', error);
        
        if (error.message.includes('fetch')) {
            throw new Error('Network error: Unable to connect to AI service. Please check your internet connection.');
        } else if (error.message.includes('API_KEY')) {
            throw new Error('AI service configuration error. Please contact support.');
        } else if (error.message.includes('quota')) {
            throw new Error('AI service is temporarily unavailable due to high demand. Please try again later.');
        }
        
        throw error;
    }
} 