// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-analytics.js";
import { getAuth, onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import {
  getUserData,
  storeUserData,
  storeTransaction,
  getUserTransactions,
  updateTransaction,
  deleteTransaction as deleteFirestoreTransaction,
  storeBankAccount,
  getUserBankAccounts,
  updateBankAccount,
  db
} from "./firestoredb.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-storage.js";
import { firebaseConfig } from "./config.js";
import { validateName, validateCardNumber, validateAmount, validateDate, showValidationError, clearAllValidationErrors, sanitizeString, secureStorage } from "./helpers.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', function () {
  // Initialize page navigation
  initializeNavigation();

  // Check if user is logged in
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        console.log('User authenticated:', user.uid);
        
        // User is signed in, attempt to get data from Firestore
        await updateUserInterface(user);

        // Initialize the dashboard components (only once)
        await initializeDashboard();

        // Setup logout button
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
          logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            secureLogout();
          });
          console.log('✅ Logout button event listener attached');
        } else {
          console.log('ℹ️ Logout button not found - may not exist on this page');
        }
        
        // Load transactions and update balance summary
        try {
          await loadTransactions();
          await updateBalanceSummary();
          
          // Set up auto-refresh every 5 minutes (only once)
          if (!window.dashboardRefreshInterval) {
            window.dashboardRefreshInterval = setInterval(async () => {
              try {
                await loadTransactions();
                await updateBalanceSummary();
              } catch (error) {
                console.error('Error in auto-refresh:', error);
              }
            }, 5 * 60 * 1000);
            console.log('✅ Auto-refresh interval set up');
          }
        } catch (error) {
          console.error('Error loading initial data:', error);
        }
        
        console.log('✅ Dashboard initialization completed');
      } catch (error) {
        console.error('Error during dashboard initialization:', error);
      }
    } else {
      // User is signed out, redirect to login
      console.log('No user authenticated, redirecting to login');
      window.location.href = "login.html";
    }
  });
});

function initializeNavigation() {
  const navLinks = document.querySelectorAll('.header-nav-items a');
  const pages = document.querySelectorAll('.page-content');

  // Initialize mobile menu toggle
  const menuToggle = document.getElementById('menu-toggle');
  const headerMenu = document.querySelector('.header-menu');

  if (menuToggle && headerMenu) {
    menuToggle.addEventListener('click', () => {
      headerMenu.classList.toggle('active');

      // Toggle icon between bars and times
      const icon = menuToggle.querySelector('i');
      if (icon.classList.contains('fa-bars')) {
        icon.classList.replace('fa-bars', 'fa-times');
      } else {
        icon.classList.replace('fa-times', 'fa-bars');
      }
    });

    // Close mobile menu when clicking on a link
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        headerMenu.classList.remove('active');
        menuToggle.querySelector('i').classList.replace('fa-times', 'fa-bars');
      });
    });
  } else {
    console.warn('Mobile menu toggle elements not found - skipping mobile menu initialization');
  }

  // Handle page navigation only for links with data-page attribute
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      // Skip links without data-page attribute (external links)
      const pageId = link.getAttribute('data-page');
      if (!pageId) return;
      
      e.preventDefault();

      // Remove active class from all links
      navLinks.forEach(l => l.classList.remove('active'));

      // Add active class to clicked link
      link.classList.add('active');

      // Hide all pages
      pages.forEach(page => page.style.display = 'none');

      // Show selected page
      document.getElementById(`${pageId}-page`).style.display = 'block';
    });
  });
}

async function updateUserInterface(user) {
  const welcomeElement = document.getElementById('welcomeUsername');
  
  if (!welcomeElement) {
    console.error('Welcome element not found in the DOM');
    return;
  }

  // Set temporary state while loading
  welcomeElement.textContent = user.email ? user.email.split('@')[0] : 'User';

  try {
    // First try to get data from secure storage
    let userData = await secureStorage.getItem('userData');

    if (!userData) {
      // If not in secure storage, get from Firestore
      userData = await getUserData(user.uid);

      // If still no user data, create a basic profile
      if (!userData) {
        console.log("No user profile found. Creating a default profile...");
        
        // Try to get name from user object first
        let firstName = '';
        let lastName = '';
        
        if (user.displayName) {
          const nameParts = user.displayName.split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.slice(1).join(' ') || '';
        } else {
          // Fallback to email
          firstName = user.email.split('@')[0];
          lastName = "";
        }
        
        const defaultUserData = {
          firstName: firstName,
          lastName: lastName,
          email: user.email,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        };

        try {
          await storeUserData(user.uid, defaultUserData);
          userData = defaultUserData;
          console.log("Default profile created successfully!");
        } catch (error) {
          console.error("Error creating default profile:", error);
        }
      }

      if (userData) {
        // Create a safe version with only non-sensitive data
        const safeUserData = {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          lastLogin: userData.lastLogin,
          accountStatus: userData.accountStatus
        };

        // Store in secure storage for future quick access
        await secureStorage.setItem('userData', safeUserData);
      }
    }

    // Update the UI with user data
    if (userData && userData.firstName) {
      // We have the user data with a first name
      welcomeElement.textContent = userData.firstName;
      console.log('Updated welcome message with name:', userData.firstName);
    } else if (user.displayName) {
      // Fallback to display name if available
      const nameParts = user.displayName.split(' ');
      const firstName = nameParts[0] || 'User';
      welcomeElement.textContent = firstName;
      console.log('Updated welcome message with display name:', firstName);
    } else {
      // Final fallback to email or generic 'User'
      const emailName = user.email ? user.email.split('@')[0] : 'User';
      welcomeElement.textContent = emailName;
      console.log('Updated welcome message with email name:', emailName);
    }
  } catch (error) {
    console.error('Error updating user interface:', error);
    // Ensure we have a fallback name even if there's an error
    welcomeElement.textContent = user.email ? user.email.split('@')[0] : 'User';
  }
}

// Initialize dashboard functionality
async function initializeDashboard() {
  // Check authentication state before proceeding
  const user = auth.currentUser;
  if (!user) {
    console.error('User not authenticated');
    return;
  }

  // Initialize core components
  initializeSpendingChart();
  initializeBankSection();
  initializeTransactionHistory();
  initializeBankModalToggles(); // Not async anymore
  
  // Initialize financial health section
  refreshFinancialHealth();
}

