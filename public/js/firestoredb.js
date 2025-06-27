// Firebase Firestore utility functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc, query, where, limit, orderBy } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

console.log("Firebase initialized in firestoredb.js");

// Export Firebase instances
export { auth };

// Export Firestore functions
export { doc, setDoc, getDocs, collection, deleteDoc, db, updateDoc };

// Security helper functions
function getCurrentUserId() {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("User not authenticated");
    }
    return user.uid;
}

// Helper function to wait for auth state to be ready
function waitForAuthState(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        let timeoutId;
        
        // If already authenticated, resolve immediately
        if (auth.currentUser) {
            console.log('Auth state already ready, user:', auth.currentUser.uid);
            resolve(auth.currentUser);
            return;
        }
        
        console.log('Waiting for auth state to be ready...');
        
        const unsubscribe = auth.onAuthStateChanged((user) => {
            console.log('Auth state changed during wait:', user ? user.uid : 'null');
            if (timeoutId) clearTimeout(timeoutId);
            unsubscribe();
            resolve(user);
        });
        
        // Set a timeout to prevent infinite waiting
        timeoutId = setTimeout(() => {
            console.log('Auth state timeout reached');
            unsubscribe();
            reject(new Error('Authentication state timeout'));
        }, timeoutMs);
    });
}

// Helper function to get user's ID token for debugging
async function getUserIdToken() {
    try {
        const user = auth.currentUser;
        if (!user) {
            return null;
        }
        const token = await user.getIdToken();
        return token;
    } catch (error) {
        console.error('Error getting ID token:', error);
        return null;
    }
}

function validateUserAccess(requestUserId) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.error('validateUserAccess - No user authenticated');
        throw new Error('User not authenticated');
    }
    
    if (currentUser.uid !== requestUserId) {
        console.error('validateUserAccess - User ID mismatch:', {
            currentUser: currentUser.uid,
            requestUserId: requestUserId
        });
        throw new Error('Unauthorized access: User ID mismatch');
    }
    
    console.log('validateUserAccess - Access granted for userId:', requestUserId);
    return true;
}

// Store user data in Firestore
export async function storeUserData(userId, userData) {
    try {
        console.log('Starting storeUserData...'); // Debug log

        // Validate user is authorized to modify this data
        try {
            validateUserAccess(userId);
            console.log('User access validated'); // Debug log
        } catch (authError) {
            console.error('Authorization error:', authError);
            throw new Error('Authorization failed: ' + authError.message);
        }

        // Get existing user data first
        try {
            const docRef = doc(db, "users", userId);
            const docSnap = await getDoc(docRef);
            const existingData = docSnap.exists() ? docSnap.data() : {};
            console.log('Retrieved existing data:', existingData); // Debug log

            // Merge the data
            const enrichedUserData = {
                ...existingData,
                ...userData,
                userId,
                updatedAt: new Date().toISOString()
            };

            console.log('Attempting to save data:', enrichedUserData); // Debug log

            // Store the merged data
            await setDoc(docRef, enrichedUserData);
            console.log('Data successfully saved to Firestore'); // Debug log
            return true;
        } catch (firestoreError) {
            console.error('Firestore operation error:', firestoreError);
            throw new Error('Database error: ' + firestoreError.message);
        }
    } catch (error) {
        console.error('storeUserData error:', error);
        throw error; // Propagate the detailed error
    }
}

// Retrieve user data from Firestore
export async function getUserData(userId) {
    try {
        // Validate user is authorized to access this data
        validateUserAccess(userId);

        const docRef = doc(db, "users", userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log("User data retrieved from Firestore");
            return docSnap.data();
        } else {
            console.log("No user data found in Firestore");
            return null;
        }
    } catch (error) {
        console.error("Error retrieving user data from Firestore: ", error);
        return null;
    }
}

