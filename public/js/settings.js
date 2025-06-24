// Settings Page JavaScript

// Global variables
let currentLinkCode = null;
let codeTimer = null;
let linkingInProgress = false;

// Initialize settings page
document.addEventListener('DOMContentLoaded', function() {
    initializeSettings();
    checkTelegramLinkStatus();
    loadUserSettings();
});

// Initialize all settings functionality
function initializeSettings() {
    console.log('🔧 Settings page initialized');
    
    // Set up event listeners
    setupEventListeners();
    
    // Check authentication status
    checkAuthStatus();
}

// Setup event listeners
function setupEventListeners() {
    // Modal close on background click
    document.getElementById('linkModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeLinkModal();
        }
    });
    
    // Escape key to close modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeLinkModal();
        }
    });
}

// Check authentication status
function checkAuthStatus() {
    // This would integrate with your existing auth system
    // For now, just load user info if available
    const userEmail = localStorage.getItem('userEmail') || 'user@example.com';
    document.getElementById('userEmail').value = userEmail;
}

// Load user settings from Firestore
async function loadUserSettings() {
    try {
        showLoading();
        
        // Get user ID (this should come from your auth system)
        const userId = getCurrentUserId();
        
        if (!userId) {
            hideLoading();
            return;
        }
        
        // Load user preferences from Firestore
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            // Populate form fields
            if (userData.displayName) {
                document.getElementById('userName').value = userData.displayName;
            }
            
            if (userData.currency) {
                document.getElementById('currency').value = userData.currency;
            }
            
            if (userData.preferences) {
                const prefs = userData.preferences;
                document.getElementById('dataSync').checked = prefs.dataSync !== false;
                document.getElementById('emailNotifications').checked = prefs.emailNotifications === true;
            }
        }
        
        hideLoading();
    } catch (error) {
        console.error('❌ Error loading user settings:', error);
        hideLoading();
    }
}

// Get current user ID (integrate with your auth system)
function getCurrentUserId() {
    // This should integrate with your existing authentication
    // For now, return a default user ID
    return localStorage.getItem('userId') || 'default-user';
}

// Check Telegram link status
async function checkTelegramLinkStatus() {
    try {
        const userId = getCurrentUserId();
        
        if (!userId) return;
        
        // Check if user has linked Telegram account
        const linkDoc = await db.collection('telegram_links').doc(userId).get();
        
        if (linkDoc.exists) {
            const linkData = linkDoc.data();
            updateTelegramStatus(true, linkData);
        } else {
            updateTelegramStatus(false);
        }
    } catch (error) {
        console.error('❌ Error checking Telegram link status:', error);
        updateTelegramStatus(false);
    }
}

// Update Telegram connection status UI
function updateTelegramStatus(isConnected, linkData = null) {
    const statusCard = document.getElementById('statusCard');
    const statusIcon = document.getElementById('statusIcon');
    const statusTitle = document.getElementById('statusTitle');
    const statusDescription = document.getElementById('statusDescription');
    const actionBtn = document.getElementById('telegramActionBtn');
    
    if (isConnected) {
        // Connected state
        statusCard.classList.add('connected');
        statusIcon.innerHTML = '<i class="fas fa-link"></i>';
        statusTitle.textContent = 'Connected';
        statusDescription.textContent = `Connected to Telegram${linkData?.telegramUsername ? ` (@${linkData.telegramUsername})` : ''}`;
        actionBtn.innerHTML = '<i class="fas fa-unlink"></i> Disconnect';
        actionBtn.className = 'btn btn-outline';
    } else {
        // Disconnected state
        statusCard.classList.remove('connected');
        statusIcon.innerHTML = '<i class="fas fa-unlink"></i>';
        statusTitle.textContent = 'Not Connected';
        statusDescription.textContent = 'Connect your Telegram to start scanning receipts on the go';
        actionBtn.innerHTML = '<i class="fab fa-telegram"></i> Connect Telegram';
        actionBtn.className = 'btn btn-primary';
    }
}

