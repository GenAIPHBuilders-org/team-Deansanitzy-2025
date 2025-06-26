import { 
    auth,
    getUserTransactions, 
    storeTransaction, 
    deleteTransaction,
    getUserBankAccounts,
    getUserData,
    updateTransaction
} from "./firestoredb.js";

let currentUser = null;

// Initialize DOM elements
const addTransactionBtn = document.getElementById('add-transaction-button');
const addTransactionBtn2 = document.getElementById('add-transaction-btn');
const closeModalBtn = document.querySelector('.modal-close-btn');
const cancelModalBtn = document.querySelector('.cancel-button');
const modal = document.getElementById('add-transaction-modal');
const addTransactionForm = document.getElementById('add-transaction-form');
const filterButton = document.getElementById('filter-button');
const closeFilterBtn = document.getElementById('close-filter');
const filterPanel = document.getElementById('filter-panel');

// Modal Functions
const showModal = () => {
    if (modal) {
        modal.style.display = 'flex';
    }
};

const hideModal = () => {
    if (modal) {
        modal.style.display = 'none';
        if (addTransactionForm) {
            addTransactionForm.reset();
            addTransactionForm.dataset.editMode = 'false';
            delete addTransactionForm.dataset.transactionId;
            
            // Reset modal title and button text
            const modalTitle = document.querySelector('.modal-header h2');
            if (modalTitle) {
                modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Add Transaction';
            }
            
            const submitButton = document.querySelector('.modal-actions .action-button');
            if (submitButton) {
                submitButton.innerHTML = '<i class="fas fa-plus"></i> Add Transaction';
            }
        }
    }
};

// Filter panel functions
const toggleFilterPanel = () => {
    if (filterPanel) {
        filterPanel.classList.toggle('show');
    }
};

// Function to initialize event listeners
function initializeEventListeners() {
    // Add transaction buttons
    if (addTransactionBtn) {
        addTransactionBtn.addEventListener('click', showModal);
    }
    if (addTransactionBtn2) {
        addTransactionBtn2.addEventListener('click', showModal);
    }
    
    // Modal close buttons
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', hideModal);
    }
    if (cancelModalBtn) {
        cancelModalBtn.addEventListener('click', hideModal);
    }
    
    // Modal outside click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal();
            }
        });
    }
    
    // Filter panel buttons
    if (filterButton) {
        filterButton.addEventListener('click', toggleFilterPanel);
    }
    if (closeFilterBtn) {
        closeFilterBtn.addEventListener('click', toggleFilterPanel);
    }
    
    // Form submission
    if (addTransactionForm) {
        addTransactionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = addTransactionForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            }
            
            try {
                const formData = new FormData(addTransactionForm);
                const transactionData = {
                    type: formData.get('type'),
                    amount: parseFloat(formData.get('amount')),
                    name: formData.get('description'),
                    category: formData.get('category'),
                    accountId: formData.get('account'),
                    date: formData.get('date'),
                    notes: formData.get('notes'),
                    id: addTransactionForm.dataset.editMode === 'true' ? 
                        addTransactionForm.dataset.transactionId : 
                        generateTransactionId()
                };
                
                const user = auth.currentUser;
                if (!user) {
                    throw new Error('User not authenticated');
                }
                
                if (addTransactionForm.dataset.editMode === 'true') {
                    await updateTransaction(user.uid, transactionData.id, transactionData);
                    showToast('Transaction updated successfully', 'success');
                } else {
                    await storeTransaction(user.uid, transactionData);
                    showToast('Transaction added successfully', 'success');
                }
                
                hideModal();
                loadTransactions(user.uid);
                
            } catch (error) {
                console.error('❌ Failed to save transaction:', error);
                showToast(error.message || 'Failed to save transaction', 'error');
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.innerHTML = '<i class="fas fa-plus"></i> Add Transaction';
                }
            }
        });
    }
}