function initializeSpendingChart() {
  const ctx = document.getElementById('spendingChart');
  if (!ctx) {
    console.warn('Spending chart canvas not found - skipping chart initialization');
    return;
  }

  // Simplified options for better performance
  const chart = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Income',
          data: [0, 0, 0, 0, 0, 0, 0], // Default empty data
          backgroundColor: 'rgba(16, 223, 111, 0.2)',
          borderColor: '#10df6f',
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointRadius: 3
        },
        {
          label: 'Expenses',
          data: [0, 0, 0, 0, 0, 0, 0], // Default empty data
          backgroundColor: 'transparent',
          borderColor: '#e96d1f',
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2.5,
      animation: {
        duration: 500
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: 'rgba(255, 255, 255, 0.7)',
            usePointStyle: true,
            pointStyle: 'line'
          }
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: function (context) {
              return `${context.dataset.label}: ₱${Math.abs(context.raw).toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.7)'
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.7)',
            callback: function (value) {
              return '₱' + value.toLocaleString();
            }
          }
        }
      }
    }
  });

  // Store chart reference for later updates
  window.spendingChart = chart;

  // Load transaction data to update the chart
  loadTransactionData();
}

// New function to load transaction data and update the chart
async function loadTransactionData() {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const transactions = await getUserTransactions(user.uid);
    updateSpendingChart(transactions);
  } catch (error) {
    console.error('Error loading transaction data for chart:', error);
  }
}

// Function to update the spending chart with transaction data
function updateSpendingChart(transactions) {
  if (!window.spendingChart) return;

  // Group transactions by day of week and type
  const dailyData = {
    income: { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 },
    expenses: { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 }
  };

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Process each transaction
  transactions.forEach(transaction => {
    if (transaction.amount && transaction.date) {
      const date = new Date(transaction.date);
      const dayName = daysOfWeek[date.getDay()];
      const amount = Math.abs(parseFloat(transaction.amount));

      if (transaction.type === 'income') {
        dailyData.income[dayName] += amount;
      } else {
        dailyData.expenses[dayName] += amount;
      }
    }
  });

  // Update chart data
  window.spendingChart.data.datasets[0].data = [
    dailyData.income['Mon'],
    dailyData.income['Tue'],
    dailyData.income['Wed'],
    dailyData.income['Thu'],
    dailyData.income['Fri'],
    dailyData.income['Sat'],
    dailyData.income['Sun']
  ];

  window.spendingChart.data.datasets[1].data = [
    dailyData.expenses['Mon'],
    dailyData.expenses['Tue'],
    dailyData.expenses['Wed'],
    dailyData.expenses['Thu'],
    dailyData.expenses['Fri'],
    dailyData.expenses['Sat'],
    dailyData.expenses['Sun']
  ];

  window.spendingChart.update();
}

// Add new function to handle transaction history and add transaction functionality
function initializeTransactionHistory() {
  const addTransactionBtn = document.getElementById('add-transaction-btn');
  const transactionModal = document.getElementById('transaction-modal');
  const closeTransactionModal = document.getElementById('close-transaction-modal');
  const transactionForm = document.getElementById('transaction-form');
  const transactionsList = document.getElementById('transactions-list');
  
  // Check if any required elements are missing
  if (!addTransactionBtn || !transactionModal || !closeTransactionModal || !transactionForm || !transactionsList) {
    console.warn('Some transaction UI elements not found - skipping transaction history initialization');
    return;
  }

  // Show add transaction modal
  if (addTransactionBtn) {
    addTransactionBtn.addEventListener('click', () => {
      transactionModal.style.display = 'block';
    });
  }

  // Close transaction modal
  if (closeTransactionModal) {
    closeTransactionModal.addEventListener('click', () => {
      transactionModal.style.display = 'none';
    });
  }

  // Handle transaction form submission
  if (transactionForm) {
    transactionForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const user = auth.currentUser;
      if (!user) {
        console.error('No user logged in');
        return;
      }

      const transaction = {
        name: document.getElementById('transaction-description').value,
        amount: document.getElementById('transaction-amount').value,
        date: document.getElementById('transaction-date').value,
        category: document.getElementById('transaction-category').value,
        type: document.getElementById('transaction-type').value || 'expense',
        id: `trans_${Date.now()}`
      };

      try {
        // Store transaction in Firestore
        await storeTransaction(user.uid, transaction);
        
        // Load updated transactions and refresh the UI
        await loadTransactions();
        
        // Reset form and close modal
        transactionForm.reset();
        transactionModal.style.display = 'none';
      } catch (error) {
        console.error('Error adding transaction:', error);
        alert('Failed to add transaction: ' + error.message);
      }
    });
  }

  // Load transactions from Firestore
  loadTransactions();
}

function renderRecentTransactionsList(transactions) {
  const transactionsList = document.getElementById('transactions-list');
  if (!transactionsList) return;

  if (!transactions || transactions.length === 0) {
    transactionsList.innerHTML = '<div class="no-transactions">No transactions yet</div>';
    return;
  }

  // Sort transactions by date, most recent first
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Limit to the 5 most recent transactions for the dashboard widget
  const recentTransactions = transactions.slice(0, 5);

  transactionsList.innerHTML = recentTransactions.map(transaction => {
    const date = new Date(transaction.date).toLocaleDateString();
    const amountClass = transaction.type === 'income' ? 'transaction-amount income' : 'transaction-amount expense';
    const amountPrefix = transaction.type === 'income' ? '+' : '-';
    
    return `
      <div class="transaction-item">
        <div class="transaction-info">
          <div class="transaction-description">${transaction.name || transaction.description || 'Unnamed'}</div>
          <div class="transaction-date">${date}</div>
          <div class="transaction-category">${transaction.category || 'Other'}</div>
        </div>
        <div class="${amountClass}">${amountPrefix} ₱${parseFloat(transaction.amount).toFixed(2)}</div>
        <button class="delete-transaction" data-id="${transaction.id}">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  }).join('');

  // Add event listeners for delete buttons
  document.querySelectorAll('.delete-transaction').forEach(button => {
    button.addEventListener('click', () => deleteTransaction(button.dataset.id));
  });
}

// Function to delete a transaction
async function deleteTransaction(id) {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('No user logged in');
      return;
    }

    // Delete from Firestore using the imported function
    await deleteFirestoreTransaction(user.uid, id);
    
    // Reload transactions to update UI
    await loadTransactions();
    
    console.log('Transaction deleted successfully');
  } catch (error) {
    console.error('Error deleting transaction:', error);
    alert('Failed to delete transaction: ' + error.message);
  }
}

// Function to toggle between bank and e-wallet fields
function initializeBankModalToggles() {
  // Check if modal elements exist (they may not be present on dashboard page)
  const accountTypeSelect = document.getElementById('account-type');
  if (!accountTypeSelect) {
    console.log('Bank modal elements not found - skipping modal initialization');
    return;
  }

  const bankFields = document.getElementById('bank-fields');
  const ewalletFields = document.getElementById('ewallet-fields');
  const cardDetailsRow = document.getElementById('card-details-row');
  const numberLabel = document.getElementById('number-label');
  const ewalletProvider = document.getElementById('ewallet-provider');
  const otherProviderField = document.getElementById('other-provider-field');
  const currencySelect = document.getElementById('currency');
  const currencySymbol = document.getElementById('currency-symbol');
  const closeAddBankBtn = document.getElementById('close-add-bank');
  const addBankModal = document.getElementById('add-bank-modal');

  // Currency symbols mapping
  const currencySymbols = {
    'PHP': '₱'
  };

  // Toggle fields based on account type (only if elements exist)
  if (accountTypeSelect && bankFields && ewalletFields && cardDetailsRow && numberLabel) {
    accountTypeSelect.addEventListener('change', function () {
      if (this.value === 'bank') {
        bankFields.style.display = 'block';
        ewalletFields.style.display = 'none';
        cardDetailsRow.style.display = 'grid';
        numberLabel.textContent = 'Card Number';
      } else {
        bankFields.style.display = 'none';
        ewalletFields.style.display = 'block';
        cardDetailsRow.style.display = 'none';
        numberLabel.textContent = 'Account Number/ID';
      }
    });
  }

  // Handle "Other" e-wallet provider selection (only if elements exist)
  if (ewalletProvider && otherProviderField) {
    ewalletProvider.addEventListener('change', function () {
      otherProviderField.style.display = this.value === 'other' ? 'block' : 'none';
    });
  }

  // Update currency symbol when currency changes (only if elements exist)
  if (currencySelect && currencySymbol) {
    currencySelect.addEventListener('change', function () {
      currencySymbol.textContent = currencySymbols[this.value] || '₱';
    });
  }

  // Close button functionality (only if elements exist)
  if (closeAddBankBtn && addBankModal) {
    closeAddBankBtn.addEventListener('click', function () {
      addBankModal.style.display = 'none';
    });
  }
}

// Update the initializeBankSection function
async function initializeBankSection() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('No user logged in');
      return;
    }

    // Get bank accounts from Firestore
    const accounts = await getUserBankAccounts(user.uid);
    console.log('Loaded accounts from Firestore:', accounts);

    // Update localStorage with the latest data from Firestore
    if (accounts && accounts.length > 0) {
      localStorage.setItem('bankAccounts', JSON.stringify(accounts));
    }

    // Update UI elements
    const bankCardsGrid = document.querySelector('.bank-cards-grid');
    const emptyStateContainer = document.querySelector('.empty-state-container');

    if (!accounts || accounts.length === 0) {
      if (emptyStateContainer) emptyStateContainer.style.display = 'block';
      if (bankCardsGrid) bankCardsGrid.style.display = 'none';
    } else {
      if (emptyStateContainer) emptyStateContainer.style.display = 'none';
      if (bankCardsGrid) bankCardsGrid.style.display = 'grid';
    }

    // Initialize form toggles
    initializeInputFormatting();
    initializeBankModalToggles();

    // Render bank cards
    await renderBankCards();

  } catch (error) {
    console.error('Error initializing bank section:', error);
  }
}

function initializeInputFormatting() {
  // Format card number input
  const cardInput = document.getElementById('card-number');
  if (cardInput) {
    cardInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      e.target.value = value;
    });
  }
}