// Add a new function to update password status
export async function updatePasswordStatus(userId, hasPassword) {
    try {
        // Validate user is authorized to modify this data
        validateUserAccess(userId);

        await setDoc(doc(db, "users", userId), {
            hasPassword,
            userId // Include userId for security rule validation
        }, { merge: true });
        return true;
    } catch (error) {
        console.error("Error updating password status: ", error);
        return false;
    }
}

// Store transaction in Firestore
export async function storeTransaction(userId, transactionData) {
    try {
        console.log('🔄 Starting storeTransaction with userId:', userId);
        console.log('📝 Transaction data to store:', transactionData);

        // Validate user is authorized to modify this data
        try {
            console.log('🔐 Validating user access for userId:', userId);
            console.log('🔐 Current auth user:', auth.currentUser ? auth.currentUser.uid : 'null');
            validateUserAccess(userId);
            console.log('✅ User access validation passed for transaction');
        } catch (authError) {
            console.error('❌ Authorization error for transaction:', authError);
            console.error('❌ Auth error details:', {
                providedUserId: userId,
                currentUserId: auth.currentUser ? auth.currentUser.uid : 'null',
                errorMessage: authError.message
            });
            throw new Error('Authorization failed: ' + authError.message);
        }

        // Enhanced validation - check all required fields
        if (!transactionData.id) {
            throw new Error('Transaction ID is required');
        }
        if (!transactionData.description || transactionData.description.trim() === '') {
            throw new Error('Transaction description is required');
        }
        if (transactionData.amount === undefined || transactionData.amount === null) {
            throw new Error('Transaction amount is required');
        }
        if (isNaN(parseFloat(transactionData.amount))) {
            throw new Error('Transaction amount must be a valid number');
        }
        if (!transactionData.type || !['income', 'expense'].includes(transactionData.type)) {
            throw new Error('Transaction type must be either "income" or "expense"');
        }
        if (!transactionData.date) {
            throw new Error('Transaction date is required');
        }
        if (!transactionData.accountId) {
            throw new Error('Transaction must be associated with an account');
        }

        // Create Firestore document reference
        const docRef = doc(db, "users", userId, "transactions", transactionData.id);
        console.log('📄 Document reference created for path:', docRef.path);

        // Get current user info for audit trail
        const currentUser = auth.currentUser;
        const userInfo = {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName || 'Unknown'
        };

        // Add comprehensive audit trail and security data
        const finalTransactionData = {
            ...transactionData,
            // Core identifiers
            userId,
            transactionId: transactionData.id,
            
            // Financial data (validated)
            amount: parseFloat(transactionData.amount),
            
            // Audit trail
            createdBy: userInfo,
            createdAt: new Date().toISOString(),
            lastModifiedBy: userInfo,
            lastModifiedAt: new Date().toISOString(),
            
            // System metadata
            source: 'web_app_transactions_page',
            version: '1.0',
            
            // Security metadata
            clientTimestamp: new Date().toISOString(),
            serverTimestamp: new Date().toISOString(),
            ipAddress: 'client-side', // Would be filled server-side in production
            userAgent: navigator.userAgent,
            
            // Data integrity
            dataHash: await generateTransactionHash(transactionData),
            
            // Additional tracking
            sessionId: generateSessionId(),
            requestId: generateRequestId(),
            
            // Legacy timestamp for backward compatibility
            timestamp: new Date().toISOString()
        };

        console.log('🔒 Attempting to store secured transaction data with audit trail');

        // Store to Firestore
        try {
            await setDoc(docRef, finalTransactionData);
            console.log('✅ Transaction successfully stored in Firestore at path:', docRef.path);
            
            // Log successful creation for audit
            console.log('📊 AUDIT LOG - Transaction Created:', {
                userId: userId,
                transactionId: transactionData.id,
                transactionName: transactionData.description,
                amount: transactionData.amount,
                type: transactionData.type,
                accountId: transactionData.accountId,
                timestamp: new Date().toISOString(),
                action: 'CREATE_TRANSACTION'
            });
            
            return { success: true, transactionId: transactionData.id, timestamp: finalTransactionData.createdAt };
        } catch (firestoreError) {
            console.error('❌ Firestore setDoc error for transaction:', firestoreError);
            
            // Log failed creation for audit
            console.error('📊 AUDIT LOG - Transaction Creation Failed:', {
                userId: userId,
                transactionId: transactionData.id,
                error: firestoreError.message,
                timestamp: new Date().toISOString(),
                action: 'CREATE_TRANSACTION_FAILED'
            });
            
            throw new Error('Failed to save transaction to Firestore: ' + firestoreError.message);
        }
        
    } catch (error) {
        console.error('❌ Error in storeTransaction:', error);
        
        // Log comprehensive error for audit
        console.error('📊 AUDIT LOG - Transaction Storage Error:', {
            userId: userId,
            error: error.message,
            timestamp: new Date().toISOString(),
            action: 'STORAGE_ERROR',
            transactionData: { 
                id: transactionData?.id, 
                name: transactionData?.description,
                amount: transactionData?.amount,
                type: transactionData?.type
            }
        });
        
        // If it's still a permission error, the Firebase rules weren't updated
        if (error.code === 'permission-denied') {
            console.error('🚨 FIREBASE RULES NOT UPDATED! Go to Firebase Console and update rules!');
        }
        
        throw error;
    }
}