// Function to populate categories based on transaction type
function populateCategories() {
    const transactionType = document.getElementById('transaction-type').value;
    const categorySelect = document.getElementById('transaction-category');
    
    const expenseCategories = [
        'Food', 'Shopping', 'Bills', 'Transportation', 
        'Entertainment', 'Housing', 'Health', 'Education', 'Other'
    ];
    const incomeCategories = [
        'Salary', 'Freelance', 'Investments', 'Gifts', 'Other'
    ];

    categorySelect.innerHTML = ''; // Clear existing options

    const categories = transactionType === 'income' ? incomeCategories : expenseCategories;

    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.toLowerCase();
        option.textContent = category;
        categorySelect.appendChild(option);
    });
}

// Add event listener for transaction type change
const transactionTypeSelect = document.getElementById('transaction-type');
if (transactionTypeSelect) {
    transactionTypeSelect.addEventListener('change', populateCategories);
}

// Helper function to generate transaction ID
function generateTransactionId() {
    return 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Initialize auth state listener
console.log('🔐 Setting up auth state listener...');

// Wait for auth state to be ready before proceeding
async function initializeAuth() {
    return new Promise((resolve, reject) => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            console.log('🔄 Auth state changed:', user ? `User ${user.uid} logged in` : 'No user');
            unsubscribe();
            resolve(user);
        });

        // Set a timeout to prevent infinite waiting
        setTimeout(() => {
            unsubscribe();
            reject(new Error('Auth initialization timeout'));
        }, 10000);
    });
}