async function renderBankCards() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('No user logged in');
      return;
    }

    const bankCardsGrid = document.querySelector('.bank-cards-grid');
    const bankAccounts = await getUserBankAccounts(user.uid);

    // Currency symbols mapping
    const currencySymbols = {
      'PHP': '₱'
    };

    let cardsHTML = bankAccounts.map(account => {
      const isEwallet = account.accountType === 'ewallet';
      const currencySymbol = currencySymbols[account.currency] || '₱';

      return `
                <div class="bank-card ${isEwallet ? 'ewallet-card' : ''}" data-id="${account.id}">
                    <div class="card-type">
                        <i class="fas ${isEwallet ? 'fa-wallet' : 'fa-credit-card'}"></i>
                        <span>${account.currency}</span>
                    </div>
                    <h3>${account.accountName}</h3>
                    <div class="card-number">${isEwallet ? 'Account ID: ' : ''}**** **** **** ${account.cardNumber.slice(-4)}</div>
                    <div class="card-name">${account.cardName}</div>
                    <div class="balance">₱${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <button class="delete-account-btn" data-id="${account.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
    }).join('');

    // Add the "Add New Account" card
    cardsHTML += `
            <div class="bank-card add-card" id="add-card-button">
                <div class="add-card-content">
                    <i class="fas fa-plus"></i>
                    <p>Add New Account</p>
                </div>
            </div>
        `;

    bankCardsGrid.innerHTML = cardsHTML;
    bankCardsGrid.style.display = 'grid';

    // Add event listeners
    const addCardButton = document.getElementById('add-card-button');
    if (addCardButton) {
      addCardButton.addEventListener('click', () => {
        const modal = document.getElementById('add-bank-modal');
        if (modal) {
          modal.style.display = 'block';
        }
      });
    }

    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-account-btn').forEach(button => {
      button.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent event bubbling
        const accountId = button.dataset.id;
        if (confirm('Are you sure you want to delete this account?')) {
          try {
            await deleteAccount(accountId);
            alert('Account deleted successfully');
          } catch (error) {
            console.error('Error in delete handler:', error);
            alert('Failed to delete account. Please try again.');
          }
        }
      });
    });

    // Update summary
    updateBalanceSummary();
  } catch (error) {
    console.error('Error rendering bank cards:', error);
  }
}

function showSecurityModal(accountId) {
  const securityModal = document.getElementById('security-modal');
  securityModal.style.display = 'block';

  document.getElementById('verify-button').onclick = async function () {
    const password = document.getElementById('security-password').value;
    const cardId = document.getElementById('security-modal').dataset.cardId;

    try {
      // Verify password with Firebase Auth
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);

      // If successful, show the details
      const bankCard = document.querySelector(`.bank-card[data-id="${cardId}"]`);
      // Show full card details here
      // You can implement the details display logic

      document.getElementById('security-modal').style.display = 'none';
      document.getElementById('security-password').value = '';
    } catch (error) {
      alert('Invalid password. Please try again.');
    }
  };

  document.getElementById('cancel-verification').onclick = () => {
    securityModal.style.display = 'none';
    document.getElementById('security-password').value = '';
  };
}

function showAccountDetails(accountId) {
  const bankAccounts = JSON.parse(localStorage.getItem('bankAccounts')) || [];
  const account = bankAccounts.find(acc => acc.id === parseInt(accountId));

  if (account) {
    alert(`
Full Card Number: ${account.cardNumber}
Account Name: ${account.cardName}
Balance: ₱${parseFloat(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        `);
  }
}

// Add this CSS to fix the grid layout
document.head.insertAdjacentHTML('beforeend', `
<style>
.bank-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
    padding: 1.5rem;
}

.bank-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 15px;
    padding: 1.5rem;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
}

.bank-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
}

.add-card {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: 2px dashed rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.02);
}

.add-card:hover {
    border-color: rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.05);
}

.add-card-content {
    text-align: center;
}

.add-card-content i {
    font-size: 2rem;
    margin-bottom: 1rem;
    color: rgba(255, 255, 255, 0.7);
}

.add-card-content p {
    color: rgba(255, 255, 255, 0.7);
}

.delete-account-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(255, 59, 48, 0.1);
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
}

.delete-account-btn i {
    color: #ff3b30;
    font-size: 14px;
}

.delete-account-btn:hover {
    background: rgba(255, 59, 48, 0.2);
    transform: scale(1.1);
}

.bank-card {
    position: relative;
}
</style>
`);

// Add this to handle view details clicks
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('view-details-btn')) {
    const bankCard = e.target.closest('.bank-card');
    if (bankCard) {
      document.getElementById('security-modal').style.display = 'flex';

      // Store the card ID temporarily
      document.getElementById('security-modal').dataset.cardId = bankCard.dataset.id;
    }
  }
});

// Add Transaction Modal Handlers with null checks
const addTransactionButton = document.getElementById('add-transaction-button');
if (addTransactionButton) {
  addTransactionButton.addEventListener('click', function (e) {
    e.preventDefault(); // Prevent default button behavior
    const modal = document.getElementById('add-transaction-modal');
    if (modal) {
      modal.style.display = 'flex';

      // Set default date to today
      const today = new Date().toISOString().split('T')[0];
      const dateField = document.getElementById('transaction-date');
      if (dateField) {
        dateField.value = today;
      }

      // Populate the account dropdown
      populateAccountDropdown();
    }
  });
}

// Close transaction modal
const closeTransactionButton = document.getElementById('close-add-transaction');
if (closeTransactionButton) {
  closeTransactionButton.addEventListener('click', function (e) {
    e.preventDefault();
    const modal = document.getElementById('add-transaction-modal');
    if (modal) {
      modal.style.display = 'none';
    }

    // Reset the form
    const form = document.getElementById('add-transaction-form');
    if (form) {
      form.reset();
      // Reset submit button if it's in loading state
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Add Transaction';
      }
      // Clear any validation errors
      if (typeof clearAllValidationErrors === 'function') {
        clearAllValidationErrors(form);
      }
    }
  });
}

// Prevent form submission from scrolling
const addTransactionForm = document.getElementById('add-transaction-form');
if (addTransactionForm) {
  addTransactionForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  e.stopPropagation();

  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user logged in');
    }

    // Clear any previous validation errors
    clearAllValidationErrors(this);

    // Get and validate all form fields
    const nameField = document.getElementById('transaction-name');
    const typeField = document.getElementById('transaction-type');
    const amountField = document.getElementById('transaction-amount');
    const dateField = document.getElementById('transaction-date');
    const timeField = document.getElementById('transaction-time');
    const channelField = document.getElementById('transaction-channel');
    const categoryField = document.getElementById('transaction-category');
    const notesField = document.getElementById('transaction-notes');
    const accountField = document.getElementById('transaction-account');

    // Store original button state
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;

    // Update button to loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    // Validate name (required)
    if (!nameField || !nameField.value.trim()) {
      showValidationError(nameField, 'Transaction name is required');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
      return;
    }

    // Validate amount (required, must be a number)
    if (!amountField || !amountField.value.trim()) {
      showValidationError(amountField, 'Amount is required');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
      return;
    }

    const amount = parseFloat(amountField.value.trim());
    if (isNaN(amount)) {
      showValidationError(amountField, 'Please enter a valid amount');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
      return;
    }

    // Validate account selection (can be "no_account" now)
    if (!accountField || (!accountField.value && accountField.value !== "no_account")) {
      showValidationError(accountField, 'Please select an account or "No Account"');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
      return;
    }

    // Validate date (required)
    if (!dateField || !dateField.value) {
      showValidationError(dateField, 'Date is required');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
      return;
    }

    // Only update account balance if an actual account is selected
    if (accountField.value !== "no_account") {
      // Get the account to update its balance
      const accounts = await getUserBankAccounts(user.uid);
      const accountToUpdate = accounts.find(acc => acc.id === accountField.value);

      if (!accountToUpdate) {
        throw new Error('Selected account not found');
      }

      // Calculate transaction amount (negative for expense, positive for income)
      const transactionAmount = typeField && typeField.value === 'income' ? Math.abs(amount) : -Math.abs(amount);

      // Calculate new balance
      const newBalance = parseFloat(accountToUpdate.balance) + transactionAmount;

      // Update the account balance
      const accountUpdateSuccess = await updateBankAccount(user.uid, accountField.value, {
        balance: newBalance,
        lastUpdated: new Date().toISOString()
      });

      if (!accountUpdateSuccess) {
        throw new Error('Failed to update account balance');
      }
    }

    // Create the transaction data object
    const transactionData = {
      id: Date.now().toString(),
      name: nameField.value.trim(),
      type: typeField ? typeField.value : 'expense',
      amount: typeField && typeField.value === 'income' ? Math.abs(amount) : -Math.abs(amount),
      accountId: accountField.value === "no_account" ? null : accountField.value,
      date: dateField.value,
      time: timeField ? timeField.value : '00:00',
      channel: channelField ? channelField.value : 'other',
      category: categoryField ? categoryField.value : 'other',
      notes: notesField ? notesField.value.trim() : '',
      createdAt: new Date().toISOString(),
      userId: user.uid,
      isNoAccount: accountField.value === "no_account"
    };

    // Store the transaction
    const success = await storeTransaction(user.uid, transactionData);

    if (success) {
      // Reset form and close modal
      this.reset();
      document.getElementById('add-transaction-modal').style.display = 'none';

      // Update UI
      await Promise.all([
        loadTransactions(), // Reload transactions
        renderBankCards()   // Update bank cards to show new balance
      ]);

      // Update balance summary for all displays (this will handle the welcome banner)
      updateBalanceSummary();
      
      // Refresh financial health
      refreshFinancialHealth();
      
      // Dispatch a global event that all components can listen for
      const transactionAddedEvent = new CustomEvent('transactionAdded', {
        detail: { transaction: transactionData }
      });
      document.dispatchEvent(transactionAddedEvent);
      console.log('Transaction added event dispatched with new transaction data');

      // Show success message
      alert('Transaction added successfully!');
    } else {
      throw new Error('Failed to store transaction');
    }
  } catch (error) {
    console.error('Error adding transaction:', error);
    alert('Failed to add transaction: ' + error.message);
  } finally {
    // Reset submit button state
    const submitBtn = this.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Add Transaction';
    }
  }
  });
}

// Enhanced loadTransactions function with comprehensive refresh of all transaction components
async function loadTransactions() {
  console.log('Loading transactions from Firestore...');
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('No user logged in - skipping transaction load');
      return [];
    }

    // Get all transactions with error handling
    let transactions = [];
    try {
      transactions = await getUserTransactions(user.uid);
      if (!Array.isArray(transactions)) {
        console.warn('Transactions data is not an array, defaulting to empty array');
        transactions = [];
      }
      console.log(`Loaded ${transactions.length} transactions`);
    } catch (transactionError) {
      console.error('Error fetching transactions from Firestore:', transactionError);
      transactions = [];
    }

    // Update the main transactions table (if exists)
    try {
      if (typeof renderTransactions === 'function') {
        renderTransactions(transactions);
      }
    } catch (renderError) {
      console.error('Error rendering transactions table:', renderError);
    }
    
    // Update the spending chart if it exists
    try {
      if (document.getElementById('spendingChart') && typeof updateSpendingChart === 'function') {
        updateSpendingChart(transactions);
      }
    } catch (chartError) {
      console.error('Error updating spending chart:', chartError);
    }

    // Update the recent transactions widget
    try {
      if (typeof renderRecentTransactions === 'function') {
        renderRecentTransactions(transactions);
      }
    } catch (recentError) {
      console.error('Error rendering recent transactions:', recentError);
    }
    
    // Update the dashboard transactions list widget
    try {
      if (typeof renderRecentTransactionsList === 'function') {
        renderRecentTransactionsList(transactions);
      }
    } catch (listError) {
      console.error('Error rendering recent transactions list:', listError);
    }

    // Refresh financial health
    try {
      if (typeof refreshFinancialHealth === 'function') {
        refreshFinancialHealth();
      }
    } catch (healthError) {
      console.error('Error refreshing financial health:', healthError);
    }
    
    // Store transactions in sessionStorage for faster access by other components
    try {
      sessionStorage.setItem('userTransactions', JSON.stringify({
        data: transactions,
        timestamp: Date.now()
      }));
    } catch (storageError) {
      console.error('Error storing transactions in session storage:', storageError);
    }
    
    // Update financial summary
    try {
      if (typeof updateBalanceSummary === 'function') {
        await updateBalanceSummary();
      }
    } catch (summaryError) {
      console.error('Error updating balance summary:', summaryError);
    }
    
    console.log('Transaction loading completed');
    
    return transactions;
  } catch (error) {
    console.error('Error loading transactions:', error);
    // Show a fallback empty state in the main transactions table
    const tableBody = document.getElementById('transactions-table-body');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <div class="empty-state-content">
              <i class="fas fa-receipt empty-icon"></i>
              <p>No transactions found. Start by adding your first transaction.</p>
            </div>
          </td>
        </tr>
      `;
    }
    return [];
  }
}