// Helper function to generate transaction hash for integrity checking
async function generateTransactionHash(data) {
    try {
        const encoder = new TextEncoder();
        const dataString = JSON.stringify({
            description: data.description,
            amount: data.amount,
            type: data.type,
            date: data.date,
            accountId: data.accountId
        });
        const dataBuffer = encoder.encode(dataString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
        console.warn('Could not generate transaction hash:', error);
        return 'hash_generation_failed';
    }
}

// Get all transactions for a user
export async function getUserTransactions(userId) {
    try {
        console.log('🔄 getUserTransactions called with userId:', userId);
        
        // Validate user authentication
        if (!auth.currentUser) {
            console.error('❌ No authenticated user found');
            throw new Error('User not authenticated');
        }
        
        // Validate user access
        validateUserAccess(userId);
        
        const transactions = [];
        
        // Query Firestore for transactions
        try {
            console.log('📊 Querying transactions for user:', userId);
            
            // Create query for transactions, ordered by date
            const transactionsQuery = query(
                collection(db, "users", userId, "transactions"),
                orderBy("date", "desc")
            );
            
            console.log('🔍 Executing Firestore query...');
            const querySnapshot = await getDocs(transactionsQuery);
            console.log('✅ Query successful, found', querySnapshot.size, 'transactions');
            
            querySnapshot.forEach((doc) => {
                try {
                    const data = doc.data();
                    const transactionData = {
                        id: doc.id,
                        ...data,
                        // Ensure date is always present
                        date: data.date || data.timestamp || new Date().toISOString(),
                        // Convert amount to number if it's stored as string
                        amount: typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount
                    };
                    
                    // Validate required fields
                    if (!transactionData.amount || isNaN(transactionData.amount)) {
                        console.warn('⚠️ Skipping transaction with invalid amount:', doc.id);
                        return;
                    }
                    
                    if (!transactionData.type || !['income', 'expense'].includes(transactionData.type.toLowerCase())) {
                        console.warn('⚠️ Skipping transaction with invalid type:', doc.id);
                        return;
                    }
                    
                    console.log('📝 Processing transaction:', doc.id);
                    transactions.push(transactionData);
                    
                } catch (docError) {
                    console.error('❌ Error processing transaction document:', doc.id, docError);
                }
            });
            
            // Sort transactions by date, most recent first
            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            console.log(`✅ Successfully loaded ${transactions.length} transactions`);
            return transactions;
            
        } catch (queryError) {
            console.error('❌ Failed to query transactions:', queryError);
            throw new Error('Failed to load transactions: ' + queryError.message);
        }
    } catch (error) {
        console.error("❌ Error in getUserTransactions:", error);
        throw error; // Propagate the error to be handled by the caller
    }
}

// Update transaction
export async function updateTransaction(userId, transactionId, updatedData) {
    try {
        // Validate user is authorized to modify this data
        validateUserAccess(userId);

        // Ensure userId is included in updated data for security rule validation
        updatedData.userId = userId;

        const docRef = doc(db, "users", userId, "transactions", transactionId);
        await setDoc(docRef, updatedData, { merge: true });
        return true;
    } catch (error) {
        console.error("Error updating transaction: ", error);
        return false;
    }
}

// Delete transaction
export async function deleteTransaction(userId, transactionId) {
    try {
        // Validate user is authorized to modify this data
        validateUserAccess(userId);

        const docRef = doc(db, "users", userId, "transactions", transactionId);
        await deleteDoc(docRef);
        console.log("Transaction deleted successfully!");
        return true;
    } catch (error) {
        console.error("Error deleting transaction:", error);
        return false;
    }
}

// Store bank account in Firestore
export async function storeBankAccount(userId, accountData) {
    try {
        console.log('🔄 Starting storeBankAccount with userId:', userId);
        console.log('📝 Account data to store:', accountData);

        // Validate user is authorized to modify this data
        try {
            validateUserAccess(userId);
            console.log('✅ User access validation passed');
        } catch (authError) {
            console.error('❌ Authorization error:', authError);
            throw new Error('Authorization failed: ' + authError.message);
        }

        // Validate required fields
        if (!accountData.id) {
            throw new Error('Account ID is required');
        }
        if (!accountData.name || accountData.name.trim() === '') {
            throw new Error('Account name is required');
        }
        if (!accountData.provider) {
            throw new Error('Account provider is required');
        }
        if (!accountData.accountType) {
            throw new Error('Account type is required');
        }
        if (!accountData.category) {
            throw new Error('Account category is required');
        }

        // Ensure balance is a number
        const balance = parseFloat(accountData.balance);
        if (isNaN(balance)) {
            throw new Error('Invalid balance amount: must be a valid number');
        }
        if (balance < 0) {
            throw new Error('Balance cannot be negative');
        }

        // Create a reference to the bank account document
        const docRef = doc(db, "users", userId, "bankAccounts", accountData.id);
        console.log('📄 Document reference created for path:', docRef.path);

        // Get current user info for audit trail
        const currentUser = auth.currentUser;
        const userInfo = {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName || 'Unknown'
        };

        // Add comprehensive audit trail and security data
        const securedAccountData = {
            ...accountData,
            // Core identifiers
            userId,
            accountId: accountData.id,
            
            // Financial data (validated)
            balance: balance,
            
            // Audit trail
            createdBy: userInfo,
            createdAt: new Date().toISOString(),
            lastModifiedBy: userInfo,
            lastModifiedAt: new Date().toISOString(),
            
            // System metadata
            source: 'web_app_accounts_page',
            version: '1.0',
            isActive: true,
            
            // Security metadata
            clientTimestamp: new Date().toISOString(),
            serverTimestamp: new Date().toISOString(),
            ipAddress: 'client-side', // Would be filled server-side in production
            userAgent: navigator.userAgent,
            
            // Data integrity
            dataHash: await generateDataHash(accountData),
            
            // Additional tracking
            sessionId: generateSessionId(),
            requestId: generateRequestId(),
            
            // Legacy timestamp for backward compatibility with queries
            timestamp: new Date().toISOString()
        };

        console.log('🔒 Attempting to store secured account data with audit trail');

        // Use setDoc to create/update the document
        try {
            await setDoc(docRef, securedAccountData);
            console.log('✅ Account successfully stored in Firestore at path:', docRef.path);
            
            // Log successful creation for audit
            console.log('📊 AUDIT LOG - Account Created:', {
                userId: userId,
                accountId: accountData.id,
                accountName: accountData.name,
                provider: accountData.provider,
                balance: balance,
                timestamp: new Date().toISOString(),
                action: 'CREATE_ACCOUNT'
            });
            
            return { success: true, accountId: accountData.id, timestamp: securedAccountData.createdAt };
        } catch (firestoreError) {
            console.error('❌ Firestore setDoc error:', firestoreError);
            
            // Log failed creation for audit
            console.error('📊 AUDIT LOG - Account Creation Failed:', {
                userId: userId,
                accountId: accountData.id,
                error: firestoreError.message,
                timestamp: new Date().toISOString(),
                action: 'CREATE_ACCOUNT_FAILED'
            });
            
            throw new Error('Failed to save to Firestore: ' + firestoreError.message);
        }
    } catch (error) {
        console.error('❌ Error in storeBankAccount:', error);
        
        // Log comprehensive error for audit
        console.error('📊 AUDIT LOG - Account Storage Error:', {
            userId: userId,
            error: error.message,
            timestamp: new Date().toISOString(),
            action: 'STORAGE_ERROR',
            accountData: { 
                id: accountData?.id, 
                name: accountData?.name,
                provider: accountData?.provider 
            }
        });
        
        throw error; // Re-throw to handle in the calling function
    }
}

// Helper function to generate data hash for integrity checking
async function generateDataHash(data) {
    try {
        const encoder = new TextEncoder();
        const dataString = JSON.stringify({
            name: data.name,
            provider: data.provider,
            accountType: data.accountType,
            balance: data.balance
        });
        const dataBuffer = encoder.encode(dataString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
        console.warn('Could not generate data hash:', error);
        return 'hash_generation_failed';
    }
}

// Helper function to generate session ID
function generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Helper function to generate request ID
function generateRequestId() {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Get all bank accounts for a user
export async function getUserBankAccounts(userId) {
    try {
        console.log('Starting getUserBankAccounts for userId:', userId);

        // Use a default userId if none provided
        const finalUserId = userId || 'default-user';
        console.log('Final userId being used:', finalUserId);

        const accounts = [];
        
        // Try query with timestamp first, fall back to simple query
        let accountsQuery;
        let querySnapshot;
        
        try {
            // Try ordering by timestamp (newer accounts)
            accountsQuery = query(
                collection(db, "users", finalUserId, "bankAccounts"),
                orderBy("timestamp", "desc")
            );
            
            console.log('Querying accounts with timestamp ordering from path:', `users/${finalUserId}/bankAccounts`);
            querySnapshot = await getDocs(accountsQuery);
            console.log('Query with timestamp successful, snapshot size:', querySnapshot.size);
        } catch (orderError) {
            console.warn('Query with timestamp failed, trying simple query:', orderError.message);
            
            // Fallback to simple query without ordering
            try {
                accountsQuery = query(collection(db, "users", finalUserId, "bankAccounts"));
                console.log('Querying accounts without ordering from path:', `users/${finalUserId}/bankAccounts`);
                querySnapshot = await getDocs(accountsQuery);
                console.log('Simple query successful, snapshot size:', querySnapshot.size);
            } catch (simpleQueryError) {
                console.error('Simple query also failed:', simpleQueryError);
                throw new Error('Failed to query accounts: ' + simpleQueryError.message);
            }
        }

        querySnapshot.forEach((doc) => {
            try {
                // Ensure balance is a number
                const data = doc.data();
                data.balance = parseFloat(data.balance) || 0;
                
                // Add timestamp if missing (for older accounts)
                if (!data.timestamp) {
                    data.timestamp = data.createdAt || new Date().toISOString();
                }
                
                accounts.push({ id: doc.id, ...data });
            } catch (docError) {
                console.error('Error processing account document:', doc.id, docError);
                // Continue processing other documents
            }
        });

        // Sort accounts by timestamp if not already ordered
        accounts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        console.log('Retrieved accounts:', accounts);
        return accounts;
    } catch (error) {
        console.error('Error in getUserBankAccounts:', error);
        return []; // Return empty array instead of throwing error
    }
}

// Update bank account in Firestore
export async function updateBankAccount(userId, accountId, updatedData) {
    try {
        // Validate user is authorized to modify this data
        validateUserAccess(userId);

        // Ensure userId is included in updated data for security rule validation
        updatedData.userId = userId;

        const accountRef = doc(db, "users", userId, "bankAccounts", accountId);
        await updateDoc(accountRef, updatedData);
        console.log("Bank account updated in Firestore!");
        return true;
    } catch (error) {
        console.error("Error updating bank account:", error);
        return false;
    }
}

// NEW FUNCTIONS FOR FINANCIAL INFORMATION MANAGEMENT

// Update financial profile information
export async function updateFinancialProfile(userId, financialData) {
    try {
        // Validate user is authorized to modify this data
        validateUserAccess(userId);

        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            'financialProfile': {
                ...financialData,
                lastUpdated: new Date().toISOString()
            },
            'userId': userId // Include userId for security rule validation
        });
        console.log("Financial profile updated successfully!");
        return true;
    } catch (error) {
        console.error("Error updating financial profile:", error);
        return false;
    }
}

// Upload financial document (ID, proof of income, etc.)
export async function uploadFinancialDocument(userId, file, documentType) {
    try {
        // Generate a unique filename
        const timestamp = new Date().getTime();
        const fileExtension = file.name.split('.').pop();
        const fileName = `${userId}_${documentType}_${timestamp}.${fileExtension}`;

        // Create a reference to the file location
        const storageRef = ref(storage, `financial_documents/${userId}/${fileName}`);

        // Upload the file
        await uploadBytes(storageRef, file);

        // Get the download URL
        const downloadURL = await getDownloadURL(storageRef);

        // Store document metadata in Firestore
        const documentData = {
            id: `${documentType}_${timestamp}`,
            type: documentType,
            fileName: fileName,
            uploadDate: new Date().toISOString(),
            url: downloadURL,
            status: 'pending', // pending, verified, rejected
            verifiedBy: null,
            verificationDate: null,
            notes: null
        };

        // Update user's financial profile with the new document
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            const financialProfile = userData.financialProfile || {};
            const documents = financialProfile.documents || {};

            // Add the new document
            documents[documentType] = documentData;

            // Update the user document
            await updateDoc(userRef, {
                'financialProfile.documents': documents
            });

            console.log(`Financial document ${documentType} uploaded successfully!`);
            return documentData;
        } else {
            throw new Error("User document not found");
        }
    } catch (error) {
        console.error(`Error uploading financial document ${documentType}:`, error);
        return null;
    }
}

// Delete financial document
export async function deleteFinancialDocument(userId, documentType) {
    try {
        // Get user data to find the document
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            const financialProfile = userData.financialProfile || {};
            const documents = financialProfile.documents || {};

            // Check if the document exists
            if (documents[documentType]) {
                const document = documents[documentType];

                // Delete from Storage
                const storageRef = ref(storage, `financial_documents/${userId}/${document.fileName}`);
                await deleteObject(storageRef);

                // Remove from Firestore
                delete documents[documentType];

                // Update the user document
                await updateDoc(userRef, {
                    'financialProfile.documents': documents
                });

                console.log(`Financial document ${documentType} deleted successfully!`);
                return true;
            } else {
                console.log(`No document of type ${documentType} found`);
                return false;
            }
        } else {
            throw new Error("User document not found");
        }
    } catch (error) {
        console.error(`Error deleting financial document ${documentType}:`, error);
        return false;
    }
}