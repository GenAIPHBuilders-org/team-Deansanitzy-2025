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
let currentAccounts = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    initializeCharacterCounters();
    initializeColorPresets();
    initializeFilters();
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
    
    // Form validation
    addAccountForm.addEventListener('input', handleFormValidation);
    editAccountForm.addEventListener('input', handleEditFormValidation);
    
    // Close modal when clicking backdrop
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) {
            if (e.target.closest('#add-account-modal')) {
                hideAddAccountModal();
            }
            if (e.target.closest('#edit-account-modal')) {
                hideEditAccountModal();
            }
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (addAccountModal.style.display === 'flex') {
                hideAddAccountModal();
            }
            if (editAccountModal.style.display === 'flex') {
                hideEditAccountModal();
            }
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

function initializeCharacterCounters() {
    const notesTextarea = document.getElementById('account-notes');
    const editNotesTextarea = document.getElementById('edit-account-notes');
    const notesCounter = document.getElementById('notes-char-count');
    const editNotesCounter = document.getElementById('edit-notes-char-count');

    if (notesTextarea && notesCounter) {
        notesTextarea.addEventListener('input', () => {
            const count = notesTextarea.value.length;
            notesCounter.textContent = count;
            notesCounter.style.color = count > 450 ? '#ff6b6b' : 'rgba(255, 255, 255, 0.5)';
        });
    }

    if (editNotesTextarea && editNotesCounter) {
        editNotesTextarea.addEventListener('input', () => {
            const count = editNotesTextarea.value.length;
            editNotesCounter.textContent = count;
            editNotesCounter.style.color = count > 450 ? '#ff6b6b' : 'rgba(255, 255, 255, 0.5)';
        });
    }
}

function initializeColorPresets() {
    const colorPresets = document.querySelectorAll('.color-preset');
    const colorInput = document.getElementById('account-color');

    colorPresets.forEach(preset => {
        preset.addEventListener('click', () => {
            const color = preset.dataset.color;
            colorInput.value = color;
            updateColorPreview();
            
            // Update preset selection
            colorPresets.forEach(p => p.classList.remove('selected'));
            preset.classList.add('selected');
        });
    });
}

function initializeFilters() {
    const filterButtons = document.querySelectorAll('.quick-action-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filter = button.dataset.filter;
            setActiveFilter(filter);
            filterAccounts(filter);
        });
    });
}

function setActiveFilter(filter) {
    currentFilter = filter;
    const filterButtons = document.querySelectorAll('.quick-action-btn');
    
    filterButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.filter === filter);
    });
}

function filterAccounts(filter) {
    let filteredAccounts = currentAccounts;
    
    if (filter !== 'all') {
        filteredAccounts = currentAccounts.filter(account => account.category === filter);
    }
    
    renderAccounts(filteredAccounts);
    updateFilteredSummary(filteredAccounts);
}