// Function to render transactions in the transactions table
function renderTransactions(transactions) {
  const tableBody = document.getElementById('transactions-table-body');
  const emptyState = document.getElementById('transactions-empty-state');
  
  if (!tableBody) {
    console.error('Table body element not found');
    return;
  }
  
  if (!transactions || transactions.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    tableBody.innerHTML = '';
    return;
  }
  
  if (emptyState) emptyState.style.display = 'none';
  
  // Sort transactions by date (most recent first)
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Create the HTML for the transactions table
  tableBody.innerHTML = transactions.map(transaction => `
    <tr data-transaction-id="${transaction.id}" class="transaction-row" style="cursor: pointer;">
      <td>${transaction.name}</td>
      <td class="${transaction.type === 'income' ? 'positive' : 'negative'}">
        ${transaction.type === 'income' ? '+' : '-'}₱${Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td><span class="transaction-type ${transaction.type}">${transaction.type === 'income' ? 'Income' : 'Expense'}</span></td>
      <td>${new Date(transaction.date).toLocaleDateString()}</td>
      <td>${transaction.channel}</td>
      <td>${transaction.category}</td>
      <td class="actions">
        <button class="delete-transaction-btn" data-id="${transaction.id}" style="opacity: 1 !important;">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
  
  // Add event listeners for delete buttons
  const deleteButtons = tableBody.querySelectorAll('.delete-transaction-btn');
  deleteButtons.forEach(button => {
    button.addEventListener('click', async function (e) {
      e.preventDefault();
      e.stopPropagation(); // Prevent the row click event
      const transactionId = this.getAttribute('data-id');
      const user = auth.currentUser;
      
      if (confirm('Are you sure you want to delete this transaction?')) {
        try {
          // First get the transaction details to know which account to update
          const allTransactions = await getUserTransactions(user.uid);
            const transaction = allTransactions.find(t => t.id === transactionId);

            if (!transaction) {
              throw new Error('Transaction not found');
            }

            // If the transaction has an associated account, update its balance
            if (transaction.accountId) {
              // Get the account
              const accounts = await getUserBankAccounts(user.uid);
              const accountToUpdate = accounts.find(acc => acc.id === transaction.accountId);

              if (accountToUpdate) {
                // Reverse the transaction effect on balance
                // If it was an expense (negative amount), add it back
                // If it was income (positive amount), subtract it
                const newBalance = parseFloat(accountToUpdate.balance) - parseFloat(transaction.amount);

                // Update the account balance
                await updateBankAccount(user.uid, transaction.accountId, {
                  balance: newBalance,
                  lastUpdated: new Date().toISOString()
                });
              }
            }

            // Delete the transaction
            const success = await deleteFirestoreTransaction(user.uid, transactionId);

            if (success) {
              // Remove the row from the table
              const row = this.closest('tr');
              if (row) {
                row.remove();

                // Check if table is empty
                if (!tableBody.hasChildNodes()) {
                  if (emptyState) {
                    emptyState.style.display = 'block';
                  }
                }

                // Update the spending chart
                const remainingTransactions = await getUserTransactions(user.uid);
                if (typeof updateSpendingChart === 'function') {
                  updateSpendingChart(remainingTransactions);
                }

                // Update recent transactions widget
                renderRecentTransactions(remainingTransactions);

                // Update bank cards to reflect new balance
                await renderBankCards();

                // Refresh financial health
                refreshFinancialHealth();
              }
            } else {
              throw new Error('Failed to delete transaction');
            }
          } catch (error) {
            console.error('Error deleting transaction:', error);
            alert('Failed to delete transaction. Please try again.');
          }
        }
      });
    });

    // Add event listeners for transaction row clicks to show details
    const transactionRows = tableBody.querySelectorAll('tr.transaction-row');
    transactionRows.forEach(row => {
      row.addEventListener('click', function () {
        const transactionId = this.getAttribute('data-transaction-id');
        showTransactionDetails(transactionId, transactions);
      });
    });
  } // End of renderTransactions function

// Note: Transaction loading is now handled in the main DOMContentLoaded listener to avoid conflicts

// Function to populate the account dropdown in the transaction form
async function populateAccountDropdown() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('No user logged in');
      return;
    }

    // Get the dropdown element
    const accountDropdown = document.getElementById('transaction-account');
    if (!accountDropdown) return;

    // Clear existing options except the first one
    while (accountDropdown.options.length > 1) {
      accountDropdown.remove(1);
    }

    // Add "No Account" option
    const noAccountOption = document.createElement('option');
    noAccountOption.value = "no_account";
    noAccountOption.textContent = "No Account (Cash Transaction)";
    accountDropdown.appendChild(noAccountOption);

    // Get user's bank accounts
    const accounts = await getUserBankAccounts(user.uid);

    // Add a separator if there are accounts
    if (accounts && accounts.length > 0) {
      const separator = document.createElement('option');
      separator.disabled = true;
      separator.textContent = "──────────";
      accountDropdown.appendChild(separator);
    }

    // Add each account as an option
    accounts.forEach(account => {
      const option = document.createElement('option');
      option.value = account.id;

      // Format display text with balance
      const formattedBalance = parseFloat(account.balance).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

      option.textContent = `${account.accountName} (₱${formattedBalance})`;
      accountDropdown.appendChild(option);
    });
  } catch (error) {
    console.error('Error populating account dropdown:', error);
  }
}

// Update the add bank form submission handler
const addBankForm = document.getElementById('add-bank-form');
if (addBankForm) {
  addBankForm.addEventListener('submit', async function (e) {
  e.preventDefault();

  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user logged in');
    }

    // Clear any previous validation errors
    clearAllValidationErrors(this);

    // Get and validate form fields
    const accountTypeField = document.getElementById('account-type');
    const bankNameField = document.getElementById('bank-name');
    const cardNameField = document.getElementById('card-name');
    const cardNumberField = document.getElementById('card-number');
    const balanceField = document.getElementById('balance');
    const currencyField = document.getElementById('currency');

    // Validate balance
    if (!balanceField || !balanceField.value) {
      throw new Error('Balance is required');
    }

    const balance = parseFloat(balanceField.value);
    if (isNaN(balance)) {
      throw new Error('Invalid balance amount');
    }

    // Submit button state
    const submitBtn = this.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding Account...';
    }

    // Prepare account data
    const accountId = `acc_${Date.now()}`;
    let accountName;

    if (accountTypeField?.value === 'ewallet') {
      const ewalletProvider = document.getElementById('ewallet-provider');
      if (ewalletProvider.value === 'other') {
        accountName = document.getElementById('other-provider')?.value?.trim() || 'E-Wallet';
      } else {
        accountName = ewalletProvider.options[ewalletProvider.selectedIndex].text;
      }
    } else {
      accountName = bankNameField?.value?.trim() || 'My Account';
    }

    const accountData = {
      id: accountId,
      accountType: accountTypeField?.value || 'bank',
      currency: currencyField?.value || 'PHP',
      cardNumber: cardNumberField?.value?.trim() || '0000000000000000',
      cardName: cardNameField?.value?.trim() || 'Account Owner',
      balance: balance,
      createdAt: new Date().toISOString(),
      userId: user.uid,
      accountName: accountName
    };

    // Store in Firestore
    await storeBankAccount(user.uid, accountData);

    // Reset form and close modal
    this.reset();
    const modal = document.getElementById('add-bank-modal');
    if (modal) {
      modal.style.display = 'none';
    }

    // Update UI
    await renderBankCards();

    // Give the DOM time to update before calculating totals
    requestAnimationFrame(() => {
      updateBalanceSummary();
    });

    // Show success message
    alert('Account added successfully!');

  } catch (error) {
    console.error('Error adding account:', error);
    alert(error.message || 'Failed to add account');
  } finally {
    // Reset submit button state
    const submitBtn = this.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Add Account';
    }
  }
  });
}

// Note: Close button handlers are now in the main DOMContentLoaded listener to avoid conflicts

// Update the delete account function
async function deleteAccount(accountId) {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user logged in');
    }

    // Delete from Firestore
    const accountRef = doc(db, 'users', user.uid, 'bankAccounts', accountId);
    await deleteDoc(accountRef);
    console.log('Account deleted from Firestore');

    // Re-render the cards
    await renderBankCards();

    // Show empty state if no accounts left
    const accounts = await getUserBankAccounts(user.uid);
    const emptyStateContainer = document.querySelector('.empty-state-container');
    if (accounts.length === 0 && emptyStateContainer) {
      emptyStateContainer.style.display = 'block';
    }

    // Refresh financial health
    refreshFinancialHealth();

    return true;

  } catch (error) {
    console.error('Error deleting account:', error);
    throw error;
  }
}

// Add this function to render recent transactions in the dashboard widget
function renderRecentTransactions(transactions) {
  const recentTransactionsContainer = document.getElementById('recent-transactions');

  if (!recentTransactionsContainer) {
    console.log('Recent transactions container not found - may not be on this page');
    return;
  }

  // Clear existing content
  recentTransactionsContainer.innerHTML = '';

  // If no transactions, show empty state
  if (!transactions || transactions.length === 0) {
    recentTransactionsContainer.innerHTML = '<p class="empty-state">No recent transactions to display</p>';
    return;
  }

  // Filter out invalid transactions and get only the 3 most recent
  const validTransactions = transactions.filter(transaction => 
    transaction && 
    transaction.date && 
    transaction.name && 
    typeof transaction.amount !== 'undefined'
  );

  if (validTransactions.length === 0) {
    recentTransactionsContainer.innerHTML = '<p class="empty-state">No valid transactions to display</p>';
    return;
  }

  const recentTransactions = [...validTransactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  // Create and append transaction items
  recentTransactions.forEach(transaction => {
    try {
      const transactionEl = document.createElement('div');
      const transactionType = transaction.type || 'expense';
      transactionEl.className = `transaction-item ${transactionType}`;

      // Safely parse amount
      const amount = parseFloat(transaction.amount) || 0;
      
      // Format amount with proper currency symbol
      const amountText = amount >= 0
        ? `+₱${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        : `-₱${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

      // Get appropriate icon based on category
      const category = transaction.category || 'other';
      const categoryIcon = getCategoryIcon(category);
      const name = transaction.name || 'Unknown Transaction';

      // Safely parse date
      let formattedDate = 'Unknown Date';
      try {
        const transactionDate = new Date(transaction.date);
        if (!isNaN(transactionDate.getTime())) {
          formattedDate = formatDate(transactionDate);
        }
      } catch (dateError) {
        console.warn('Error parsing transaction date:', transaction.date);
      }

      transactionEl.innerHTML = `
        <div class="transaction-icon ${category}">
          <i class="${categoryIcon}"></i>
        </div>
        <div class="transaction-details">
          <span class="transaction-name">${name}</span>
          <span class="transaction-date">${formattedDate}</span>
        </div>
        <div class="transaction-amount ${amount >= 0 ? 'positive' : 'negative'}">
          ${amountText}
        </div>
      `;

      recentTransactionsContainer.appendChild(transactionEl);
    } catch (error) {
      console.error('Error rendering transaction:', transaction, error);
    }
  });
}

// Helper function to get category icon
function getCategoryIcon(category) {
  const icons = {
    'food': 'fas fa-utensils',
    'shopping': 'fas fa-shopping-bag',
    'bills': 'fas fa-file-invoice',
    'transportation': 'fas fa-car',
    'entertainment': 'fas fa-film',
    'housing': 'fas fa-home',
    'health': 'fas fa-heartbeat',
    'education': 'fas fa-graduation-cap',
    'income': 'fas fa-money-bill-wave',
    'other': 'fas fa-receipt'
  };

  return icons[category] || 'fas fa-receipt';
}

// Helper function to format date
function formatDate(date) {
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

async function updateBalanceSummary() {
  try {
    console.log('=== updateBalanceSummary DEBUG START ===');
    console.log('Running updateBalanceSummary function');
    // Get the current user
    const user = auth.currentUser;
    if (!user) {
      console.error('No user logged in');
      return;
    }
    console.log('User authenticated:', user.uid);

    // Get transactions first - this is our primary source of balance calculation
    console.log('Fetching transactions...');
    const transactions = await getUserTransactions(user.uid);
    console.log('Transactions fetched:', transactions ? transactions.length : 0, transactions);
    
    let totalIncome = 0;
    let totalExpenses = 0;
    let currentBalance = 0;  // This will be our main balance (income - expenses)
    
    if (transactions && transactions.length > 0) {
      console.log('Processing transactions for balance calculation:');
      transactions.forEach((transaction, index) => {
        const amount = parseFloat(transaction.amount || 0);
        console.log(`Transaction ${index + 1}:`, {
          name: transaction.name,
          type: transaction.type,
          amount: transaction.amount,
          parsedAmount: amount
        });
        
        if (!isNaN(amount)) {
          if (transaction.type === 'income') {
            // Income amounts - always use absolute value to ensure positive
            const incomeAmount = Math.abs(amount);
            totalIncome += incomeAmount;
            console.log(`  -> Added ${incomeAmount} to income, total income now: ${totalIncome}`);
          } else if (transaction.type === 'expense') {
            // Expense amounts - always use absolute value for display
            const expenseAmount = Math.abs(amount);
            totalExpenses += expenseAmount;
            console.log(`  -> Added ${expenseAmount} to expenses, total expenses now: ${totalExpenses}`);
          }
        }
      });
      
      // Calculate current balance as income minus expenses (same as transactions page)
      currentBalance = totalIncome - totalExpenses;
      console.log('Calculated current balance (income - expenses):', currentBalance);
    } else {
      console.log('No transactions found, balance will be 0');
    }

    // Get bank cards for account count (but not for balance calculation)
    const bankCards = document.querySelectorAll('.bank-card:not(.add-card)');
    const accountCount = bankCards.length;
    console.log('Found bank cards for count:', accountCount);
    
    console.log('Final totals:', { 
      totalIncome, 
      totalExpenses, 
      currentBalance,
      accountCount 
    });

    // Format balance with currency symbol and thousands separators
    const formattedBalance = `₱${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formattedIncome = `₱${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formattedExpenses = `₱${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    console.log('Formatted values:', { formattedBalance, formattedIncome, formattedExpenses });

    // Update all balance displays across the dashboard
    const balanceElements = [
      'total-balance-amount',   // The accounts page balance
      'welcome-balance-amount'  // The welcome banner balance
    ];

    balanceElements.forEach(id => {
      const element = document.getElementById(id);
      console.log(`Updating balance element ${id}:`, element ? 'found' : 'not found');
      if (element) {
        // Check if the value has changed
        const currentValue = element.textContent.trim();
        const currentBalanceNum = parseFloat(currentValue.replace(/[₱,\s]/g, '')) || 0;
        console.log(`Current balance for ${id}:`, currentBalanceNum, 'New balance:', currentBalance);
        
        // Update the element
        element.textContent = formattedBalance;
        console.log(`Updated ${id} to:`, formattedBalance);
        
        // Add highlight effect if the balance has changed
        if (Math.abs(currentBalanceNum - currentBalance) > 0.01) {
          console.log(`Adding highlight effect to ${id}`);
          element.classList.add('balance-updated');
          setTimeout(() => {
            element.classList.remove('balance-updated');
          }, 2000);
        }
      }
    });
    
    // Direct update to welcome banner as a fallback
    const welcomeBalanceElement = document.getElementById('welcome-balance-amount');
    if (welcomeBalanceElement) {
      console.log('Direct update to welcome banner balance:', formattedBalance);
      welcomeBalanceElement.textContent = formattedBalance;
      console.log('Welcome banner element after update:', welcomeBalanceElement.textContent);
    } else {
      console.error('Welcome balance element not found!');
    }

    // Update income and expense displays
    const incomeElement = document.getElementById('total-income-amount');
    if (incomeElement) {
      incomeElement.textContent = formattedIncome;
      console.log('Updated total income display:', formattedIncome);
    }

    const expensesElement = document.getElementById('total-expenses-amount');
    if (expensesElement) {
      expensesElement.textContent = formattedExpenses;
      console.log('Updated total expenses display:', formattedExpenses);
    }

    const totalAccountsElement = document.getElementById('total-accounts');
    if (totalAccountsElement) {
      totalAccountsElement.textContent = accountCount.toString();
      console.log('Updated total accounts count:', accountCount);
    }

    console.log('Balance summary updated successfully:', { 
      currentBalance, 
      totalIncome, 
      totalExpenses, 
      accountCount 
    });
    console.log('=== updateBalanceSummary DEBUG END ===');
  } catch (error) {
    console.error('Error updating balance summary:', error);
    // Don't throw the error - just log it to prevent form submission from failing
  }
}

// Function to refresh financial health data
function refreshFinancialHealth() {
  try {
    // Check if financial health element exists before dispatching event
    const financialHealthElement = document.getElementById('financial-health-content');
    if (financialHealthElement) {
      // Dispatch a custom event that the financial health module will listen for
      const refreshEvent = new CustomEvent('refreshFinancialHealth');
      document.dispatchEvent(refreshEvent);
      console.log('Financial health refresh triggered');
    } else {
      console.log('ℹ️ Financial health widget not found on this page');
    }
  } catch (error) {
    console.error('Error refreshing financial health:', error);
  }
}

// Initialize transaction form handling
function initializeTransactionForm() {
  const addTransactionForm = document.getElementById('add-transaction-form');
  const addTransactionButton = document.getElementById('add-transaction-button');
  const addTransactionModal = document.getElementById('add-transaction-modal');
  const closeTransactionModal = document.getElementById('close-add-transaction');
  const cancelTransactionButton = document.getElementById('cancel-add-transaction');

  // Open modal
  if (addTransactionButton) {
    addTransactionButton.addEventListener('click', () => {
      if (addTransactionModal) {
        addTransactionModal.style.display = 'flex';
        // Set default date to today
        const dateInput = document.getElementById('transaction-date');
        if (dateInput) {
          dateInput.value = new Date().toISOString().split('T')[0];
        }
        // Set default time to now
        const timeInput = document.getElementById('transaction-time');
        if (timeInput) {
          const now = new Date();
          timeInput.value = now.toTimeString().slice(0, 5);
        }
        // Populate account dropdown
        populateAccountDropdown();
      }
    });
  }

  // Close modal
  if (closeTransactionModal) {
    closeTransactionModal.addEventListener('click', () => {
      if (addTransactionModal) {
        addTransactionModal.style.display = 'none';
      }
    });
  }

  if (cancelTransactionButton) {
    cancelTransactionButton.addEventListener('click', () => {
      if (addTransactionModal) {
        addTransactionModal.style.display = 'none';
      }
    });
  }

  // Handle form submission
  if (addTransactionForm) {
    addTransactionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error('No user logged in');
        }

        // Get form data
        const formData = {
          id: `transaction_${Date.now()}`,
          name: document.getElementById('transaction-name').value.trim(),
          amount: parseFloat(document.getElementById('transaction-amount').value),
          type: document.getElementById('transaction-type').value,
          account: document.getElementById('transaction-account').value,
          date: document.getElementById('transaction-date').value,
          time: document.getElementById('transaction-time').value,
          channel: document.getElementById('transaction-channel').value,
          category: document.getElementById('transaction-category').value,
          notes: document.getElementById('transaction-notes').value.trim(),
          timestamp: new Date().toISOString()
        };

        // Validate required fields
        if (!formData.name) {
          throw new Error('Transaction name is required');
        }
        if (!formData.amount || formData.amount <= 0) {
          throw new Error('Valid amount is required');
        }
        if (!formData.type) {
          throw new Error('Transaction type is required');
        }
        if (!formData.date) {
          throw new Error('Date is required');
        }

        // Show loading state
        const submitButton = addTransactionForm.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        submitButton.disabled = true;

        // Store transaction in Firestore
        await storeTransaction(user.uid, formData);
        
        console.log('Transaction stored successfully:', formData);

        // Dispatch event to notify financial health module
        const transactionAddedEvent = new CustomEvent('transactionAdded', {
          detail: formData
        });
        document.dispatchEvent(transactionAddedEvent);
        console.log('Transaction added event dispatched');

        // Refresh financial health
        refreshFinancialHealth();

        // Update balance summary
        await updateBalanceSummary();

        // Reload transactions if on transactions page
        const transactionsPage = document.getElementById('transactions-page');
        if (transactionsPage && transactionsPage.style.display !== 'none') {
          await loadTransactions();
        }

        // Close modal and reset form
        addTransactionModal.style.display = 'none';
        addTransactionForm.reset();

        // Show success message
        console.log('Transaction added successfully!');

      } catch (error) {
        console.error('Error adding transaction:', error);
        alert('Error adding transaction: ' + error.message);
      } finally {
        // Restore button state
        const submitButton = addTransactionForm.querySelector('button[type="submit"]');
        if (submitButton) {
          submitButton.innerHTML = 'Add Transaction';
          submitButton.disabled = false;
        }
      }
    });
  }
}

