import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { firebaseConfig } from "./config.js";
import { 
    getUserTransactions, 
    storeTransaction, 
    deleteTransaction,
    getUserBankAccounts 
} from "./firestoredb.js";
import { initReceiptScanning } from "../scanReceipt/scan.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize receipt scanner
let receiptScanner = null;

document.addEventListener('DOMContentLoaded', () => {
    const addTransactionBtn = document.getElementById('add-transaction-button');
    const scanTransactionBtn = document.getElementById('scan-transaction-button');
    const modal = document.getElementById('add-transaction-modal');
    const closeModalBtn = document.getElementById('close-add-transaction');
    const cancelModalBtn = document.getElementById('cancel-add-transaction');
    const addTransactionForm = document.getElementById('add-transaction-form');

    // Initialize receipt scanner
    receiptScanner = initReceiptScanning();

    const showModal = () => {
        modal.style.display = 'flex';
    };

    const hideModal = () => {
        modal.style.display = 'none';
        addTransactionForm.reset();
    };

    // Updated scan transaction functionality
    const handleScanTransaction = async () => {
        try {
            console.log('📸 Starting receipt scan...');
            
            // Check if device supports camera
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert('📱 Camera not supported on this device. Please use the "Add Transaction" button to manually enter your transaction.');
                return;
            }

            // Start the receipt scanning process
            await receiptScanner.startScan();
            
        } catch (error) {
            console.error('❌ Failed to start receipt scan:', error);
            
            let errorMessage = 'Failed to start camera scanning. ';
            if (error.name === 'NotAllowedError') {
                errorMessage += 'Please allow camera access and try again.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'No camera found on this device.';
            } else {
                errorMessage += 'Please try again or use manual entry.';
            }
            
            if (confirm('📸 ' + errorMessage + '\n\nWould you like to add a transaction manually instead?')) {
                showModal();
            }
        }
    };

    // Listen for receipt scan results
    document.addEventListener('receiptScanned', (event) => {
        const extractedData = event.detail;
        console.log('📄 Receipt data received:', extractedData);
        
        // Pre-fill the transaction form with scanned data
        populateFormWithScanData(extractedData);
        
        // Show the modal with pre-filled data
        showModal();
        
        // Show success message
        setTimeout(() => {
            alert('✅ Receipt scanned successfully! Please review and confirm the extracted information.');
        }, 500);
    });

    // Function to populate form with scanned data
    function populateFormWithScanData(data) {
        try {
            // Basic transaction fields
            if (data.name || data.merchant) {
                document.getElementById('transaction-name').value = data.name || data.merchant || '';
            }
            
            if (data.amount || data.total) {
                document.getElementById('transaction-amount').value = data.amount || data.total || '';
            }
            
            if (data.type) {
                document.getElementById('transaction-type').value = data.type;
            }
            
            if (data.date) {
                document.getElementById('transaction-date').value = data.date;
            } else {
                // Default to today if no date found
                document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
            }
            
            if (data.category) {
                // Map scanned category to form options
                const categoryMapping = {
                    'food': 'food',
                    'shopping': 'shopping',
                    'bills': 'bills',
                    'transportation': 'transportation',
                    'entertainment': 'entertainment',
                    'health': 'health',
                    'housing': 'housing',
                    'education': 'education',
                    'other': 'other'
                };
                
                const mappedCategory = categoryMapping[data.category.toLowerCase()] || 'other';
                document.getElementById('transaction-category').value = mappedCategory;
            }
            
            // Set channel to 'in-store' for scanned receipts
            document.getElementById('transaction-channel').value = 'in-store';
            
            // Add notes with extracted items if available
            let notes = data.notes || '';
            if (data.items && data.items.length > 0) {
                const itemsList = data.items.map(item => 
                    `${item.name}: ₱${item.price} (x${item.quantity || 1})`
                ).join(', ');
                notes = notes ? `${notes}\n\nItems: ${itemsList}` : `Items: ${itemsList}`;
            }
            
            if (data.merchant && data.merchant !== data.name) {
                notes = notes ? `${notes}\n\nMerchant: ${data.merchant}` : `Merchant: ${data.merchant}`;
            }
            
            document.getElementById('transaction-notes').value = notes;
            
            console.log('✅ Form populated with scanned data');
            
        } catch (error) {
            console.error('❌ Error populating form with scan data:', error);
            alert('⚠️ Scanned data received but there was an error filling the form. Please enter the details manually.');
        }
    }

    addTransactionBtn.addEventListener('click', showModal);
    scanTransactionBtn.addEventListener('click', handleScanTransaction);
    closeModalBtn.addEventListener('click', hideModal);
    cancelModalBtn.addEventListener('click', hideModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal();
        }
    });

    onAuthStateChanged(auth, user => {
        console.log('Auth state changed in transactions.js:', user ? user.uid : 'null');
        if (user) {
            console.log('User authenticated, loading transactions and bank accounts');
            
            // Store the current user for later use
            window.currentUser = user;
            
            // Wait a moment to ensure auth state is fully stabilized
            setTimeout(() => {
                loadTransactions(user.uid);
                loadBankAccounts(user.uid);
                
                // Remove any existing event listeners to prevent duplicates
                const existingHandler = addTransactionForm._submitHandler;
                if (existingHandler) {
                    addTransactionForm.removeEventListener('submit', existingHandler);
                }
                
                // Create new handler and store reference
                const submitHandler = (e) => {
                    console.log('Form submitted, current user:', user.uid);
                    handleAddTransaction(e, user.uid);
                };
                
                // Store reference for potential cleanup
                addTransactionForm._submitHandler = submitHandler;
                addTransactionForm.addEventListener('submit', submitHandler);
            }, 100); // Small delay to ensure auth state stability
        } else {
            console.log('No user authenticated, redirecting to login');
            // Clear any stored user reference
            window.currentUser = null;
            // Redirect to login or show an error
            window.location.href = 'login.html';
        }
    });

    async function loadBankAccounts(userId) {
        const accountSelect = document.getElementById('transaction-account');
        accountSelect.innerHTML = '<option value="">-- Loading Accounts --</option>';
        
        try {
            // Use default user if none provided
            const finalUserId = userId || 'default-user';
            const accounts = await getUserBankAccounts(finalUserId);
            
            // Always provide basic options
            accountSelect.innerHTML = `
                <option value="">-- Select Account --</option>
                <option value="no-account">💳 I don't have a bank account yet</option>
                <option value="cash">💵 Cash</option>
            `;
            
            if (accounts && accounts.length > 0) {
                // Group accounts by category
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
                
                // Add accounts by category
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
                        // Add separator
                        const separator = document.createElement('option');
                        separator.disabled = true;
                        separator.textContent = `--- ${category.label} ---`;
                        accountSelect.appendChild(separator);
                        
                        // Add accounts
                        categoryAccounts.forEach(acc => {
                            const option = document.createElement('option');
                            option.value = acc.id;
                            option.dataset.accountName = acc.name;
                            option.dataset.provider = acc.provider;
                            option.dataset.balance = acc.balance;
                            
                            const displayName = acc.name;
                            const provider = acc.provider !== acc.name ? ` (${acc.provider})` : '';
                            const cardNumber = acc.displayCardNumber || acc.cardNumber;
                            const lastFour = cardNumber ? ` • ${cardNumber}` : '';
                            const balance = ` • ₱${parseFloat(acc.balance).toFixed(2)}`;
                            
                            option.textContent = `${displayName}${provider}${lastFour}${balance}`;
                            accountSelect.appendChild(option);
                        });
                    }
                });
                
                // Add link to add more accounts
                const addAccountOption = document.createElement('option');
                addAccountOption.value = 'add-account';
                addAccountOption.textContent = '➕ Add New Account';
                addAccountOption.style.color = '#1a73e8';
                accountSelect.appendChild(addAccountOption);
            }
        } catch (error) {
            console.error("Error loading bank accounts:", error);
            // Always show basic options even if there's an error
            accountSelect.innerHTML = `
                <option value="">-- Select Account --</option>
                <option value="no-account">💳 I don't have a bank account yet</option>
                <option value="cash">💵 Cash</option>
                <option value="error">-- Error loading accounts --</option>
            `;
        }
    }

    async function handleAddTransaction(e, userId) {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Adding...';

        try {
            console.log('Starting transaction submission...');
            console.log('Provided userId:', userId);
            
            // Use provided userId or fallback to default-user
            const finalUserId = userId || 'default-user';
            console.log('Final userId being used:', finalUserId);
            
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
            
            const transactionData = {
                id: `txn_${Date.now()}`,
                name: document.getElementById('transaction-name').value,
                amount: parseFloat(document.getElementById('transaction-amount').value),
                type: document.getElementById('transaction-type').value,
                accountId: selectedAccountId,
                accountName: accountName,
                accountProvider: accountProvider,
                date: document.getElementById('transaction-date').value,
                category: document.getElementById('transaction-category').value,
                channel: document.getElementById('transaction-channel').value,
                notes: document.getElementById('transaction-notes').value,
                createdAt: new Date().toISOString(),
                source: 'web_app'
            };
            
            console.log('Transaction data prepared for submission:', transactionData);
            
            // Basic validation
            if (!transactionData.name || !transactionData.date) {
                alert("Please fill out the transaction name and date.");
                throw new Error("Missing required fields: name or date");
            }
            
            if (isNaN(transactionData.amount) || transactionData.amount === 0) {
                alert("Please enter a valid amount greater than 0.");
                throw new Error("Invalid amount: must be a valid number greater than 0");
            }
            
            // Validate account selection (empty string means no account selected)
            if (!transactionData.accountId || transactionData.accountId === "") {
                alert("Please select an account (Cash, No Bank Account, or a specific bank account).");
                throw new Error("No account selected");
            }
            
            console.log('Validation passed, calling storeTransaction...');
            const result = await storeTransaction(finalUserId, transactionData);
            console.log('storeTransaction result:', result);
            
            if (result === true) {
                console.log('Transaction stored successfully');
                hideModal();
                loadTransactions(finalUserId); // Refresh list
            } else {
                throw new Error("storeTransaction returned false");
            }
        } catch (error) {
            console.error("Error adding transaction:", error);
            console.error("Error code:", error.code);
            console.error("Error message:", error.message);
            console.error("Error name:", error.name);
            
            // Simple error message handling
            let errorMessage = "Failed to add transaction. Please try again.";
            
            if (error.message.includes('Missing required fields') ||
                error.message.includes('Invalid amount') ||
                error.message.includes('No account selected')) {
                errorMessage = error.message;
            } else if (error.message.includes('Database error') ||
                       error.message.includes('Failed to save to Firestore')) {
                errorMessage = "Database error: " + error.message;
            } else if (error.code === 'permission-denied') {
                // This should not happen anymore with open rules
                errorMessage = "🚨 Firebase Rules Error! Check Firebase Console rules.";
            } else if (error.name === 'FirebaseError') {
                errorMessage = `Firebase error: ${error.message}`;
            }
            
            alert(errorMessage);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Add Transaction';
        }
    }

    async function loadTransactions(userId) {
        const tableBody = document.getElementById('transactions-table-body');
        const emptyState = document.getElementById('transactions-empty-state');
        const loadingState = document.getElementById('transactions-loading-state');
        
        tableBody.innerHTML = '';
        loadingState.style.display = 'block';
        emptyState.style.display = 'none';

        try {
            const transactions = await getUserTransactions(userId);
            loadingState.style.display = 'none';
            
            if (transactions.length === 0) {
                emptyState.style.display = 'block';
            } else {
                transactions.forEach(tx => {
                    const row = document.createElement('tr');
                    row.dataset.transactionId = tx.id;
                    row.innerHTML = `
                        <td>
                            <div class="transaction-name">${tx.name}</div>
                            <div class="transaction-notes">${tx.notes || ''}</div>
                        </td>
                        <td>₱${tx.amount.toFixed(2)}</td>
                        <td><span class="transaction-type ${tx.type}">${tx.type}</span></td>
                        <td>${new Date(tx.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                        <td>
                            <div class="account-name">${tx.accountName || 'N/A'}</div>
                            ${tx.accountProvider && tx.accountProvider !== tx.accountName ? `<div class="account-provider">${tx.accountProvider}</div>` : ''}
                        </td>
                        <td>${tx.category}</td>
                        <td class="transaction-actions">
                            <button class="action-button delete-btn" data-id="${tx.id}" aria-label="Delete transaction"><i class="fas fa-trash"></i></button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });
            }
        } catch(error) {
            console.error("Failed to load transactions", error);
            loadingState.style.display = 'none';
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--secondary-orange);">Error loading transactions.</td></tr>';
        }

        // Add event listeners for delete buttons
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent row click event
                const transactionId = e.currentTarget.dataset.id;
                if (confirm('Are you sure you want to delete this transaction?')) {
                    try {
                        await deleteTransaction(userId, transactionId);
                        // Optimistically remove from UI
                        document.querySelector(`tr[data-transaction-id="${transactionId}"]`).remove();
                        const transactions = await getUserTransactions(userId);
                        if(transactions.length === 0){
                            emptyState.style.display = 'block';
                        }
                    } catch (error) {
                        console.error('Failed to delete transaction', error);
                        alert('Could not delete transaction.');
                    }
                }
            });
        });
    }

    // Set default date to today in the modal form
    document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
});

