import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { firebaseConfig } from "./config.js";
import { 
    storeBankAccount, 
    getUserBankAccounts, 
    updateBankAccount,
    deleteDoc,
    doc,
    db
} from "./firestoredb.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Account type configurations
const ACCOUNT_CONFIGS = {
    'traditional-bank': {
        providers: [
            'BPI', 'BDO', 'Metrobank', 'Banco de Oro', 'Security Bank', 
            'RCBC', 'PNB', 'UnionBank', 'Chinabank', 'EastWest Bank',
            'Maybank', 'PSBank', 'Land Bank', 'DBP', 'Other'
        ],
        types: ['Savings Account', 'Checking Account', 'Credit Card', 'Time Deposit', 'Other']
    },
    'digital-wallet': {
        providers: [
            'GCash', 'PayMaya', 'GrabPay', 'ShopeePay', 'LazWallet',
            'Coins.ph', 'PayPal', 'Paymongo', 'DragonPay', 'Other'
        ],
        types: ['Digital Wallet', 'E-money Account', 'Prepaid Card', 'Other']
    },
    'cash': {
        providers: ['Physical Cash'],
        types: ['Cash on Hand', 'Piggy Bank', 'Safe', 'Other']
    },
    'investment': {
        providers: [
            'COL Financial', 'BPI Trade', 'First Metro Sec', 'Philstocks',
            'BDO Nomura', 'Binance', 'Coins.ph', 'PDAX', 'Crypto.com', 'Other'
        ],
        types: ['Stocks', 'Mutual Funds', 'UITF', 'Bonds', 'Cryptocurrency', 'Other']
    }
};

// Global state
let currentUser = null;
let selectedAccountType = null;
let editingAccountId = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
});

function initializeEventListeners() {
    const addAccountBtn = document.getElementById('add-account-button');
    const closeAddAccountBtn = document.getElementById('close-add-account');
    const cancelAddAccountBtn = document.getElementById('cancel-add-account');
    const backToTypeSelectionBtn = document.getElementById('back-to-type-selection');
    const addAccountModal = document.getElementById('add-account-modal');
    const addAccountForm = document.getElementById('add-account-form');
    const accountColorInput = document.getElementById('account-color');
    
    // Edit account modal elements
    const closeEditAccountBtn = document.getElementById('close-edit-account');
    const cancelEditAccountBtn = document.getElementById('cancel-edit-account');
    const editAccountModal = document.getElementById('edit-account-modal');
    const editAccountForm = document.getElementById('edit-account-form');

    // Add account modal handlers
    addAccountBtn.addEventListener('click', showAddAccountModal);
    closeAddAccountBtn.addEventListener('click', hideAddAccountModal);
    cancelAddAccountBtn.addEventListener('click', hideAddAccountModal);
    backToTypeSelectionBtn.addEventListener('click', showTypeSelection);
    
    // Edit account modal handlers
    closeEditAccountBtn.addEventListener('click', hideEditAccountModal);
    cancelEditAccountBtn.addEventListener('click', hideEditAccountModal);
    
    // Form submissions
    addAccountForm.addEventListener('submit', handleAddAccount);
    editAccountForm.addEventListener('submit', handleEditAccount);
    
    // Color picker handler
    accountColorInput.addEventListener('change', updateColorPreview);
    
    // Account type selection
    document.addEventListener('click', handleAccountTypeSelection);
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === addAccountModal) {
            hideAddAccountModal();
        }
        if (e.target === editAccountModal) {
            hideEditAccountModal();
        }
    });

    // Auth state listener
    onAuthStateChanged(auth, user => {
        console.log('Auth state changed in accounts.js:', user ? user.uid : 'null');
        if (user) {
            currentUser = user;
            loadAccounts(user.uid);
        } else {
            console.log('No user authenticated, redirecting to login');
            window.location.href = 'login.html';
        }
    });
}

function showAddAccountModal() {
    const modal = document.getElementById('add-account-modal');
    modal.style.display = 'flex';
    showTypeSelection();
}

function hideAddAccountModal() {
    const modal = document.getElementById('add-account-modal');
    modal.style.display = 'none';
    resetAddAccountForm();
}

function showEditAccountModal() {
    const modal = document.getElementById('edit-account-modal');
    modal.style.display = 'flex';
}

function hideEditAccountModal() {
    const modal = document.getElementById('edit-account-modal');
    modal.style.display = 'none';
    editingAccountId = null;
}

function showTypeSelection() {
    document.getElementById('account-type-selection').style.display = 'grid';
    document.getElementById('add-account-form').style.display = 'none';
    selectedAccountType = null;
    
    // Remove selected class from all cards
    document.querySelectorAll('.account-type-card').forEach(card => {
        card.classList.remove('selected');
    });
}