// Removed duplicate function - keeping the one at line 1257

// Initialize bank form handling
function initializeBankForm() {
  const addBankForm = document.getElementById('add-bank-form');
  const addBankModal = document.getElementById('add-bank-modal');
  const closeBankModal = document.getElementById('close-add-bank');
  const cancelBankButton = document.getElementById('cancel-add-bank');

  // Close modal handlers
  if (closeBankModal) {
    closeBankModal.addEventListener('click', () => {
      if (addBankModal) {
        addBankModal.style.display = 'none';
      }
    });
  }

  if (cancelBankButton) {
    cancelBankButton.addEventListener('click', () => {
      if (addBankModal) {
        addBankModal.style.display = 'none';
      }
    });
  }

  // Handle form submission
  if (addBankForm) {
    addBankForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error('No user logged in');
        }

        // Get form data
        const accountType = document.getElementById('account-type').value;
        const currency = document.getElementById('currency').value;
        const cardNumber = document.getElementById('card-number').value.trim();
        const cardName = document.getElementById('card-name').value.trim();
        const balance = parseFloat(document.getElementById('balance').value) || 0;

        let accountData = {
          id: `account_${Date.now()}`,
          accountType: accountType,
          currency: currency,
          cardNumber: cardNumber,
          cardName: cardName,
          balance: balance,
          createdAt: new Date().toISOString()
        };

        // Add specific fields based on account type
        if (accountType === 'bank') {
          const bankName = document.getElementById('bank-name').value.trim();
          if (!bankName) {
            throw new Error('Bank name is required');
          }
          accountData.bankName = bankName;
          accountData.accountName = `${bankName} - ${cardName}`;
        } else if (accountType === 'ewallet') {
          const ewalletProvider = document.getElementById('ewallet-provider').value;
          let providerName = ewalletProvider;
          
          if (ewalletProvider === 'other') {
            const otherProvider = document.getElementById('other-provider').value.trim();
            if (!otherProvider) {
              throw new Error('Please specify the e-wallet provider');
            }
            providerName = otherProvider;
          }
          
          accountData.ewalletProvider = providerName;
          accountData.accountName = `${providerName} - ${cardName}`;
        }

        // Validate required fields
        if (!cardNumber) {
          throw new Error('Card/Account number is required');
        }
        if (!cardName) {
          throw new Error('Name on card/account is required');
        }

        // Show loading state
        const submitButton = addBankForm.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        submitButton.disabled = true;

        // Store account in Firestore
        await storeBankAccount(user.uid, accountData);
        
        console.log('Bank account stored successfully:', accountData);

        // Dispatch event to notify financial health module
        const bankAccountAddedEvent = new CustomEvent('bankAccountAdded', {
          detail: accountData
        });
        document.dispatchEvent(bankAccountAddedEvent);
        console.log('Bank account added event dispatched');

        // Refresh financial health
        refreshFinancialHealth();

        // Update balance summary
        await updateBalanceSummary();

        // Re-render bank cards
        await renderBankCards();

        // Close modal and reset form
        addBankModal.style.display = 'none';
        addBankForm.reset();

        // Reset form fields to default state
        document.getElementById('bank-fields').style.display = 'block';
        document.getElementById('ewallet-fields').style.display = 'none';
        document.getElementById('other-provider-field').style.display = 'none';

        console.log('Bank account added successfully!');

      } catch (error) {
        console.error('Error adding bank account:', error);
        alert('Error adding account: ' + error.message);
      } finally {
        // Restore button state
        const submitButton = addBankForm.querySelector('button[type="submit"]');
        if (submitButton) {
          submitButton.innerHTML = 'Add Account';
          submitButton.disabled = false;
        }
      }
    });
  }
}