function updateFilteredSummary(accounts) {
    const totalBalance = accounts.reduce((sum, account) => sum + parseFloat(account.balance || 0), 0);
    const digitalWallets = accounts.filter(account => account.category === 'digital-wallet').length;
    
    document.getElementById('total-balance').textContent = `₱${totalBalance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('total-accounts').textContent = accounts.length.toString();
    document.getElementById('digital-wallets').textContent = digitalWallets.toString();
}

function showAddAccountModal() {
    const modal = document.getElementById('add-account-modal');
    modal.style.display = 'flex';
    showTypeSelection();
    
    // Focus management
    setTimeout(() => {
        const firstCard = document.querySelector('.account-type-card');
        if (firstCard) firstCard.focus();
    }, 100);
}

function hideAddAccountModal() {
    const modal = document.getElementById('add-account-modal');
    modal.style.display = 'none';
    resetAddAccountForm();
}

function showEditAccountModal() {
    const modal = document.getElementById('edit-account-modal');
    modal.style.display = 'flex';
    
    // Focus management
    setTimeout(() => {
        document.getElementById('edit-account-name').focus();
    }, 100);
}

function hideEditAccountModal() {
    const modal = document.getElementById('edit-account-modal');
    modal.style.display = 'none';
    editingAccountId = null;
    clearValidationErrors('edit-account-form');
}

function showTypeSelection() {
    document.getElementById('account-type-selection').style.display = 'grid';
    document.getElementById('add-account-form').style.display = 'none';
    selectedAccountType = null;
    
    // Update progress indicator
    updateProgressIndicator(1);
    
    // Remove selected class from all cards
    document.querySelectorAll('.account-type-card').forEach(card => {
        card.classList.remove('selected');
    });
}

function updateProgressIndicator(step) {
    const steps = document.querySelectorAll('.progress-step');
    steps.forEach((stepEl, index) => {
        stepEl.classList.toggle('active', index + 1 === step);
    });
}

function handleAccountTypeSelection(e) {
    const card = e.target.closest('.account-type-card');
    if (!card) return;
    
    // Remove selected class from all cards
    document.querySelectorAll('.account-type-card').forEach(c => c.classList.remove('selected'));
    
    // Add selected class to clicked card with animation
    card.classList.add('selected');
    
    // Get selected type
    selectedAccountType = card.dataset.type;
    
    // Show form after a short delay for smooth transition
    setTimeout(() => {
        showAccountForm();
    }, 300);
}

function showAccountForm() {
    if (!selectedAccountType) return;
    
    document.getElementById('account-type-selection').style.display = 'none';
    document.getElementById('add-account-form').style.display = 'block';
    
    // Update progress indicator
    updateProgressIndicator(2);
    
    // Populate provider and type options
    populateFormOptions();
    
    // Focus on first input
    setTimeout(() => {
        document.getElementById('account-name').focus();
    }, 100);
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
    const form = document.getElementById('add-account-form');
    form.reset();
    selectedAccountType = null;
    document.getElementById('account-color').value = '#10df6f';
    updateColorPreview();
    clearValidationErrors('add-account-form');
    showTypeSelection();
    
    // Reset character counter
    const notesCounter = document.getElementById('notes-char-count');
    if (notesCounter) notesCounter.textContent = '0';
}

function updateColorPreview() {
    const colorInput = document.getElementById('account-color') || document.getElementById('edit-account-color');
    const colorPreviews = document.querySelectorAll('.color-preview');
    
    if (colorInput && colorPreviews.length > 0) {
        const color = colorInput.value;
        colorPreviews.forEach(preview => {
            preview.style.background = color;
        });
        
        // Update CSS custom property for previews
        document.documentElement.style.setProperty('--selected-color', color);
    }
}

function handleFormValidation(e) {
    const field = e.target;
    validateField(field);
}

function handleEditFormValidation(e) {
    const field = e.target;
    validateField(field, 'edit-');
}

function validateField(field, prefix = '') {
    const fieldName = field.id.replace(prefix, '').replace('account-', '').replace('edit-', '');
    const errorElement = document.getElementById(`${prefix}account-${fieldName}-error`);
    
    if (!errorElement) return;
    
    let isValid = true;
    let errorMessage = '';
    
    // Remove existing validation classes
    field.classList.remove('error', 'success');
    
    switch (fieldName) {
        case 'name':
            if (!field.value.trim()) {
                isValid = false;
                errorMessage = 'Account name is required';
            } else if (field.value.trim().length < 2) {
                isValid = false;
                errorMessage = 'Account name must be at least 2 characters';
            } else if (field.value.trim().length > 50) {
                isValid = false;
                errorMessage = 'Account name must not exceed 50 characters';
            }
            break;
            
        case 'provider':
            if (!field.value) {
                isValid = false;
                errorMessage = 'Please select a provider';
            }
            break;
            
        case 'type-display':
            if (!field.value) {
                isValid = false;
                errorMessage = 'Please select an account type';
            }
            break;
            
        case 'balance':
            const balance = parseFloat(field.value);
            if (isNaN(balance)) {
                isValid = false;
                errorMessage = 'Please enter a valid balance';
            } else if (balance < 0) {
                isValid = false;
                errorMessage = 'Balance cannot be negative';
            } else if (balance > 999999999) {
                isValid = false;
                errorMessage = 'Balance is too large';
            }
            break;
    }
    
    // Update field appearance and error message
    if (isValid) {
        field.classList.add('success');
        errorElement.textContent = '';
    } else {
        field.classList.add('error');
        errorElement.textContent = errorMessage;
    }
    
    return isValid;
}

function validateForm(formId) {
    const form = document.getElementById(formId);
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        const fieldValid = validateField(field, formId.includes('edit') ? 'edit-' : '');
        if (!fieldValid) isValid = false;
    });
    
    return isValid;
}

function clearValidationErrors(formId) {
    const form = document.getElementById(formId);
    const errorElements = form.querySelectorAll('.form-validation-message');
    const inputElements = form.querySelectorAll('input, select');
    
    errorElements.forEach(el => el.textContent = '');
    inputElements.forEach(el => el.classList.remove('error', 'success'));
}

async function handleAddAccount(e) {
    e.preventDefault();
    
    console.log('🚀 Add Account form submitted');
    
    // Validate form
    if (!validateForm('add-account-form')) {
        console.warn('⚠️ Form validation failed');
        showToast('Please fix the errors in the form', 'error');
        return;
    }
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const buttonText = submitButton.querySelector('.button-text');
    const buttonLoader = submitButton.querySelector('.button-loader');
    
    // Show loading state
    submitButton.disabled = true;
    buttonText.style.display = 'none';
    buttonLoader.style.display = 'inline-flex';

    try {
        if (!currentUser) {
            console.error('❌ No user authenticated');
            throw new Error('User not authenticated - please log in again');
        }
        
        console.log('✅ User authenticated:', currentUser.uid);

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

        // Validate required fields before proceeding
        if (!selectedAccountType) {
            throw new Error('Please select an account type');
        }
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

        console.log('📋 Form data prepared:', {
            id: formData.id,
            name: formData.name,
            provider: formData.provider,
            accountType: formData.accountType,
            category: formData.category,
            balance: formData.balance,
            hasCardNumber: !!formData.cardNumber,
            hasNotes: !!formData.notes
        });

        // Store account in Firestore
        const result = await storeBankAccount(currentUser.uid, formData);
        
        if (result && result.success) {
            console.log('✅ Account added successfully:', result);
            hideAddAccountModal();
            await loadAccounts(currentUser.uid); // Refresh accounts list
            
            showToast(`Account "${formData.name}" added successfully!`, 'success');
            
            // Log successful addition for client-side tracking
            console.log('📊 CLIENT LOG - Account Added:', {
                accountId: result.accountId,
                accountName: formData.name,
                provider: formData.provider,
                balance: formData.balance,
                timestamp: result.timestamp,
                userId: currentUser.uid
            });
            
            // Notify other pages/components about account addition
            notifyAccountUpdate('added', formData);
            
        } else {
            throw new Error('Failed to store account - invalid response');
        }
        
    } catch (error) {
        console.error('Error adding account:', error);
        showToast(`Failed to add account: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
        buttonText.style.display = 'inline';
        buttonLoader.style.display = 'none';
    }
}