// Handle Telegram action (connect/disconnect)
async function handleTelegramAction() {
    const actionBtn = document.getElementById('telegramActionBtn');
    const isConnected = actionBtn.textContent.includes('Disconnect');
    
    if (isConnected) {
        await disconnectTelegram();
    } else {
        await initiateTelegramLink();
    }
}

// Initiate Telegram linking process
async function initiateTelegramLink() {
    if (linkingInProgress) return;
    
    try {
        linkingInProgress = true;
        
        // Generate new link code
        await generateLinkCode();
        
        // Show link modal
        document.getElementById('linkModal').style.display = 'flex';
        
        // Start polling for link confirmation
        startLinkPolling();
        
    } catch (error) {
        console.error('❌ Error initiating Telegram link:', error);
        alert('Failed to generate link code. Please try again.');
        linkingInProgress = false;
    }
}

// Generate new link code
async function generateLinkCode() {
    const userId = getCurrentUserId();
    
    // Generate 6-character code
    currentLinkCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Store link code in Firestore with expiration
    const linkCodeData = {
        userId: userId,
        code: currentLinkCode,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        used: false
    };
    
    await db.collection('link_codes').doc(currentLinkCode).set(linkCodeData);
    
    // Update UI
    document.getElementById('linkCodeText').textContent = currentLinkCode;
    
    // Start countdown timer
    startCodeTimer();
    
    console.log('🔗 Generated link code:', currentLinkCode);
}

// Start countdown timer for link code
function startCodeTimer() {
    let timeLeft = 10 * 60; // 10 minutes in seconds
    const timerElement = document.getElementById('codeTimer');
    
    // Clear existing timer
    if (codeTimer) {
        clearInterval(codeTimer);
    }
    
    codeTimer = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        timeLeft--;
        
        if (timeLeft < 0) {
            clearInterval(codeTimer);
            timerElement.textContent = 'Expired';
            timerElement.style.color = '#ef4444';
            currentLinkCode = null;
        }
    }, 1000);
}

// Start polling for link confirmation
function startLinkPolling() {
    const pollInterval = setInterval(async () => {
        if (!currentLinkCode) {
            clearInterval(pollInterval);
            return;
        }
        
        try {
            // Check if code has been used
            const codeDoc = await db.collection('link_codes').doc(currentLinkCode).get();
            
            if (codeDoc.exists && codeDoc.data().used) {
                // Link successful!
                clearInterval(pollInterval);
                closeLinkModal();
                
                // Show success message
                showSuccessMessage('Telegram account linked successfully!');
                
                // Update status
                checkTelegramLinkStatus();
                
                linkingInProgress = false;
            }
        } catch (error) {
            console.error('❌ Error polling for link confirmation:', error);
        }
    }, 2000); // Poll every 2 seconds
    
    // Stop polling after 10 minutes
    setTimeout(() => {
        clearInterval(pollInterval);
        linkingInProgress = false;
    }, 10 * 60 * 1000);
}

// Disconnect Telegram account
async function disconnectTelegram() {
    if (!confirm('Are you sure you want to disconnect your Telegram account?')) {
        return;
    }
    
    try {
        showLoading();
        
        const userId = getCurrentUserId();
        
        // Remove link from Firestore
        await db.collection('telegram_links').doc(userId).delete();
        
        // Update UI
        updateTelegramStatus(false);
        
        showSuccessMessage('Telegram account disconnected successfully!');
        
        hideLoading();
    } catch (error) {
        console.error('❌ Error disconnecting Telegram:', error);
        alert('Failed to disconnect Telegram account. Please try again.');
        hideLoading();
    }
}

// Close link modal
function closeLinkModal() {
    document.getElementById('linkModal').style.display = 'none';
    
    // Clear timer
    if (codeTimer) {
        clearInterval(codeTimer);
        codeTimer = null;
    }
    
    currentLinkCode = null;
    linkingInProgress = false;
}