// Handle financial form submission
document.addEventListener('DOMContentLoaded', () => {
  // ... existing code ...

  // Handle financial form submission
  const financialForm = document.getElementById('financial-form');
  if (financialForm) {
    financialForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      try {
        // We've already imported these functions at the top of the file
        const user = auth.currentUser;
        if (!user) {
          throw new Error('No user logged in');
        }

        // Clear any previous validation errors
        clearAllValidationErrors(this);

        // Get form fields
        const monthlyIncomeField = document.getElementById('monthly-income');
        const governmentIdField = document.getElementById('government-id');
        const addressProofField = document.getElementById('address-proof');
        const incomeProofField = document.getElementById('income-proof');
        const taxReturnField = document.getElementById('tax-return');

        // Validate monthly income (required, must be a positive number)
        const monthlyIncomeValidation = validateAmount(monthlyIncomeField.value);
        if (!monthlyIncomeValidation.isValid) {
          showValidationError(this, 'monthly-income', monthlyIncomeValidation.error);
          monthlyIncomeField.focus();
          return;
        }

        // Validate file uploads
        if (!governmentIdField.files.length) {
          showValidationError(this, 'government-id', 'Please upload a valid government ID');
          governmentIdField.focus();
          return;
        }

        if (!addressProofField.files.length) {
          showValidationError(this, 'address-proof', 'Please upload a proof of address');
          addressProofField.focus();
          return;
        }

        if (!incomeProofField.files.length) {
          showValidationError(this, 'income-proof', 'Please upload a proof of income');
          incomeProofField.focus();
          return;
        }

        if (!taxReturnField.files.length) {
          showValidationError(this, 'tax-return', 'Please upload your tax return');
          taxReturnField.focus();
          return;
        }

        // Validate file types and sizes
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        const maxFileSize = 5 * 1024 * 1024; // 5MB

        const files = [
          { field: 'government-id', file: governmentIdField.files[0] },
          { field: 'address-proof', file: addressProofField.files[0] },
          { field: 'income-proof', file: incomeProofField.files[0] },
          { field: 'tax-return', file: taxReturnField.files[0] }
        ];

        for (const { field, file } of files) {
          if (!allowedTypes.includes(file.type)) {
            showValidationError(this, field, 'Invalid file type. Please upload a JPEG, PNG, GIF, or PDF file.');
            document.getElementById(field).focus();
            return;
          }

          if (file.size > maxFileSize) {
            showValidationError(this, field, 'File is too large. Maximum size is 5MB.');
            document.getElementById(field).focus();
            return;
          }
        }

        // Show loading state
        const submitButton = this.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        submitButton.disabled = true;

        // Create a reference to the user's documents in Firebase Storage
        const storageRef = ref(storage, `users/${user.uid}/verification`);

        // Upload files and get their URLs
        const [
          governmentIdUrl,
          addressProofUrl,
          incomeProofUrl,
          taxReturnUrl
        ] = await Promise.all([
          uploadFile(storageRef, 'government-id', governmentIdField.files[0]),
          uploadFile(storageRef, 'address-proof', addressProofField.files[0]),
          uploadFile(storageRef, 'income-proof', incomeProofField.files[0]),
          uploadFile(storageRef, 'tax-return', taxReturnField.files[0])
        ]);

        // Update user's financial information in Firestore
        const financialData = {
          monthlyIncome: monthlyIncomeValidation.value,
          documents: {
            governmentId: governmentIdUrl,
            addressProof: addressProofUrl,
            incomeProof: incomeProofUrl,
            taxReturn: taxReturnUrl
          },
          verificationStatus: 'pending',
          submittedAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'users', user.uid, 'financial_verification'), financialData);

        // Show success message
        showSuccessMessage('Documents uploaded successfully! They will be reviewed within 2-3 business days.');

        // Reset form
        this.reset();

      } catch (error) {
        console.error('Error submitting financial information:', error);
        showErrorMessage('Error submitting documents: ' + error.message);
      } finally {
        // Restore button state
        const submitButton = this.querySelector('button[type="submit"]');
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
      }
    });

    // Add file upload preview functionality
    const fileInputs = financialForm.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
      input.addEventListener('change', function (e) {
        const fileInfo = this.closest('.file-upload-container').querySelector('.file-upload-info');
        if (this.files && this.files[0]) {
          const fileName = this.files[0].name;
          fileInfo.innerHTML = `
                        <i class="fas fa-check-circle" style="color: #10df6f;"></i>
                        <span>${fileName}</span>
                    `;
        }
      });
    });
  }
});