async function handleEditAccount(e) {
    e.preventDefault();
    
    // Validate form
    if (!validateForm('edit-account-form')) {
        showToast('Please fix the errors in the form', 'error');
        return;
    }
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const buttonText = submitButton.querySelector('.button-text');
    const buttonLoader = submitButton.querySelector('.button-loader');
    
    // Show loading state
    submitButton.disabled = true;
    buttonText.style.display = 'none';
    buttonLoader.style.display = 'inline-flex';

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
            await loadAccounts(currentUser.uid); // Refresh accounts list
            showToast(`Account "${updatedData.name}" updated successfully!`, 'success');
            
            // Notify other pages/components about account update
            notifyAccountUpdate('updated', updatedData);
        } else {
            throw new Error('Failed to update account');
        }
        
    } catch (error) {
        console.error('Error updating account:', error);
        showToast(`Failed to update account: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
        buttonText.style.display = 'inline';
        buttonLoader.style.display = 'none';
    }
}

async function loadAccounts(userId) {
    const accountsGrid = document.getElementById('accounts-grid');
    const emptyState = document.getElementById('accounts-empty-state');
    const loadingState = document.getElementById('accounts-loading-state');
    const errorState = document.getElementById('accounts-error-state');
    
    // Show loading state
    loadingState.style.display = 'block';
    emptyState.style.display = 'none';
    errorState.style.display = 'none';
    accountsGrid.innerHTML = '';

    try {
        const accounts = await getUserBankAccounts(userId);
        loadingState.style.display = 'none';
        
        // Store accounts in global state
        currentAccounts = accounts;
        
        if (accounts.length === 0) {
            emptyState.style.display = 'block';
            updateSummaryCards([], 0);
        } else {
            emptyState.style.display = 'none';
            filterAccounts(currentFilter); // Apply current filter
            updateSummaryCards(accounts, accounts.length);
        }
        
    } catch (error) {
        console.error('Failed to load accounts:', error);
        loadingState.style.display = 'none';
        errorState.style.display = 'block';
        updateSummaryCards([], 0);
        showToast('Failed to load accounts. Please check your connection.', 'error');
    }
}

function renderAccounts(accounts) {
    const accountsGrid = document.getElementById('accounts-grid');
    accountsGrid.innerHTML = '';

    if (accounts.length === 0 && currentFilter !== 'all') {
        // Show filter-specific empty state
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'filter-empty-state';
        emptyMessage.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: rgba(255, 255, 255, 0.6);">
                <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <h3>No accounts found</h3>
                <p>No accounts match the current filter.</p>
                <button class="secondary-button" onclick="document.querySelector('[data-filter=all]').click()">
                    Show All Accounts
                </button>
            </div>
        `;
        accountsGrid.appendChild(emptyMessage);
        return;
    }

    accounts.forEach(account => {
        const accountCard = createAccountCard(account);
        accountsGrid.appendChild(accountCard);
    });
}

