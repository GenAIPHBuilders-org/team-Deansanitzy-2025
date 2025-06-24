// Simplified profile.js for testing telegram key generation
// This version works without Firebase or server dependencies

// Global variables
let currentUser = { uid: 'test-user-123', email: 'test@example.com' };
let telegramKey = null;

// Mock localStorage for user data
const mockUserStorage = {
    get: (key) => {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch {
            return null;
        }
    },
    set: (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
    }
};

// Initialize the profile page
document.addEventListener('DOMContentLoaded', function() {
    console.log('Profile page loaded, initializing...');
    
    // Mock user authentication
    setTimeout(() => {
        console.log('Mock user authenticated:', currentUser.uid);
        loadUserProfile(currentUser);
        loadTelegramKey(currentUser);
    }, 100);

    // Initialize event listeners
    initializeEventListeners();
});

// Load user profile information
async function loadUserProfile(user) {
    try {
        console.log('Loading user profile for:', user.uid);
        
        // Mock user data
        const userData = {
            firstName: 'Test',
            lastName: 'User',
            email: user.email,
            createdAt: new Date().toISOString(),
            accountStatus: 'active'
        };

        // Update UI elements
        updateUserInfoDisplay(user, userData);
        
    } catch (error) {
        console.error('Error loading user profile:', error);
        showError('Failed to load profile information');
    }
}

// Update user information display
function updateUserInfoDisplay(user, userData) {
    try {
        // Display Name
        const displayNameElement = document.getElementById('user-display-name');
        const fullName = `${userData.firstName} ${userData.lastName}`;
        displayNameElement.textContent = fullName;

        // Email Address
        const emailElement = document.getElementById('user-email');
        emailElement.innerHTML = `
            <i class="fas fa-envelope"></i>
            ${user.email}
        `;

        // Account Status
        const statusElement = document.getElementById('user-status');
        statusElement.innerHTML = `
            <span class="verified-badge">
                <i class="fas fa-check-circle"></i>
                Verified
            </span>
        `;

        // Member Since
        const joinedElement = document.getElementById('user-joined');
        const joinDate = new Date(userData.createdAt);
        joinedElement.innerHTML = `
            <i class="fas fa-calendar-alt"></i>
            ${joinDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })}
        `;

        console.log('User info display updated successfully');
    } catch (error) {
        console.error('Error updating user info display:', error);
    }
}

// Load telegram connection key
async function loadTelegramKey(user) {
    try {
        console.log('Loading telegram key for user:', user.uid);
        
        // Try to get existing key from localStorage
        const existingKey = mockUserStorage.get(`telegram_key_${user.uid}`);
        if (existingKey) {
            telegramKey = existingKey.key;
            updateTelegramKeyDisplay(existingKey);
            console.log('Existing telegram key found:', telegramKey);
            return;
        }
        
        // Generate new key
        await generateTelegramKey(user);
        
    } catch (error) {
        console.error('Error loading telegram key:', error);
        showError('Failed to load Telegram connection key');
    }
}

// Generate telegram key
async function generateTelegramKey(user) {
    try {
        console.log('Generating telegram key for user:', user.uid);
        
        // Generate a unique key
        const timestamp = Date.now().toString(36).toUpperCase();
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        const newKey = `TG-${timestamp}-${randomPart}`;
        
        const keyData = {
            key: newKey,
            isConnected: false,
            telegramUserId: null,
            telegramUsername: null,
            isPermanent: true,
            createdAt: new Date().toISOString()
        };
        
        // Store in localStorage
        mockUserStorage.set(`telegram_key_${user.uid}`, keyData);
        
        telegramKey = newKey;
        updateTelegramKeyDisplay(keyData);
        
        console.log('Telegram key generated successfully:', newKey);
        
    } catch (error) {
        console.error('Error generating telegram key:', error);
        throw error;
    }
}