// Helper function to upload a file to Firebase Storage
async function uploadFile(storageRef, path, file) {
  const fileRef = ref(storageRef, path);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}

// The loadTransactions function is already defined above

// Add new function to show transaction details
function showTransactionDetails(transactionId, transactions) {
  // Find the transaction by ID
  const transaction = transactions.find(t => t.id === transactionId);
  if (!transaction) return;

  // Get the modal and set the transaction ID for future use
  const modal = document.getElementById('transaction-details-modal');
  if (!modal) return;

  modal.dataset.transactionId = transactionId;

  // Fill in the details
  document.getElementById('view-transaction-name').textContent = transaction.name || 'N/A';
  document.getElementById('view-transaction-amount').textContent = `${transaction.type === 'income' ? '+' : '-'}₱${Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('view-transaction-amount').className = transaction.type === 'income' ? 'detail-value positive' : 'detail-value negative';

  // Display account information if available
  const accountElement = document.getElementById('view-transaction-account');
  if (transaction.isNoAccount || !transaction.accountId) {
    accountElement.textContent = 'No Account (Cash Transaction)';
  } else {
    // Try to get account name from active accounts
    getUserBankAccounts(auth.currentUser.uid).then(accounts => {
      const account = accounts.find(a => a.id === transaction.accountId);
      if (account) {
        accountElement.textContent = account.accountName || 'Unknown Account';
      } else {
        accountElement.textContent = 'Account ID: ' + transaction.accountId;
      }
    }).catch(err => {
      console.error('Error getting account details:', err);
      accountElement.textContent = 'Account ID: ' + transaction.accountId;
    });
  }

  // Display the formatted date
  const dateObj = new Date(transaction.date);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  document.getElementById('view-transaction-date').textContent = formattedDate;

  // Set other fields
  document.getElementById('view-transaction-channel').textContent = transaction.channel || 'N/A';
  document.getElementById('view-transaction-category').textContent = transaction.category || 'N/A';

  // Show the type 
  const typeElement = document.getElementById('view-transaction-status');
  typeElement.textContent = transaction.type === 'income' ? 'Income' : 'Expense';
  typeElement.className = `detail-value transaction-type ${transaction.type}`;

  // Set notes if available
  document.getElementById('view-transaction-notes').textContent = transaction.notes || 'No notes';

  // Show the modal
  modal.style.display = 'flex';
}

// Add the editTransaction function (referenced in the HTML)
function editTransaction(transactionId) {
  // This function can be implemented later
  console.log('Edit transaction:', transactionId);
  // Hide the details modal
  document.getElementById('transaction-details-modal').style.display = 'none';
}

// Add a secure logout function
function secureLogout() {
  // Clear all sensitive data from storage
  secureStorage.clearAll();

  // Sign out from Firebase
  signOut(auth).then(() => {
    window.location.href = "login.html";
  }).catch((error) => {
    console.error("Error signing out:", error);
    // Force redirect even if there's an error
    window.location.href = "login.html";
  });
}

// When displaying sensitive data like bank account details, implement additional security
function showSensitiveData(element, data) {
  // Only display when user is actively viewing
  if (element && data) {
    // Mask sensitive data
    if (typeof data === 'string' && data.length > 4) {
      // For card numbers, account numbers, etc.
      const lastFour = data.slice(-4);
      const masked = '•'.repeat(data.length - 4) + lastFour;
      element.textContent = masked;

      // Add option to temporarily reveal with additional auth
      const revealButton = document.createElement('button');
      revealButton.className = 'reveal-btn';
      revealButton.innerHTML = '<i class="fas fa-eye"></i>';
      revealButton.title = 'Reveal (requires authentication)';

      revealButton.addEventListener('click', () => {
        // Ask for authentication before revealing
        requestAuthentication(() => {
          // Temporarily show the actual data
          element.textContent = data;

          // Hide it again after a short time
          setTimeout(() => {
            element.textContent = masked;
          }, 5000); // Show for 5 seconds
        });
      });

      // Append button next to element
      element.parentNode.insertBefore(revealButton, element.nextSibling);
    }
  }
}

// Function to request authentication before showing sensitive data
function requestAuthentication(onSuccess) {
  // Create modal for password verification
  const modal = document.createElement('div');
  modal.className = 'auth-modal';
  modal.innerHTML = `
    <div class="auth-modal-content">
      <h3>Verify Identity</h3>
      <p>Please enter your password to view sensitive information</p>
      <input type="password" id="auth-password" placeholder="Password">
      <div class="auth-buttons">
        <button id="auth-cancel">Cancel</button>
        <button id="auth-confirm">Confirm</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add event listeners
  const authCancelBtn = document.getElementById('auth-cancel');
  if (authCancelBtn) {
    authCancelBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  }

  const authConfirmBtn = document.getElementById('auth-confirm');
  if (authConfirmBtn) {
    authConfirmBtn.addEventListener('click', async () => {
    const password = document.getElementById('auth-password').value;
    const user = auth.currentUser;

    if (user && password) {
      try {
        // Reauthenticate the user
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);

        // Remove modal and call success callback
        document.body.removeChild(modal);
        onSuccess();
      } catch (error) {
        alert('Authentication failed. Please try again.');
        console.error('Reauthentication error:', error);
      }
    } else {
      alert('Please enter your password.');
    }
    });
  }
}

