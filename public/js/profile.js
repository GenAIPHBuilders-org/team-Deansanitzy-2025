// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
import { firebaseConfig } from "./config.js";
import { getUserData, storeUserData } from "./firestoredb.js";
import { secureStorage } from "./helpers.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global variables
let currentUser = null;
let telegramKey = null;

// Initialize the profile page
document.addEventListener('DOMContentLoaded', function() {
    console.log('Profile page loaded, initializing...');
    
    // Check authentication state
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            console.log('User authenticated:', user.uid);
            loadUserProfile(user);
            loadTelegramKey(user);
        } else {
            console.log('No authenticated user, redirecting to login');
            window.location.href = 'login.html';
        }
    });

    // Initialize event listeners
    initializeEventListeners();
});

// Load user profile information
async function loadUserProfile(user) {
    try {
        console.log('Loading user profile for:', user.uid);
        
        // Get user data from Firestore
        let userData = await getUserData(user.uid);
        
        // If no user data in Firestore, create from auth user
        if (!userData) {
            console.log('No user data found, creating from auth user');
            const nameParts = user.displayName ? user.displayName.split(' ') : [];
            userData = {
                firstName: nameParts[0] || user.email.split('@')[0],
                lastName: nameParts.slice(1).join(' ') || '',
                email: user.email,
                createdAt: user.metadata.creationTime,
                lastLogin: user.metadata.lastSignInTime,
                accountStatus: 'active'
            };
            
            // Store the new user data
            await storeUserData(user.uid, userData);
        }

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
        const fullName = userData.firstName && userData.lastName 
            ? `${userData.firstName} ${userData.lastName}`.trim()
            : user.displayName || user.email.split('@')[0];
        displayNameElement.textContent = fullName;

        // Email Address
        const emailElement = document.getElementById('user-email');
        emailElement.innerHTML = `
            <i class="fas fa-envelope"></i>
            ${user.email}
        `;

        // Account Status
        const statusElement = document.getElementById('user-status');
        const isVerified = user.emailVerified;
        statusElement.innerHTML = `
            <span class="verified-badge ${isVerified ? '' : 'unverified'}">
                <i class="fas ${isVerified ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
                ${isVerified ? 'Verified' : 'Unverified'}
            </span>
        `;

        // Member Since
        const joinedElement = document.getElementById('user-joined');
        const joinDate = new Date(userData.createdAt || user.metadata.creationTime);
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

// Load telegram connection key from server
async function loadTelegramKey(user) {
    if (!user) {
        console.log('No authenticated user');
        return;
    }

    try {
        // Use user's email to generate fixed key
        const fixedKey = generateFixedKeyFromEmail(user.email);
        
        // Ensure the user has this fixed key in the database
        await ensureFixedKeyExists(user, fixedKey);
        
        // Display the key
        displayTelegramKey({
            telegramKey: fixedKey,
            isFixed: true, // Changed from isPermanent to isFixed
            telegramKeyUsed: false // We'll get the actual status from the server
        });

        // Load the actual usage status from server
        const response = await fetch(`/api/user/${user.uid}/telegram-key`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${await user.getIdToken()}`
            }
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                // Update the display with actual usage status
                displayTelegramKey({
                    telegramKey: fixedKey,
                    isFixed: true,
                    telegramKeyUsed: result.data.telegramKeyUsed
                });
            }
        }
    } catch (error) {
        console.error('Error loading telegram key:', error);
        showError('Failed to load Telegram key');
    }
}

// Generate a fixed key based on user email (deterministic and permanent)
function generateFixedKeyFromEmail(email) {
    // Create a deterministic key based on email address
    // This ensures the same email always gets the same key
    const emailHash = btoa(email).replace(/[^A-Z0-9]/g, '');
    const timestamp = Date.now().toString(36).toUpperCase();
    
    // Create consistent parts from email hash
    let hash = emailHash;
    while (hash.length < 20) {
        hash += emailHash; // Repeat if too short
    }
    
    const part1 = hash.substring(0, 6);
    const part2 = hash.substring(6, 13);
    const part3 = hash.substring(13, 19);
    
    return `TG-${part1}-${part2}-${part3}`;
}

// Ensure the fixed key exists on the server
async function ensureFixedKeyExists(user, fixedKey) {
    try {
        const idToken = await user.getIdToken();
        
        const response = await fetch('/api/user/ensure-fixed-key', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: user.uid,
                email: user.email,
                displayName: user.displayName,
                fixedKey: fixedKey
            })
        });
        
        if (response.ok) {
            console.log('Fixed key ensured on server');
        } else {
            console.warn('Failed to ensure fixed key on server');
        }
    } catch (error) {
        console.error('Error ensuring fixed key:', error);
    }
}

// Check telegram connection status periodically
function startConnectionStatusCheck() {
    if (!currentUser) return;
    
    const checkInterval = setInterval(async () => {
        try {
            // Check connection status via the new API endpoint
            const response = await fetch(`/api/user/${currentUser.uid}/telegram-status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${await currentUser.getIdToken()}`
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    const statusData = result.data;
                    
                    // Update connection status display
                    const statusElement = document.getElementById('connection-status');
                    if (statusElement) {
                        if (statusData.connected) {
                            statusElement.className = 'connection-status connected';
                            statusElement.innerHTML = `
                                <div class="status-dot"></div>
                                <span>Connected to ${statusData.botInfo.botName}</span>
                            `;
                            
                            // Show connection details if available
                            if (statusData.connectionInfo) {
                                const telegramUser = statusData.connectionInfo.telegramFirstName 
                                    + (statusData.connectionInfo.telegramLastName ? ` ${statusData.connectionInfo.telegramLastName}` : '');
                                const username = statusData.connectionInfo.telegramUsername 
                                    ? `@${statusData.connectionInfo.telegramUsername}` : 'No username';
                                
                                // You could add a detail element or tooltip here
                                console.log(`📱 Connected to Telegram: ${telegramUser} (${username})`);
                            }
                        } else {
                            statusElement.className = 'connection-status disconnected';
                            statusElement.innerHTML = `
                                <div class="status-dot"></div>
                                <span>Not Connected</span>
                            `;
                        }
                    }
                    
                    // Update bot link with correct URL
                    const botLink = document.querySelector('.telegram-bot-link');
                    if (botLink && statusData.botInfo) {
                        botLink.href = statusData.botInfo.botUrl;
                        botLink.innerHTML = `
                            <i class="fab fa-telegram-plane"></i>
                            Open ${statusData.botInfo.botName}
                        `;
                    }
                }
            }
        } catch (error) {
            console.error('Error checking connection status:', error);
        }
    }, 15000); // Check every 15 seconds for more responsive updates
    
    // Store interval ID to clear it later if needed
    window.connectionStatusInterval = checkInterval;
}

// Update telegram key display
function displayTelegramKey(keyData) {
    try {
        const keyElement = document.getElementById('telegram-key');
        const copyButton = document.getElementById('copy-key-btn');
        const statusElement = document.getElementById('connection-status');
        
        // Display the key
        keyElement.textContent = keyData.telegramKey;
        telegramKey = keyData.telegramKey; // Store globally for copy function
        
        // Enable copy button
        copyButton.disabled = false;
        
        // Update connection status
        if (keyData.telegramKeyUsed) {
            statusElement.className = 'connection-status connected';
            statusElement.innerHTML = `
                <div class="status-dot"></div>
                <span>Connected to Kita-kita Bot</span>
            `;
        } else {
            statusElement.className = 'connection-status disconnected';
            statusElement.innerHTML = `
                <div class="status-dot"></div>
                <span>Not Connected</span>
            `;
        }
        
        // Show permanent key info
        const keyInfoElement = document.querySelector('.key-info-text');
        if (keyInfoElement) {
            keyInfoElement.innerHTML = `<i class="fas fa-infinity"></i> This is your permanent connection key - it never changes or expires`;
        }
        
        // Update instructions with correct bot username
        const instructionsElement = document.querySelector('.telegram-instructions ol');
        if (instructionsElement) {
            instructionsElement.innerHTML = `
                <li>Copy your unique connection key below</li>
                <li>Open Telegram and search for <strong>@KitakitaAIBot</strong></li>
                <li>Start a conversation with the bot by sending <code>/start</code></li>
                <li>Click "🔗 Connect Account" or send <code>/connect [your-key]</code></li>
                <li>Enjoy managing your finances through Telegram!</li>
            `;
        }
        
        // Hide refresh button since key is permanent
        const refreshButton = document.getElementById('refresh-key-btn');
        if (refreshButton) {
            refreshButton.style.display = 'none';
        }
        
        console.log('✅ Fixed telegram key display updated with Kita-kita Bot info');
        
    } catch (error) {
        console.error('Error updating telegram key display:', error);
    }
}

// Initialize event listeners
function initializeEventListeners() {
    // Copy telegram key button
    const copyKeyBtn = document.getElementById('copy-key-btn');
    if (copyKeyBtn) {
        copyKeyBtn.addEventListener('click', copyTelegramKey);
    }
    
    // Global functions for HTML onclick handlers
    window.signOut = signOutUser;
    
    // Note: Removed refresh key functionality - keys are now fixed per email
    console.log('Event listeners initialized');
}

// Copy telegram key to clipboard
async function copyTelegramKey() {
    try {
        if (!telegramKey) {
            showError('No Telegram key available to copy');
            return;
        }
        
        // Copy to clipboard
        await navigator.clipboard.writeText(telegramKey);
        
        // Visual feedback
        const copyButton = document.getElementById('copy-key-btn');
        const originalIcon = copyButton.querySelector('i');
        const originalText = copyButton.querySelector('span') || copyButton.childNodes[copyButton.childNodes.length - 1];
        
        copyButton.classList.add('copy-success');
        originalIcon.className = 'fas fa-check';
        if (originalText && originalText.textContent) {
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

// Sign out user
async function signOutUser() {
    try {
        console.log('Signing out user...');
        
        // Clear secure storage
        if (secureStorage && secureStorage.clearAll) {
            secureStorage.clearAll();
        }
        
        // Sign out from Firebase
        await signOut(auth);
        
        // Redirect to login
        window.location.href = 'login.html';
        
    } catch (error) {
        console.error('Error signing out:', error);
        showError('Failed to sign out');
    }
}

// Utility functions
function showError(message) {
    console.error('Error:', message);
    // You can implement a toast notification here
    alert('Error: ' + message);
}

function showSuccess(message) {
    console.log('Success:', message);
    // You can implement a toast notification here
    alert(message);
}

// Start checking connection status when user is loaded
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (currentUser) {
            startConnectionStatusCheck();
        }
    }, 5000); // Start checking after 5 seconds
});

// Clean up interval when page unloads
window.addEventListener('beforeunload', function() {
    if (window.connectionStatusInterval) {
        clearInterval(window.connectionStatusInterval);
    }
});

// Export functions for debugging
window.profileDebug = {
    loadUserProfile,
    loadTelegramKey,
    ensureFixedKeyExists,
    copyTelegramKey,
    currentUser: () => currentUser,
    telegramKey: () => telegramKey
};

console.log('Profile.js loaded successfully');
