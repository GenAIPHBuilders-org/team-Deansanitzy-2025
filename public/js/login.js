  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries
  import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserData, storeUserData, checkLoginStatus, resetFailedLoginAttempts, recordFailedLoginAttempt } from "./firestoredb.js";
import { firebaseConfig } from "./config.js";
import { initEncryption, secureStorage } from "./helpers.js";
import { signInWithPopup } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
  const auth = getAuth(app);  // Initialize auth instance

  // Add Google Auth provider initialization
  const provider = new GoogleAuthProvider();
  
  // Configure Google Auth provider to improve sign-in reliability and prevent duplicates
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  
  // Add scopes explicitly to prevent additional permission requests
  provider.addScope('email');
  provider.addScope('profile');

  // Global flag to prevent multiple simultaneous authentication attempts
  let isAuthInProgress = false;

  // Helper function to handle successful authentication
  async function handleSuccessfulAuth(result) {
    const user = result.user;
    console.log("Authentication successful for user:", user.uid);
    
    // Initialize encryption with user ID
    await initEncryption(user.uid);
    
    try {
      const userData = await getUserData(user.uid);
      if (userData) {
        console.log("Existing user data found for:", user.uid);
        // Store minimal user data
        const safeUserData = {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          lastLogin: userData.lastLogin,
          accountStatus: userData.accountStatus
        };
        
        await secureStorage.setItem('userData', safeUserData);
        secureStorage.setSecureCookie('auth_session', 'authenticated', 1);
      } else {
        console.log("Creating new user data for:", user.uid);
        const newUserData = {
          firstName: user.displayName ? user.displayName.split(' ')[0] : '',
          lastName: user.displayName ? user.displayName.split(' ').slice(1).join(' ') : '',
          email: user.email,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          accountStatus: 'active',
          securityLevel: 'standard'
        };
        
        await storeUserData(user.uid, newUserData);
        await secureStorage.setItem('userData', newUserData);
        secureStorage.setSecureCookie('auth_session', 'authenticated', 1);
      }
    } catch (error) {
      console.error("Error handling user data:", error);
    }
    
    // Redirect to dashboard
    window.location.href = "dashboard.html";
  }

  // Helper function to show error messages
  function showError(message) {
    // Remove any existing error message
    const existingError = document.querySelector('.error-message');
    if (existingError) existingError.remove();

    // Create and insert error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
      color: #ff3b30;
      background: rgba(255, 59, 48, 0.1);
      border-left: 3px solid #ff3b30;
      padding: 1rem;
      margin: 1rem 0;
      border-radius: 4px;
      font-size: 0.9rem;
    `;
    errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    
    const form = document.querySelector('.auth-form');
    const loginButton = form.querySelector('button[type="submit"]');
    form.insertBefore(errorDiv, loginButton.parentElement);

    // Animate error message
    errorDiv.style.animation = 'slideIn 0.3s ease-out';
  }

  // Helper function to get readable error messages
  function getErrorMessage(error) {
    const errorMessages = {
      'auth/api-key-not-valid': 'Authentication configuration error. Please contact support.',
      'auth/network-request-failed': 'Network error. Please check your internet connection and try again.',
      'auth/popup-blocked': 'Sign-in popup was blocked. Please allow popups for this site and try again.',
      'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
      'auth/cancelled-popup-request': 'Multiple sign-in attempts detected. Please try again.',
      'auth/operation-not-allowed': 'Google authentication is not enabled. Please contact support.',
      'auth/invalid-api-key': 'Invalid API key. Please contact support.',
      'auth/app-deleted': 'Firebase app has been deleted. Please contact support.',
      'auth/invalid-user-token': 'Your session has expired. Please sign in again.',
      'auth/user-disabled': 'Your account has been disabled. Please contact support.',
      'auth/user-token-expired': 'Your session has expired. Please sign in again.',
      'auth/web-storage-unsupported': 'Your browser does not support web storage. Please enable cookies and try again.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/unauthorized-domain': 'This domain is not authorized for authentication. Please contact support.'
    };

    return errorMessages[error.code] || `Authentication error: ${error.message}`;
  }
  
  //submit button
document.addEventListener('DOMContentLoaded', async function() {
  // Check for existing authentication
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("User already signed in:", user.uid);
      window.location.href = "dashboard.html";
    }
  });


    // Initialize Google login button
    const googleLogin = document.getElementById("google-login");
    if (!googleLogin) {
      console.error("Google login button not found in the DOM");
      return;
    }
    
    const originalGoogleText = googleLogin.innerHTML;
    
    googleLogin.addEventListener("click", async function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        console.log("Google login button clicked");
        
        // Prevent multiple simultaneous login attempts
        if (googleLogin.disabled || isAuthInProgress) {
            console.log("Google login already in progress, ignoring click");
            return;
        }
        
        isAuthInProgress = true;
        
        // Show loading state
        googleLogin.disabled = true;
        googleLogin.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in with Google...';
        googleLogin.style.opacity = '0.8';
        
        try {
            console.log("Attempting Google sign-in...");
            const result = await signInWithPopup(auth, provider);
            console.log("Google sign-in successful:", result.user.uid);
            
            // Handle successful authentication
            await handleSuccessfulAuth(result);
            
        } catch (error) {
            console.error("Google sign-in error:", error);
            
            // Reset button state
            googleLogin.disabled = false;
            googleLogin.innerHTML = originalGoogleText;
            googleLogin.style.opacity = '1';
            isAuthInProgress = false;
            
            // Handle different error types gracefully
            if (error.code === 'auth/popup-closed-by-user') {
                console.log("User cancelled sign-in");
                // Don't show error for user cancellation
            } else if (error.code === 'auth/cancelled-popup-request') {
                console.log("Sign-in request cancelled");
                // Don't show error for cancellation
            } else if (error.code === 'auth/popup-blocked') {
                showError("Your browser blocked the sign-in popup. Please allow popups for this site and try again.");
            } else if (error.code === 'auth/network-request-failed') {
                showError("Network error. Please check your internet connection and try again.");
            } else if (error.code === 'auth/operation-not-allowed') {
                showError("Google sign-in is not enabled. Please contact support.");
            } else {
                // Show a user-friendly error for other issues
                showError("Sign-in failed. Please try again or contact support if the problem persists.");
            }
        }
    });

    const form = document.querySelector('.auth-form');
    const loginButton = form.querySelector('button[type="submit"]');
    const originalButtonText = loginButton.innerHTML;
    
    // Function to show loading state
    function setLoading(isLoading) {
        if (isLoading) {
            loginButton.disabled = true;
            loginButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
            loginButton.style.opacity = '0.8';
        } else {
            loginButton.disabled = false;
            loginButton.innerHTML = originalButtonText;
            loginButton.style.opacity = '1';
        }
    }

    // Function to show error message (local version for form)
    function showFormError(message) {
        // Remove any existing error message
        const existingError = document.querySelector('.error-message');
        if (existingError) existingError.remove();

        // Create and insert error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            color: #ff3b30;
            background: rgba(255, 59, 48, 0.1);
            border-left: 3px solid #ff3b30;
            padding: 1rem;
            margin: 1rem 0;
            border-radius: 4px;
            font-size: 0.9rem;
        `;
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        form.insertBefore(errorDiv, loginButton.parentElement);

        // Animate error message
        errorDiv.style.animation = 'slideIn 0.3s ease-out';
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        
        // Clear any existing error messages
        const existingError = document.querySelector('.error-message');
        if (existingError) existingError.remove();

        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        

        
        // Check if login is allowed (not rate limited)
        const loginStatus = await checkLoginStatus(emailInput.value);
        if (!loginStatus.allowed) {
            showFormError(`For security reasons, this account has been temporarily locked. Please try again in ${loginStatus.remainingMinutes} minute(s).`);
            
            return;
        }
        
        setLoading(true);
        
        signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
            .then(async (userCredential) => {
                const user = userCredential.user;
                
                // Initialize encryption with user ID - now just compatibility
                await initEncryption(user.uid);
                
                // Reset failed login attempts counter on successful login
                resetFailedLoginAttempts(emailInput.value)
                    .then(() => {
                        getUserData(user.uid)
                            .then(async userData => {
                                if (userData) {
                                    // Store only minimal, non-sensitive user data
                                    const safeUserData = {
                                        firstName: userData.firstName,
                                        lastName: userData.lastName,
                                        email: userData.email,
                                        lastLogin: userData.lastLogin,
                                        accountStatus: userData.accountStatus
                                    };
                                    
                                    // Use new secure storage method
                                    await secureStorage.setItem('userData', safeUserData);
                                    secureStorage.setSecureCookie('auth_session', 'authenticated', 1);
                                    
                                    // Log login activity for security auditing
                                    window.location.href = "dashboard.html";
                                } else {
                                    // User doesn't have data in Firestore, redirect anyway
                                    window.location.href = "dashboard.html";
                                }
                            });
                    })
                    .catch(error => {
                        console.error("Error resetting failed login attempts:", error);
                        window.location.href = "dashboard.html";
                    });
            })
            .catch(async (error) => {
                setLoading(false);
                
                // Record failed login attempt
                await recordFailedLoginAttempt(emailInput.value);
                
                const errorMessages = {
                    'auth/wrong-password': "Incorrect password. Please try again.",
                    'auth/user-not-found': "No account found with this email. Please check the email or sign up.",
                    'auth/invalid-credential': "Invalid login credentials. Please check your email and password.",
                    'auth/user-disabled': "This account has been disabled. Please contact support.",
                    'auth/too-many-requests': "Too many failed attempts. Please try again later.",
                    'auth/network-request-failed': "Network error. Please check your internet connection."
                };

                const errorMessage = errorMessages[error.code] || "An error occurred during login. Please try again.";
                showFormError(errorMessage);
                

                
                console.error("Firebase auth error:", error.code, error.message);
            });
    });

    // Add keypress handler for password field
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loginButton.click();
            }
        });
    }
  });