// Copy link code to clipboard
async function copyLinkCode() {
    if (!currentLinkCode) return;
    
    try {
        await navigator.clipboard.writeText(currentLinkCode);
        
        // Show feedback
        const copyBtn = document.querySelector('.copy-btn');
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        
        setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
        }, 2000);
        
    } catch (error) {
        console.error('❌ Failed to copy to clipboard:', error);
        
        // Fallback: select text
        const linkCodeText = document.getElementById('linkCodeText');
        linkCodeText.select();
        document.execCommand('copy');
    }
}

// Refresh link code
async function refreshLinkCode() {
    try {
        await generateLinkCode();
        showSuccessMessage('New link code generated!');
    } catch (error) {
        console.error('❌ Error refreshing link code:', error);
        alert('Failed to generate new code. Please try again.');
    }
}

// Open Telegram bot
function openTelegramBot() {
    // Open Telegram bot in new window/tab
    const telegramURL = 'https://t.me/kitakita_receipt_bot';
    window.open(telegramURL, '_blank');
}

// Update display name
async function updateDisplayName() {
    const nameInput = document.getElementById('userName');
    const newName = nameInput.value.trim();
    
    if (!newName) {
        alert('Please enter a valid name');
        return;
    }
    
    try {
        showLoading();
        
        const userId = getCurrentUserId();
        
        await db.collection('users').doc(userId).update({
            displayName: newName,
            updatedAt: new Date()
        });
        
        showSuccessMessage('Display name updated successfully!');
        hideLoading();
        
    } catch (error) {
        console.error('❌ Error updating display name:', error);
        alert('Failed to update display name. Please try again.');
        hideLoading();
    }
}

// Export user data
async function exportData() {
    try {
        showLoading();
        
        const userId = getCurrentUserId();
        
        // Get user transactions
        const transactionsSnapshot = await db.collection('users').doc(userId).collection('transactions').get();
        
        const transactions = [];
        transactionsSnapshot.forEach(doc => {
            transactions.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Create export data
        const exportData = {
            exportDate: new Date().toISOString(),
            userId: userId,
            transactions: transactions,
            totalTransactions: transactions.length
        };
        
        // Download as JSON file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `kita-kita-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        showSuccessMessage('Data exported successfully!');
        hideLoading();
        
    } catch (error) {
        console.error('❌ Error exporting data:', error);
        alert('Failed to export data. Please try again.');
        hideLoading();
    }
}

// Clear all data
async function clearAllData() {
    const confirmation = prompt('Type "DELETE ALL" to confirm you want to permanently delete all your data:');
    
    if (confirmation !== 'DELETE ALL') {
        return;
    }
    
    try {
        showLoading();
        
        const userId = getCurrentUserId();
        
        // Delete all transactions
        const transactionsSnapshot = await db.collection('users').doc(userId).collection('transactions').get();
        
        const batch = db.batch();
        transactionsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        
        // Also clear local storage
        localStorage.removeItem('transactions');
        
        showSuccessMessage('All data cleared successfully!');
        hideLoading();
        
        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error clearing data:', error);
        alert('Failed to clear data. Please try again.');
        hideLoading();
    }
}

// Sign out function
function signOut() {
    if (confirm('Are you sure you want to sign out?')) {
        // Clear local storage
        localStorage.clear();
        
        // Redirect to login
        window.location.href = '../index.html';
    }
}

// Utility functions
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showSuccessMessage(message) {
    // Create and show a temporary success message
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        z-index: 3000;
        font-weight: 500;
    `;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        document.body.removeChild(messageDiv);
    }, 3000);
}

// Initialize Firestore (if not already initialized)
if (typeof db === 'undefined') {
    // This should be imported from your existing Firebase setup
    console.warn('⚠️ Firestore not initialized. Please ensure Firebase is properly configured.');
} 