function createAccountCard(account) {
    const card = document.createElement('div');
    card.className = 'account-card';
    card.dataset.accountId = account.id;
    card.style.setProperty('--account-color', account.color);

    const cardNumber = account.displayCardNumber || account.cardNumber;
    const maskedNumber = cardNumber ? ` • ${cardNumber}` : '';
    const formattedBalance = parseFloat(account.balance).toLocaleString('en-PH', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
    
    card.innerHTML = `
        <div class="account-color-indicator" style="background-color: ${account.color}"></div>
        <div class="account-card-header">
            <div class="account-info">
                <div class="account-name">${account.name}</div>
                <div class="account-provider">${account.provider}${maskedNumber}</div>
                <div class="account-type">${account.accountType}</div>
            </div>
        </div>
        <div class="account-balance">₱${formattedBalance}</div>
        ${account.notes ? `<div class="account-notes">${account.notes}</div>` : ''}
        <div class="account-actions">
            <button class="edit-account-btn" data-id="${account.id}" title="Edit Account" aria-label="Edit ${account.name}">
                <i class="fas fa-edit"></i>
            </button>
            <button class="delete-account-btn" data-id="${account.id}" title="Delete Account" aria-label="Delete ${account.name}">
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

    // Add hover effect for account color
    card.addEventListener('mouseenter', () => {
        card.style.borderColor = account.color;
    });

    card.addEventListener('mouseleave', () => {
        card.style.borderColor = '';
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
    
    // Update character counter
    const editNotesCounter = document.getElementById('edit-notes-char-count');
    if (editNotesCounter) {
        editNotesCounter.textContent = (account.notes || '').length;
    }
    
    // Update color preview
    updateColorPreview();
    
    showEditAccountModal();
}

async function deleteAccount(accountId, accountName) {
    // Enhanced confirmation dialog
    const confirmed = await showConfirmDialog(
        'Delete Account',
        `Are you sure you want to delete "${accountName}"?`,
        'This action cannot be undone and will permanently remove all data associated with this account.',
        'Delete',
        'danger'
    );
    
    if (!confirmed) return;

    try {
        if (!currentUser) {
            throw new Error('User not authenticated');
        }

        // Show loading toast
        showToast('Deleting account...', 'info');

        // Delete from Firestore
        await deleteDoc(doc(db, "users", currentUser.uid, "bankAccounts", accountId));
        
        console.log('Account deleted successfully');
        await loadAccounts(currentUser.uid); // Refresh accounts list
        showToast(`Account "${accountName}" deleted successfully!`, 'success');
        
        // Notify other pages/components about account deletion
        notifyAccountUpdate('deleted', { id: accountId, name: accountName });
        
    } catch (error) {
        console.error('Error deleting account:', error);
        showToast(`Failed to delete account: ${error.message}`, 'error');
    }
}

function updateSummaryCards(accounts, totalAccounts) {
    // Calculate total balance
    const totalBalance = accounts.reduce((sum, account) => sum + parseFloat(account.balance || 0), 0);
    
    // Count digital wallets
    const digitalWallets = accounts.filter(account => account.category === 'digital-wallet').length;
    
    // Format numbers with proper locale
    const formattedBalance = totalBalance.toLocaleString('en-PH', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
    
    // Update summary cards with animation
    animateNumberChange('total-balance', `₱${formattedBalance}`);
    animateNumberChange('total-accounts', totalAccounts.toString());
    animateNumberChange('digital-wallets', digitalWallets.toString());
}

function animateNumberChange(elementId, newValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const currentValue = element.textContent;
    if (currentValue === newValue) return;
    
    element.style.transform = 'scale(1.1)';
    element.style.transition = 'transform 0.3s ease';
    
    setTimeout(() => {
        element.textContent = newValue;
        element.style.transform = 'scale(1)';
    }, 150);
}

function showToast(message, type = 'info', duration = 5000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = getToastIcon(type);
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" aria-label="Close notification">×</button>
    `;
    
    // Add toast styles
    toast.style.cssText = `
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem 1.25rem;
        background: ${type === 'danger' ? 'var(--error)' : 'var(--primary)'};
        color: white;
        border-radius: 12px;
        border-left: 4px solid ${getToastBorderColor(type)};
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        max-width: 400px;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
    `;
    
    // Add close functionality
    const closeButton = toast.querySelector('.toast-close');
    closeButton.style.cssText = `
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0;
        margin-left: auto;
        opacity: 0.7;
        transition: opacity 0.3s ease;
    `;
    
    closeButton.addEventListener('click', () => removeToast(toast));
    closeButton.addEventListener('mouseenter', () => closeButton.style.opacity = '1');
    closeButton.addEventListener('mouseleave', () => closeButton.style.opacity = '0.7');
    
    toastContainer.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    });
    
    // Auto remove
    const autoRemoveTimer = setTimeout(() => removeToast(toast), duration);
    
    // Store timer reference to clear if manually closed
    toast.autoRemoveTimer = autoRemoveTimer;
}