function handleAccountTypeSelection(e) {
    const card = e.target.closest('.account-type-card');
    if (!card) return;
    
    // Remove selected class from all cards
    document.querySelectorAll('.account-type-card').forEach(c => c.classList.remove('selected'));
    
    // Add selected class to clicked card
    card.classList.add('selected');
    
    // Get selected type
    selectedAccountType = card.dataset.type;
    
    // Show form after a short delay
    setTimeout(() => {
        showAccountForm();
    }, 300);
}

function showAccountForm() {
    if (!selectedAccountType) return;
    
    document.getElementById('account-type-selection').style.display = 'none';
    document.getElementById('add-account-form').style.display = 'block';
    
    // Populate provider and type options
    populateFormOptions();
}

function populateFormOptions() {
    const config = ACCOUNT_CONFIGS[selectedAccountType];
    const providerSelect = document.getElementById('account-provider');
    const typeSelect = document.getElementById('account-type-display');
    
    // Clear existing options
    providerSelect.innerHTML = '<option value="">-- Select Provider --</option>';
    typeSelect.innerHTML = '<option value="">-- Select Type --</option>';
    
    // Populate providers
    config.providers.forEach(provider => {
        const option = document.createElement('option');
        option.value = provider;
        option.textContent = provider;
        providerSelect.appendChild(option);
    });
    
    // Populate types
    config.types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeSelect.appendChild(option);
    });
    
    // Set default placeholder for account name
    const accountNameInput = document.getElementById('account-name');
    switch(selectedAccountType) {
        case 'traditional-bank':
            accountNameInput.placeholder = 'e.g., BPI Savings, Metrobank Credit Card';
            break;
        case 'digital-wallet':
            accountNameInput.placeholder = 'e.g., GCash Main, PayMaya';
            break;
        case 'cash':
            accountNameInput.placeholder = 'e.g., Wallet Cash, Emergency Fund';
            break;
        case 'investment':
            accountNameInput.placeholder = 'e.g., COL Stocks, Crypto Portfolio';
            break;
    }
}

function resetAddAccountForm() {
    document.getElementById('add-account-form').reset();
    selectedAccountType = null;
    document.getElementById('account-color').value = '#1a73e8';
    updateColorPreview();
    showTypeSelection();
}

function updateColorPreview() {
    const colorInput = document.getElementById('account-color');
    const colorPreview = document.querySelector('.color-preview');
    if (colorPreview) {
        colorPreview.style.background = colorInput.value;
    }
}

async function handleAddAccount(e) {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Adding...';

    try {
        if (!currentUser) {
            throw new Error('User not authenticated');
        }

        // Get form data
        const formData = {
            id: `acc_${Date.now()}`,
            name: document.getElementById('account-name').value.trim(),
            provider: document.getElementById('account-provider').value,
            accountType: document.getElementById('account-type-display').value,
            cardNumber: document.getElementById('account-number').value.trim(),
            balance: parseFloat(document.getElementById('account-balance').value) || 0,
            color: document.getElementById('account-color').value,
            notes: document.getElementById('account-notes').value.trim(),
            category: selectedAccountType,
            isActive: true,
            createdAt: new Date().toISOString()
        };

        // Validation
        if (!formData.name) {
            throw new Error('Account name is required');
        }
        if (!formData.provider) {
            throw new Error('Please select a provider');
        }
        if (!formData.accountType) {
            throw new Error('Please select an account type');
        }

        // Mask card number for display (keep only last 4 digits)
        if (formData.cardNumber && formData.cardNumber.length > 4) {
            formData.displayCardNumber = '*'.repeat(formData.cardNumber.length - 4) + formData.cardNumber.slice(-4);
        } else {
            formData.displayCardNumber = formData.cardNumber;
        }

        console.log('Adding account:', formData);

        // Store account in Firestore
        const result = await storeBankAccount(currentUser.uid, formData);
        
        if (result) {
            console.log('Account added successfully');
            hideAddAccountModal();
            loadAccounts(currentUser.uid); // Refresh accounts list
            
            // Show success message
            showSuccessMessage('Account added successfully!');
        } else {
            throw new Error('Failed to store account');
        }
        
    } catch (error) {
        console.error('Error adding account:', error);
        alert(`Failed to add account: ${error.message}`);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Add Account';
    }
}