// Update telegram key display
function updateTelegramKeyDisplay(keyData) {
    try {
        const keyElement = document.getElementById('telegram-key');
        const copyButton = document.getElementById('copy-key-btn');
        const statusElement = document.getElementById('connection-status');
        
        // Display the key
        keyElement.textContent = keyData.key;
        
        // Enable copy button
        copyButton.disabled = false;
        
        // Update connection status
        if (keyData.isConnected) {
            statusElement.className = 'connection-status connected';
            statusElement.innerHTML = `
                <div class="status-dot"></div>
                <span>Connected${keyData.telegramUsername ? ` (@${keyData.telegramUsername})` : ''}</span>
            `;
        } else {
            statusElement.className = 'connection-status disconnected';
            statusElement.innerHTML = `
                <div class="status-dot"></div>
                <span>Not Connected</span>
            `;
        }
        
        // Show key type info
        const keyInfoElement = document.querySelector('.key-info-text');
        if (keyInfoElement) {
            keyInfoElement.innerHTML = '<i class="fas fa-infinity"></i> This is your permanent connection key - it never expires (test mode)';
        }
        
        console.log('Telegram key display updated');
        
    } catch (error) {
        console.error('Error updating telegram key display:', error);
    }
}

// Initialize event listeners
function initializeEventListeners() {
    // Copy key button
    const copyButton = document.getElementById('copy-key-btn');
    if (copyButton) {
        copyButton.addEventListener('click', copyTelegramKey);
    }
    
    // Global functions for buttons (called from HTML onclick)
    window.refreshTelegramKey = refreshTelegramKey;
    window.signOut = signOutUser;
    
    console.log('Event listeners initialized');
}

// Copy telegram key to clipboard
async function copyTelegramKey() {
    try {
        const keyElement = document.getElementById('telegram-key');
        const copyButton = document.getElementById('copy-key-btn');
        
        if (!telegramKey || !keyElement.textContent) {
            showError('No key available to copy');
            return;
        }
        
        // Copy to clipboard
        await navigator.clipboard.writeText(telegramKey);
        
        // Visual feedback
        copyButton.classList.add('copy-success');
        const originalIcon = copyButton.querySelector('i');
        const originalText = copyButton.querySelector('span') || copyButton.lastChild;
        
        originalIcon.className = 'fas fa-check';
        if (originalText.textContent) {
            originalText.textContent = 'Copied!';
        }
        
        // Reset after 2 seconds
        setTimeout(() => {
            copyButton.classList.remove('copy-success');
            originalIcon.className = 'fas fa-copy';
            if (originalText.textContent) {
                originalText.textContent = 'Copy';
            }
        }, 2000);
        
        console.log('Telegram key copied to clipboard');
        
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        showError('Failed to copy key to clipboard');
    }
}

// Refresh telegram key
async function refreshTelegramKey() {
    try {
        if (!currentUser) {
            showError('No user authenticated');
            return;
        }
        
        console.log('Refreshing telegram key...');
        
        // Show loading state
        const keyElement = document.getElementById('telegram-key');
        const copyButton = document.getElementById('copy-key-btn');
        
        keyElement.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Generating...</div>';
        copyButton.disabled = true;
        
        // Generate new key
        await generateTelegramKey(currentUser);
        
        showSuccess('New Telegram key generated successfully!');
        
    } catch (error) {
        console.error('Error refreshing telegram key:', error);
        showError('Failed to refresh Telegram key: ' + error.message);
        
        // Restore previous key display if possible
        if (telegramKey) {
            const keyElement = document.getElementById('telegram-key');
            const copyButton = document.getElementById('copy-key-btn');
            keyElement.textContent = telegramKey;
            copyButton.disabled = false;
        }
    }
}

// Sign out user (mock)
async function signOutUser() {
    try {
        console.log('Signing out user...');
        alert('Sign out functionality is mocked in test mode');
    } catch (error) {
        console.error('Error signing out:', error);
        showError('Failed to sign out');
    }
}

// Utility functions
function showError(message) {
    console.error('Error:', message);
    alert('Error: ' + message);
}

function showSuccess(message) {
    console.log('Success:', message);
    alert('Success: ' + message);
}

// Export functions for debugging
window.profileDebug = {
    loadUserProfile,
    loadTelegramKey,
    generateTelegramKey,
    refreshTelegramKey,
    copyTelegramKey,
    currentUser: () => currentUser,
    telegramKey: () => telegramKey
};

console.log('Simple Profile.js loaded successfully - test mode active'); 