function getToastIcon(type) {
    switch (type) {
        case 'success': return '<i class="fas fa-check-circle"></i>';
        case 'error': return '<i class="fas fa-exclamation-circle"></i>';
        case 'warning': return '<i class="fas fa-exclamation-triangle"></i>';
        case 'info': 
        default: return '<i class="fas fa-info-circle"></i>';
    }
}

function getToastBackground(type) {
    switch (type) {
        case 'success': return 'linear-gradient(135deg, rgba(16, 223, 111, 0.9), rgba(16, 223, 111, 0.8))';
        case 'error': return 'linear-gradient(135deg, rgba(233, 109, 31, 0.9), rgba(233, 109, 31, 0.8))';
        case 'warning': return 'linear-gradient(135deg, rgba(255, 193, 7, 0.9), rgba(255, 193, 7, 0.8))';
        case 'info':
        default: return 'linear-gradient(135deg, rgba(16, 223, 111, 0.9), rgba(16, 223, 111, 0.8))';
    }
}

function getToastBorderColor(type) {
    switch (type) {
        case 'success': return '#10df6f';
        case 'error': return '#e96d1f';
        case 'warning': return '#ffc107';
        case 'info':
        default: return '#10df6f';
    }
}

function removeToast(toast) {
    if (toast.autoRemoveTimer) {
        clearTimeout(toast.autoRemoveTimer);
    }
    
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

// Cross-page communication system
function notifyAccountUpdate(action, accountData) {
    try {
        console.log('📢 Notifying account update:', action, accountData);
        
        // Dispatch custom event for same-page components
        const event = new CustomEvent('accountUpdated', {
            detail: { action, accountData, timestamp: new Date().toISOString() }
        });
        document.dispatchEvent(event);
        
        // Store in sessionStorage for cross-page communication
        const notification = {
            action,
            accountData,
            timestamp: new Date().toISOString(),
            id: `account_update_${Date.now()}`
        };
        
        // Get existing notifications or create new array
        const existingNotifications = JSON.parse(sessionStorage.getItem('accountUpdates') || '[]');
        existingNotifications.push(notification);
        
        // Keep only recent notifications (last 10)
        if (existingNotifications.length > 10) {
            existingNotifications.splice(0, existingNotifications.length - 10);
        }
        
        sessionStorage.setItem('accountUpdates', JSON.stringify(existingNotifications));
        
        // Try to refresh transaction accounts if function exists
        if (typeof window.refreshTransactionAccounts === 'function') {
            console.log('🔄 Refreshing transaction accounts dropdown');
            window.refreshTransactionAccounts();
        }
        
        // Post message to other windows/tabs
        if (window.BroadcastChannel) {
            const channel = new BroadcastChannel('account-updates');
            channel.postMessage(notification);
            channel.close();
        }
        
        console.log('✅ Account update notification sent');
        
    } catch (error) {
        console.error('❌ Error notifying account update:', error);
    }
}

function showConfirmDialog(title, message, details, confirmText = 'Confirm', type = 'warning') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(5px);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: modalFadeIn 0.3s ease;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: linear-gradient(135deg, rgba(6, 14, 33, 0.98), rgba(6, 14, 33, 0.95));
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 2rem;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            animation: modalSlideIn 0.3s ease;
        `;
        
        const iconClass = type === 'danger' ? 'fa-exclamation-triangle' : 'fa-question-circle';
        const iconColor = type === 'danger' ? '#e96d1f' : '#ffc107';
        
        dialog.innerHTML = `
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <i class="fas ${iconClass}" style="font-size: 3rem; color: ${iconColor}; margin-bottom: 1rem;"></i>
                <h3 style="margin: 0 0 1rem 0; color: white;">${title}</h3>
                <p style="margin: 0 0 0.5rem 0; color: rgba(255, 255, 255, 0.9);">${message}</p>
                ${details ? `<p style="margin: 0; color: rgba(255, 255, 255, 0.6); font-size: 0.9rem;">${details}</p>` : ''}
            </div>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button class="cancel-btn" style="
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                ">Cancel</button>
                <button class="confirm-btn" style="
                    background: ${type === 'danger' ? '#e96d1f' : 'var(--primary-green)'};
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                ">${confirmText}</button>
            </div>
        `;
        
        const cancelBtn = dialog.querySelector('.cancel-btn');
        const confirmBtn = dialog.querySelector('.confirm-btn');
        
        // Add hover effects
        [cancelBtn, confirmBtn].forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'translateY(-1px)';
                btn.style.opacity = '0.9';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translateY(0)';
                btn.style.opacity = '1';
            });
        });
        
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(false);
        });
        
        confirmBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(true);
        });
        
        // Close on backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                resolve(false);
            }
        });
        
        // Close on Escape key
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', handleKeydown);
                resolve(false);
            }
        };
        document.addEventListener('keydown', handleKeydown);
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // Focus confirm button for accessibility
        setTimeout(() => confirmBtn.focus(), 100);
    });
}

// Toast notifications use styles from accounts.css and theme.css