async function handleEditAccount(e) {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Updating...';

    try {
        if (!currentUser || !editingAccountId) {
            throw new Error('Invalid edit state');
        }

        const updatedData = {
            name: document.getElementById('edit-account-name').value.trim(),
            balance: parseFloat(document.getElementById('edit-account-balance').value) || 0,
            color: document.getElementById('edit-account-color').value,
            notes: document.getElementById('edit-account-notes').value.trim(),
            updatedAt: new Date().toISOString()
        };

        console.log('Updating account:', editingAccountId, updatedData);

        const result = await updateBankAccount(currentUser.uid, editingAccountId, updatedData);
        
        if (result) {
            console.log('Account updated successfully');
            hideEditAccountModal();
            loadAccounts(currentUser.uid); // Refresh accounts list
            showSuccessMessage('Account updated successfully!');
        } else {
            throw new Error('Failed to update account');
        }
        
    } catch (error) {
        console.error('Error updating account:', error);
        alert(`Failed to update account: ${error.message}`);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Update Account';
    }
}

async function loadAccounts(userId) {
    const accountsGrid = document.getElementById('accounts-grid');
    const emptyState = document.getElementById('accounts-empty-state');
    const loadingState = document.getElementById('accounts-loading-state');
    
    // Show loading state
    loadingState.style.display = 'block';
    emptyState.style.display = 'none';
    accountsGrid.innerHTML = '';

    try {
        const accounts = await getUserBankAccounts(userId);
        loadingState.style.display = 'none';
        
        if (accounts.length === 0) {
            emptyState.style.display = 'block';
            updateSummaryCards([], 0);
        } else {
            emptyState.style.display = 'none';
            renderAccounts(accounts);
            updateSummaryCards(accounts, accounts.length);
        }
        
    } catch (error) {
        console.error('Failed to load accounts:', error);
        loadingState.style.display = 'none';
        accountsGrid.innerHTML = '<div class="error-message">Error loading accounts. Please try again.</div>';
        updateSummaryCards([], 0);
    }
}

function renderAccounts(accounts) {
    const accountsGrid = document.getElementById('accounts-grid');
    accountsGrid.innerHTML = '';

    accounts.forEach(account => {
        const accountCard = createAccountCard(account);
        accountsGrid.appendChild(accountCard);
    });
}

function createAccountCard(account) {
    const card = document.createElement('div');
    card.className = 'account-card';
    card.dataset.accountId = account.id;

    const cardNumber = account.displayCardNumber || account.cardNumber;
    const maskedNumber = cardNumber ? ` • ${cardNumber}` : '';
    
    card.innerHTML = `
        <div class="account-color-indicator" style="background-color: ${account.color}"></div>
        <div class="account-card-header">
            <div class="account-info">
                <div class="account-name">${account.name}</div>
                <div class="account-provider">${account.provider}${maskedNumber}</div>
                <div class="account-type">${account.accountType}</div>
            </div>
        </div>
        <div class="account-balance">₱${parseFloat(account.balance).toFixed(2)}</div>
        ${account.notes ? `<div class="account-notes">${account.notes}</div>` : ''}
        <div class="account-actions">
            <button class="edit-account-btn" data-id="${account.id}" title="Edit Account">
                <i class="fas fa-edit"></i>
            </button>
            <button class="delete-account-btn" data-id="${account.id}" title="Delete Account">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;

    // Add event listeners
    card.querySelector('.edit-account-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        editAccount(account);
    });

    card.querySelector('.delete-account-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteAccount(account.id, account.name);
    });

    return card;
}

function editAccount(account) {
    editingAccountId = account.id;
    
    // Populate edit form
    document.getElementById('edit-account-name').value = account.name;
    document.getElementById('edit-account-balance').value = account.balance;
    document.getElementById('edit-account-color').value = account.color;
    document.getElementById('edit-account-notes').value = account.notes || '';
    
    showEditAccountModal();
}

async function deleteAccount(accountId, accountName) {
    if (!confirm(`Are you sure you want to delete "${accountName}"? This action cannot be undone.`)) {
        return;
    }

    try {
        if (!currentUser) {
            throw new Error('User not authenticated');
        }

        // Delete from Firestore
        await deleteDoc(doc(db, "users", currentUser.uid, "bankAccounts", accountId));
        
        console.log('Account deleted successfully');
        loadAccounts(currentUser.uid); // Refresh accounts list
        showSuccessMessage('Account deleted successfully!');
        
    } catch (error) {
        console.error('Error deleting account:', error);
        alert(`Failed to delete account: ${error.message}`);
    }
}

function updateSummaryCards(accounts, totalAccounts) {
    // Calculate total balance
    const totalBalance = accounts.reduce((sum, account) => sum + parseFloat(account.balance || 0), 0);
    
    // Count digital wallets
    const digitalWallets = accounts.filter(account => account.category === 'digital-wallet').length;
    
    // Update summary cards
    document.getElementById('total-balance').textContent = `₱${totalBalance.toFixed(2)}`;
    document.getElementById('total-accounts').textContent = totalAccounts.toString();
    document.getElementById('digital-wallets').textContent = digitalWallets.toString();
}

function showSuccessMessage(message) {
    // Create temporary success message
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--primary-green);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// CSS animation for success message
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);
