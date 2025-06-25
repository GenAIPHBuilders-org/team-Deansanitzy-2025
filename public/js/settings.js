// Settings Page JavaScript

// Global variables

// Initialize settings page
document.addEventListener('DOMContentLoaded', function() {
    initializeSettings();

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