// Ensure the API key is defined
import { GEMINI_API_KEY, GEMINI_MODEL } from "./config.js";

// Chatbot functionality for index page
class IndexChatbot {
    constructor() {
        this.isOpen = false;
        this.conversationHistory = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.addWelcomeMessage();
    }

    bindEvents() {
        const toggle = document.getElementById('chatbotToggle');
        const closeBtn = document.getElementById('closeChatbot');
        const sendBtn = document.getElementById('sendMessage');
        const input = document.getElementById('userInput');

        if (toggle) {
            toggle.addEventListener('click', () => this.toggleChatbot());
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeChatbot());
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }
    }

    toggleChatbot() {
        const window = document.getElementById('chatbotWindow');
        if (window) {
            this.isOpen = !this.isOpen;
            window.style.display = this.isOpen ? 'flex' : 'none';
        }
    }

    closeChatbot() {
        const window = document.getElementById('chatbotWindow');
        if (window) {
            this.isOpen = false;
            window.style.display = 'none';
        }
    }

    addWelcomeMessage() {
        const welcomeMessage = {
            role: 'assistant',
            content: `👋 Hello! I'm your AI Financial Assistant. I can help you with:

• Financial planning and budgeting advice
• Investment guidance for the Philippine market
• Expense tracking tips
• Savings strategies
• General financial questions

How can I assist you today?`
        };
        
        this.displayMessage(welcomeMessage);
        this.conversationHistory.push(welcomeMessage);
    }

    async sendMessage() {
        const input = document.getElementById('userInput');
        const message = input.value.trim();
        
        if (!message) return;

        // Display user message
        const userMessage = { role: 'user', content: message };
        this.displayMessage(userMessage);
        this.conversationHistory.push(userMessage);
        
        // Clear input
        input.value = '';
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Use backend endpoint instead of direct API call
            const response = await this.callBackendAPI(message);
            
            // Remove typing indicator
            this.removeTypingIndicator();
            
            // Display AI response
            const aiMessage = { role: 'assistant', content: response };
            this.displayMessage(aiMessage);
            this.conversationHistory.push(aiMessage);
            
        } catch (error) {
            console.error('Error getting AI response:', error);
            this.removeTypingIndicator();
            
            const errorMessage = {
                role: 'assistant',
                content: '❌ Sorry, I encountered an error. Please try again later or contact support if the problem persists.'
            };
            this.displayMessage(errorMessage);
        }
    }

    async callBackendAPI(message) {
        try {
            const response = await fetch('/api/crew-ai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    userId: 'anonymous_user', // For index page users
                    context: {
                        conversationHistory: this.conversationHistory.slice(-5), // Last 5 messages for context
                        source: 'index_page'
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.response || data.message || 'I apologize, but I couldn\'t generate a proper response. Please try rephrasing your question.';
            
        } catch (error) {
            console.error('Backend API call failed:', error);
            throw error;
        }
    }

    // Fallback method for direct API calls (deprecated - kept for backward compatibility)
    async callGeminiAPI(message) {
        console.warn('⚠️ Direct API calls are deprecated. Please use backend endpoint instead.');
        
        // Return a fallback message instead of making direct API calls
        return "I'm currently unable to process your request. Please ensure the backend server is running and try again.";
    }

    displayMessage(message) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = message.content;
        
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = new Date().toLocaleTimeString();
        
        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(timestamp);
        messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;

        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant typing-indicator';
        typingDiv.id = 'typing-indicator';
        
        const dots = document.createElement('div');
        dots.className = 'typing-dots';
        dots.innerHTML = '<span></span><span></span><span></span>';
        
        typingDiv.appendChild(dots);
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    removeTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new IndexChatbot();
});