// Add event listener to re-populate account dropdown when transaction type changes
const transactionTypeSelect = document.getElementById('transaction-type');
if (transactionTypeSelect) {
  transactionTypeSelect.addEventListener('change', function () {
    populateAccountDropdown();
  });
}

// Add sample data for testing (can be removed later)
async function addSampleTransactions() {
  try {
    const user = auth.currentUser;
    if (!user) return;

    // Check if sample data already exists
    const existingTransactions = await getUserTransactions(user.uid);
    if (existingTransactions && existingTransactions.length > 0) {
      console.log('Sample transactions already exist, skipping...');
      return;
    }

    const sampleTransactions = [
      {
        id: `transaction_${Date.now()}_1`,
        name: "Grocery Shopping - SM Supermarket",
        amount: 2500,
        type: "expense",
        account: "cash",
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days ago
        time: "14:30",
        channel: "in-store",
        category: "food",
        notes: "Weekly grocery shopping",
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: `transaction_${Date.now()}_2`,
        name: "Salary - Company ABC",
        amount: 35000,
        type: "income",
        account: "cash",
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days ago
        time: "09:00",
        channel: "transfer",
        category: "income",
        notes: "Monthly salary",
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: `transaction_${Date.now()}_3`,
        name: "Electric Bill - Meralco",
        amount: 3200,
        type: "expense",
        account: "cash",
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 day ago
        time: "16:45",
        channel: "online",
        category: "bills",
        notes: "Monthly electric bill",
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: `transaction_${Date.now()}_4`,
        name: "Coffee - Starbucks",
        amount: 180,
        type: "expense",
        account: "cash",
        date: new Date().toISOString().split('T')[0], // Today
        time: "08:15",
        channel: "in-store",
        category: "food",
        notes: "Morning coffee",
        timestamp: new Date().toISOString()
      },
      {
        id: `transaction_${Date.now()}_5`,
        name: "Jeepney Fare",
        amount: 25,
        type: "expense",
        account: "cash",
        date: new Date().toISOString().split('T')[0], // Today
        time: "07:30",
        channel: "other",
        category: "transportation",
        notes: "Commute to work",
        timestamp: new Date().toISOString()
      }
    ];

    console.log('Adding sample transactions for testing...');
    
    for (const transaction of sampleTransactions) {
      await storeTransaction(user.uid, transaction);
      console.log('Added sample transaction:', transaction.name);
    }

    // Dispatch events to update the UI
    const transactionAddedEvent = new CustomEvent('transactionAdded');
    document.dispatchEvent(transactionAddedEvent);
    
    refreshFinancialHealth();
    await updateBalanceSummary();

    console.log('Sample transactions added successfully!');
    
  } catch (error) {
    console.error('Error adding sample transactions:', error);
  }
}

// Function to show the chatbot with a specific agent context or redirect to dedicated agent pages
function showChatbot(agentType) {
  // Special case for Ipon Coach - redirect to dedicated page
  if (agentType === 'ipon-coach') {
    window.location.href = './agents/iponCoach.html';
    return;
  }
  
  const chatbotWindow = document.getElementById('chatbotWindow');
  const chatMessages = document.getElementById('chatMessages');

  if (!chatbotWindow || !chatMessages) return;

  // Clear previous messages
  chatMessages.innerHTML = '';

  // Add a welcome message based on the agent type
  let welcomeMessage = '';

  switch (agentType) {
    case 'expense-forecaster':
      welcomeMessage = 'Hello! I\'m your Expense Forecasting Agent. I can help you predict upcoming expenses and plan for your financial future. How can I assist you today?';
      break;
    case 'subscription-manager':
      welcomeMessage = 'Hi there! I\'m your Subscription Manager. I can help you track recurring payments, identify unused subscriptions, and find better alternatives. How can I assist you?';
      break;
    case 'financial-time-machine':
      welcomeMessage = 'Welcome to the Financial Time Machine! I can help you explore alternate financial timelines, visualize the impact of different choices, and gain insights from your financial what-if scenarios. How would you like to travel through your financial past and future today?';
      break;
    default:
      welcomeMessage = 'Hello! How can I help you with your finances today?';
  }

  // Add welcome message
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', 'bot-message');
  messageDiv.innerHTML = welcomeMessage;
  chatMessages.appendChild(messageDiv);

  // Show the chatbot window with animation
  chatbotWindow.style.display = 'block';
  setTimeout(() => {
    chatbotWindow.style.opacity = '1';
    chatbotWindow.style.transform = 'translateY(0)';
    chatbotWindow.classList.add('active');
  }, 10);
}