// Initialize the page
async function initializePage() {
    console.log('🚀 DOM Content Loaded');
    try {
        // Wait for auth to be ready
        const user = await initializeAuth();
        
        if (user) {
            currentUser = user;
            console.log('✅ Loading transactions for user:', user.uid);
            await loadTransactions(user.uid);
            
            // Also load bank accounts
            await loadBankAccounts(user.uid);
            
            // Initialize event listeners after auth is ready
            initializeEventListeners();
            populateCategories(); // Initial population
        } else {
            console.log('❌ No authenticated user, redirecting to login...');
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('❌ Error during initialization:', error);
        showGeneralError('Failed to initialize page. Please refresh and try again.');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePage);

// Handle successful scan
const handleScanComplete = (scanData) => {
    try {
        console.log('📄 Scan completed:', scanData);
        showModal();
        populateFormWithScanData(scanData);
        showToast('Receipt scanned successfully', 'success');
    } catch (error) {
        console.error('❌ Error processing scan data:', error);
        showToast('Failed to process scanned receipt', 'error');
    }
};

// Handle scan error
const handleScanError = (error) => {
    console.error('❌ Scan error:', error);
    showToast(error.message || 'Failed to scan receipt', 'error');
};

async function initializeTransactionsModule(user) {
    try {
        if (!user || !user.uid) {
            console.error('❌ Cannot initialize transactions module: Invalid user');
            return;
        }
        
        console.log('🚀 Initializing transactions module for user:', user.uid);
        
        // Ensure currentUser is set
        currentUser = user;
        
        // Load data with error handling
        await Promise.all([
            loadTransactions(user.uid).catch(err => {
                console.error('❌ Failed to load transactions:', err);
                showTransactionError('Failed to load transactions');
            }),
            loadBankAccounts(user.uid).catch(err => {
                console.error('❌ Failed to load bank accounts:', err);
                showAccountLoadError();
            })
        ]);
        
        // Setup form submission handler
        setupTransactionFormHandler(user);
        
        console.log('✅ Transactions module initialized successfully');
        
    } catch (error) {
        console.error('❌ Failed to initialize transactions module:', error);
        showGeneralError('Failed to initialize page');
    }
}

function setupTransactionFormHandler(user) {
    if (!user || !user.uid) {
        console.error('❌ Cannot setup form handler: No valid user provided');
        return;
    }
    
    console.log('🔧 Setting up form handler for user:', user.uid);
    
    // Remove any existing event listeners to prevent duplicates
    const existingHandler = addTransactionForm._submitHandler;
    if (existingHandler) {
        addTransactionForm.removeEventListener('submit', existingHandler);
    }
    
    // Create new handler and store reference
    const submitHandler = (e) => {
        console.log('📝 Form submitted, setup user:', user.uid);
        console.log('📝 Current global user:', currentUser ? currentUser.uid : 'null');
        console.log('📝 Auth current user:', auth.currentUser ? auth.currentUser.uid : 'null');
        
        // Use the most reliable user reference available
        const userToUse = currentUser || auth.currentUser || user;
        if (!userToUse || !userToUse.uid) {
            console.error('❌ No authenticated user found in form handler');
            alert('Please log in to add transactions');
            return;
        }
        handleAddTransaction(e, userToUse.uid);
    };
    
    // Store reference for potential cleanup
    addTransactionForm._submitHandler = submitHandler;
    addTransactionForm.addEventListener('submit', submitHandler);
    
    console.log('✅ Transaction form handler setup complete for user:', user.uid);
}

async function loadBankAccounts(userId) {
    console.log('🏦 Loading bank accounts for userId:', userId);
    
    const accountSelect = document.getElementById('transaction-account');
    if (!accountSelect) {
        console.error('❌ Account select element not found');
        return;
    }
    
    // Show loading state
    accountSelect.innerHTML = '<option value="">-- Loading Accounts --</option>';
    accountSelect.disabled = true;
    
    try {
        if (!userId) {
            throw new Error('No userId provided for loadBankAccounts');
        }
        
        console.log('📞 Calling getUserBankAccounts from firestoredb...');
        const accounts = await getUserBankAccounts(userId);
        console.log('📊 Received accounts from firestoredb:', accounts?.length || 0);
        
        // Re-enable the select
        accountSelect.disabled = false;
        
        // Always provide basic options first
        accountSelect.innerHTML = `
            <option value="">-- Select Account --</option>
            <option value="no-account">💳 I don't have a bank account yet</option>
            <option value="cash">💵 Cash</option>
        `;
        
        if (accounts && accounts.length > 0) {
            console.log('✅ Processing accounts for dropdown...');
            
            // Group accounts by category for better organization
            const groupedAccounts = {
                'traditional-bank': [],
                'digital-wallet': [],
                'cash': [],
                'investment': [],
                'other': []
            };
            
            accounts.forEach(acc => {
                const category = acc.category || 'other';
                if (groupedAccounts[category]) {
                    groupedAccounts[category].push(acc);
                } else {
                    groupedAccounts['other'].push(acc);
                }
            });
            
            // Add accounts by category with proper formatting
            const categories = [
                { key: 'traditional-bank', label: '🏦 Traditional Banks' },
                { key: 'digital-wallet', label: '📱 Digital Wallets' },
                { key: 'cash', label: '💵 Cash Accounts' },
                { key: 'investment', label: '📈 Investment Accounts' },
                { key: 'other', label: '📋 Other Accounts' }
            ];
            
            categories.forEach(category => {
                const categoryAccounts = groupedAccounts[category.key];
                if (categoryAccounts.length > 0) {
                    // Add category separator
                    const separator = document.createElement('option');
                    separator.disabled = true;
                    separator.textContent = `--- ${category.label} ---`;
                    separator.style.fontWeight = 'bold';
                    separator.style.backgroundColor = 'rgba(26, 115, 232, 0.1)';
                    accountSelect.appendChild(separator);
                    
                    // Add accounts in this category
                    categoryAccounts.forEach(acc => {
                        const option = document.createElement('option');
                        option.value = acc.id;
                        
                        // Store account metadata for transaction processing
                        option.dataset.accountName = acc.name;
                        option.dataset.provider = acc.provider;
                        option.dataset.balance = acc.balance;
                        option.dataset.category = acc.category;
                        
                        // Format display text with consistent structure
                        const displayName = acc.name || 'Unknown Account';
                        const provider = acc.provider && acc.provider !== acc.name ? ` (${acc.provider})` : '';
                        const cardNumber = acc.displayCardNumber || acc.cardNumber;
                        const lastFour = cardNumber ? ` • ${cardNumber}` : '';
                        const balance = ` • ₱${parseFloat(acc.balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        
                        option.textContent = `${displayName}${provider}${lastFour}${balance}`;
                        accountSelect.appendChild(option);
                    });
                }
            });
            
            // Add separator before action items
            const actionSeparator = document.createElement('option');
            actionSeparator.disabled = true;
            actionSeparator.textContent = '―――――――――――――';
            accountSelect.appendChild(actionSeparator);
            
            // Add link to add more accounts
            const addAccountOption = document.createElement('option');
            addAccountOption.value = 'add-account';
            addAccountOption.textContent = '➕ Add New Account';
            addAccountOption.style.color = 'var(--primary)';
            addAccountOption.style.fontWeight = 'bold';
            accountSelect.appendChild(addAccountOption);
            
            console.log('✅ Account dropdown populated successfully');
        } else {
            console.log('ℹ️ No accounts found, showing default options only');
            
            // Add helpful message when no accounts exist
            const noAccountsOption = document.createElement('option');
            noAccountsOption.disabled = true;
            noAccountsOption.textContent = '-- No accounts added yet --';
            noAccountsOption.style.color = 'rgba(255, 255, 255, 0.5)';
            accountSelect.appendChild(noAccountsOption);
            
            const addAccountOption = document.createElement('option');
            addAccountOption.value = 'add-account';
            addAccountOption.textContent = '➕ Add Your First Account';
            addAccountOption.style.color = 'var(--primary)';
            addAccountOption.style.fontWeight = 'bold';
            accountSelect.appendChild(addAccountOption);
        }
        
    } catch (error) {
        console.error('❌ Error loading bank accounts:', error);
        
        // Re-enable the select and show error state
        accountSelect.disabled = false;
        accountSelect.innerHTML = `
            <option value="">-- Error Loading Accounts --</option>
            <option value="no-account">💳 I don't have a bank account yet</option>
            <option value="cash">💵 Cash</option>
            <option value="retry">🔄 Retry Loading Accounts</option>
        `;
        
        // Log error details for debugging
        console.error('❌ Account loading error details:', {
            userId: userId,
            errorMessage: error.message,
            errorCode: error.code,
            timestamp: new Date().toISOString()
        });
    }
}

async function handleAddTransaction(e, userId) {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Adding...';

    try {
        console.log('📝 Starting transaction submission...');
        console.log('👤 Provided userId:', userId);
        console.log('👤 Global currentUser:', currentUser ? currentUser.uid : 'null');
        console.log('👤 Current user from auth:', auth.currentUser ? auth.currentUser.uid : 'null');
        
        // Double check authentication state
        if (!currentUser && !auth.currentUser) {
            throw new Error('No authenticated user found. Please log in again.');
        }
        
        if (!userId) {
            throw new Error('No userId provided for transaction submission');
        }
        
        const accountSelect = document.getElementById('transaction-account');
        const selectedAccountId = accountSelect.value;
        const selectedAccountText = accountSelect.selectedOptions[0].text;
        
        console.log('Form data before processing:', {
            selectedAccountId,
            selectedAccountText,
            name: document.getElementById('transaction-name').value,
            amount: document.getElementById('transaction-amount').value,
            date: document.getElementById('transaction-date').value
        });
        
        // Validate userId early - use current user as fallback
        if (!userId) {
            if (auth.currentUser) {
                userId = auth.currentUser.uid;
                console.log('🔄 Using current authenticated user as fallback:', userId);
            } else {
                throw new Error('User not authenticated. Please log in and try again.');
            }
        }
        
        // Handle special account selections
        if (selectedAccountId === 'add-account') {
            // Redirect to accounts page
            window.location.href = 'accounts.html';
            return;
        }
        
        // Determine account name based on selection
        let accountName = selectedAccountText;
        let accountProvider = '';
        
        if (selectedAccountId === 'no-account') {
            accountName = 'No Bank Account';
        } else if (selectedAccountId === 'cash') {
            accountName = 'Cash';
        } else if (selectedAccountId === 'error') {
            accountName = 'Unknown Account';
        } else if (selectedAccountId && selectedAccountId !== '') {
            // Get account details from the selected option
            const selectedOption = accountSelect.selectedOptions[0];
            accountName = selectedOption.dataset.accountName || selectedAccountText;
            accountProvider = selectedOption.dataset.provider || '';
        }
        
        // Get and process form data
        const rawAmount = parseFloat(document.getElementById('transaction-amount').value);
        const transactionType = document.getElementById('transaction-type').value;
        
        // For expenses, make amount negative; for income, keep positive
        const processedAmount = transactionType === 'expense' ? -Math.abs(rawAmount) : Math.abs(rawAmount);
        
        const transactionData = {
            id: `txn_${Date.now()}`,
            name: document.getElementById('transaction-name').value.trim(),
            amount: processedAmount,
            type: transactionType,
            accountId: selectedAccountId,
            accountName: accountName,
            accountProvider: accountProvider,
            date: document.getElementById('transaction-date').value,
            category: document.getElementById('transaction-category').value,
            channel: document.getElementById('transaction-channel').value,
            notes: document.getElementById('transaction-notes').value.trim(),
            createdAt: new Date().toISOString(),
            source: 'web_app',
            goalId: document.getElementById('transaction-goal').value || null
        };
        
        console.log('Transaction data prepared for submission:', transactionData);
        
        // Basic validation
        if (!transactionData.name || !transactionData.date) {
            alert("Please fill out the transaction name and date.");
            throw new Error("Missing required fields: name or date");
        }
        
        if (isNaN(rawAmount) || rawAmount <= 0) {
            alert("Please enter a valid amount greater than 0.");
            throw new Error("Invalid amount: must be a valid number greater than 0");
        }
        
        // Validate account selection (empty string means no account selected)
        if (!transactionData.accountId || transactionData.accountId === "") {
            alert("Please select an account (Cash, No Bank Account, or a specific bank account).");
            throw new Error("No account selected");
        }
        
        console.log('✅ Validation passed, calling storeTransaction...');
        console.log('UserId being used:', userId);
        console.log('Current user object:', currentUser);
        console.log('Auth current user:', auth.currentUser);
        console.log('Transaction data to store:', transactionData);
        const result = await storeTransaction(userId, transactionData);
        console.log('📊 storeTransaction result:', result);
        
        if (result && result.success) {
            console.log('✅ Transaction stored successfully:', result);
            hideModal();
            await loadTransactions(userId); // Refresh list
            
            // Show success message
            if (typeof showToast === 'function') {
                showToast(`Transaction "${transactionData.name}" added successfully!`, 'success');
            }
            
            // Log successful addition for client-side tracking
            console.log('📊 CLIENT LOG - Transaction Added:', {
                transactionId: result.transactionId,
                transactionName: transactionData.name,
                amount: transactionData.amount,
                type: transactionData.type,
                accountId: transactionData.accountId,
                timestamp: result.timestamp,
                userId: userId
            });

            // If transaction is associated with a goal, update goal progress
            if (transactionData.goalId) {
                const event = new CustomEvent('goalTransaction', {
                    detail: {
                        goalId: transactionData.goalId,
                        amount: transactionData.type === 'expense' ? -transactionData.amount : transactionData.amount
                    }
                });
                window.dispatchEvent(event);
            }
        } else {
            throw new Error("Invalid response from storeTransaction");
        }
    } catch (error) {
        console.error("Error adding transaction:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        console.error("Error name:", error.name);
        
        // Enhanced error message handling
        let errorMessage = "Failed to add transaction. Please try again.";
        
        if (error.message.includes('User not authenticated')) {
            errorMessage = "Please log in to add transactions.";
        } else if (error.message.includes('Authorization failed')) {
            errorMessage = "Authentication error. Please log out and log back in.";
        } else if (error.message.includes('Missing required fields') ||
            error.message.includes('Invalid amount') ||
            error.message.includes('No account selected')) {
            errorMessage = error.message;
        } else if (error.message.includes('Database error') ||
                   error.message.includes('Failed to save to Firestore')) {
            errorMessage = "Database error: " + error.message;
        } else if (error.code === 'permission-denied') {
            errorMessage = "Permission denied. Please check your login status.";
        } else if (error.name === 'FirebaseError') {
            errorMessage = `Firebase error: ${error.message}`;
        } else if (error.message) {
            errorMessage = error.message; // Show the specific error message
        }
        
        alert(errorMessage);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Add Transaction';
    }
}

async function loadTransactions(userId) {
    console.log('🔄 Starting loadTransactions function...');
    const tableBody = document.getElementById('transactions-table-body');
    const emptyState = document.getElementById('transactions-empty-state');
    
    if (!tableBody) {
        console.error('❌ Could not find transactions table body');
        return;
    }

    console.log('📊 Setting loading state...');
    // Show loading state
    tableBody.innerHTML = `
        <tr>
            <td colspan="7" class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading transactions...</p>
            </td>
        </tr>
    `;
    
    if (emptyState) {
        emptyState.style.display = 'none';
    }

    try {
        if (!userId) {
            console.error('❌ No user ID provided to loadTransactions');
            throw new Error('No user ID provided');
        }

        console.log('🔍 Loading transactions for user:', userId);
        const transactions = await getUserTransactions(userId);
        console.log('📊 Received transactions:', transactions?.length || 0);
        
        // Clear loading state
        tableBody.innerHTML = '';
        
        if (!transactions || transactions.length === 0) {
            console.log('ℹ️ No transactions found, showing empty state');
            if (emptyState) {
                emptyState.style.display = 'block';
            }
            return;
        }

        // Sort transactions by date (newest first)
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        transactions.forEach(tx => {
            const row = document.createElement('tr');
            row.dataset.transactionId = tx.id;
            
            // Format date
            const txDate = new Date(tx.date);
            const formattedDate = txDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });

            // Format amount with proper sign
            const amount = tx.type === 'expense' ? -tx.amount : tx.amount;
            const formattedAmount = new Intl.NumberFormat('en-PH', {
                style: 'currency',
                currency: 'PHP'
            }).format(Math.abs(amount));

            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${tx.description || 'No description'}</td>
                <td>${tx.category || 'Uncategorized'}</td>
                <td class="transaction-account-cell">
                    <div class="account-name">${tx.accountName || 'N/A'}</div>
                    ${tx.accountProvider ? `<div class="account-provider">${tx.accountProvider}</div>` : ''}
                </td>
                <td>
                    <span class="transaction-type ${tx.type.toLowerCase()}">${
                        tx.type.charAt(0).toUpperCase() + tx.type.slice(1)
                    }</span>
                </td>
                <td class="amount ${tx.type.toLowerCase()}">${formattedAmount}</td>
                <td class="actions">
                    <button class="action-button edit-btn" data-id="${tx.id}" title="Edit transaction">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-button delete-btn" data-id="${tx.id}" title="Delete transaction">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });

        // Add event listeners for action buttons
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const transactionId = e.currentTarget.dataset.id;
                if (confirm('Are you sure you want to delete this transaction?')) {
                    try {
                        await deleteTransaction(userId, transactionId);
                        // Optimistically remove from UI
                        const row = document.querySelector(`tr[data-transaction-id="${transactionId}"]`);
                        if (row) {
                            row.remove();
                            // Check if we need to show empty state
                            if (tableBody.children.length === 0 && emptyState) {
                                emptyState.style.display = 'block';
                            }
                        }
                        showToast('Transaction deleted successfully', 'success');
                    } catch (error) {
                        console.error('❌ Failed to delete transaction:', error);
                        showToast('Failed to delete transaction', 'error');
                    }
                }
            });
        });

        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const transactionId = e.currentTarget.dataset.id;
                // Find the transaction data
                const transaction = transactions.find(t => t.id === transactionId);
                if (transaction) {
                    showModal();
                    populateFormWithTransaction(transaction);
                }
            });
        });

    } catch (error) {
        console.error('❌ Failed to load transactions:', error);
        
        let errorMessage = 'Failed to load transactions';
        if (error.message.includes('User not authenticated')) {
            errorMessage = 'Please log in to view transactions';
        } else if (error.message.includes('permission-denied')) {
            errorMessage = 'You do not have permission to view these transactions';
        }
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>${errorMessage}</p>
                    <button class="retry-button" onclick="location.reload()">
                        <i class="fas fa-sync"></i> Retry
                    </button>
                </td>
            </tr>
        `;
    }
}

// Helper function to populate form with transaction data
function populateFormWithTransaction(transaction) {
    const form = document.getElementById('add-transaction-form');
    if (!form) return;

    form.dataset.editMode = 'true';
    form.dataset.transactionId = transaction.id;

    // Populate form fields
    form.querySelector('#transaction-type').value = transaction.type;
    form.querySelector('#transaction-amount').value = transaction.amount;
    form.querySelector('#transaction-description').value = transaction.description || '';
    form.querySelector('#transaction-category').value = transaction.category || '';
    form.querySelector('#transaction-account').value = transaction.accountId || '';
    form.querySelector('#transaction-date').value = transaction.date.split('T')[0];
    form.querySelector('#transaction-notes').value = transaction.notes || '';

    // Update modal title and button text
    const modalTitle = document.querySelector('.modal-header h2');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Transaction';
    }

    const submitButton = document.querySelector('.modal-actions .action-button');
    if (submitButton) {
        submitButton.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
}

// Set default date to today in the modal form
document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];

// Error handling functions
function showTransactionError(message) {
    const tableBody = document.getElementById('transactions-table-body');
    const emptyState = document.getElementById('transactions-empty-state');
    
    if (emptyState) emptyState.style.display = 'none';
    
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--secondary); padding: 2rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                    <br>${message}
                    <br><button onclick="location.reload()" style="margin-top: 1rem;" class="secondary-button">
                        <i class="fas fa-refresh"></i> Retry
                    </button>
                </td>
            </tr>
        `;
    }
}

function showAccountLoadError() {
    const accountSelect = document.getElementById('transaction-account');
    if (accountSelect) {
        accountSelect.innerHTML = `
            <option value="">-- Failed to load accounts --</option>
            <option value="no-account">💳 I don't have a bank account yet</option>
            <option value="cash">💵 Cash</option>
            <option value="retry">🔄 Retry loading accounts</option>
        `;
        
        // Add retry functionality
        accountSelect.addEventListener('change', async (e) => {
            if (e.target.value === 'retry' && currentUser) {
                console.log('🔄 Retrying account load...');
                await loadBankAccounts(currentUser.uid);
            }
        });
    }
}

function showGeneralError(message) {
    console.error('❌ General error:', message);
    // Could show a toast notification or other UI feedback
    if (typeof showToast === 'function') {
        showToast(message, 'error');
    } else {
        alert('⚠️ ' + message);
    }
}

// Function to refresh account dropdown (called from accounts page)
async function refreshTransactionAccounts() {
    if (currentUser) {
        console.log('🔄 Refreshing transaction accounts dropdown');
        await loadBankAccounts(currentUser.uid);
    }
}

// Cross-page communication system
function setupCrossPageCommunication() {
    // Listen for account update events from accounts page
    document.addEventListener('accountUpdated', (event) => {
        const { action, accountData } = event.detail;
        console.log('📡 Received account update event:', action, accountData);
        handleAccountUpdate(action, accountData);
    });

    // Listen for BroadcastChannel messages from other tabs
    if (window.BroadcastChannel) {
        const channel = new BroadcastChannel('account-updates');
        channel.addEventListener('message', (event) => {
            const { action, accountData } = event.data;
            console.log('📡 Received account update from other tab:', action, accountData);
            handleAccountUpdate(action, accountData);
        });
    }

    // Check for pending account updates in sessionStorage
    checkPendingAccountUpdates();
}

function handleAccountUpdate(action, accountData) {
    if (!currentUser) return;

    console.log('🔄 Handling account update:', action);
    
    // Refresh accounts dropdown when accounts are modified
    loadBankAccounts(currentUser.uid).catch(err => {
        console.error('❌ Failed to refresh accounts after update:', err);
    });

    // Show notification based on action
    const messages = {
        added: `Account "${accountData.name}" was added successfully`,
        updated: `Account "${accountData.name}" was updated`,
        deleted: `Account "${accountData.name}" was deleted`
    };

    const message = messages[action];
    if (message && typeof showToast === 'function') {
        showToast(message, 'info', 3000);
    }
}

function checkPendingAccountUpdates() {
    try {
        const updates = JSON.parse(sessionStorage.getItem('accountUpdates') || '[]');
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        
        // Process recent updates
        updates.forEach(update => {
            const updateTime = new Date(update.timestamp).getTime();
            if (updateTime > fiveMinutesAgo) {
                console.log('📬 Processing pending account update:', update.action);
                handleAccountUpdate(update.action, update.accountData);
            }
        });

        // Clean up old updates
        const recentUpdates = updates.filter(update => {
            const updateTime = new Date(update.timestamp).getTime();
            return updateTime > fiveMinutesAgo;
        });

        if (recentUpdates.length !== updates.length) {
            sessionStorage.setItem('accountUpdates', JSON.stringify(recentUpdates));
        }
    } catch (error) {
        console.error('❌ Error checking pending account updates:', error);
    }
}

// Initialize cross-page communication
setupCrossPageCommunication();

// Simple toast notification function if not available
function showToast(message, type = 'info', duration = 5000) {
    console.log(`🍞 TOAST [${type.toUpperCase()}]: ${message}`);
    
    // You could implement a simple toast here or use existing system
    const toastElement = document.createElement('div');
    toastElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--glass-bg);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        border: 1px solid var(--glass-border);
        backdrop-filter: blur(10px);
        z-index: 10000;
        font-size: 0.9rem;
        max-width: 300px;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;
    toastElement.textContent = message;
    
    document.body.appendChild(toastElement);
    
    // Animate in
    requestAnimationFrame(() => {
        toastElement.style.opacity = '1';
        toastElement.style.transform = 'translateX(0)';
    });
    
    // Auto remove
    setTimeout(() => {
        toastElement.style.opacity = '0';
        toastElement.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toastElement.parentNode) {
                toastElement.parentNode.removeChild(toastElement);
            }
        }, 300);
    }, duration);
}

async function loadGoals(userId) {
    try {
        const userData = await getUserData(userId);
        return userData.goals || {};
    } catch (error) {
        console.error('Error loading goals:', error);
        return {};
    }
}

async function populateGoalSelect(userId) {
    const goalSelect = document.getElementById('transaction-goal');
    if (!goalSelect) return;

    try {
        const goals = await loadGoals(userId);
        
        // Clear existing options
        goalSelect.innerHTML = '<option value="">No specific goal</option>';
        
        // Add options for each active goal
        Object.entries(goals).forEach(([goalId, goal]) => {
            if (goal.status === 'active') {
                const option = document.createElement('option');
                option.value = goalId;
                option.textContent = goal.name;
                goalSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Error populating goal select:', error);
    }
}

// Export functions that need to be accessed from other modules
export {
    refreshTransactionAccounts,
    handleAccountUpdate,
    showToast
};

