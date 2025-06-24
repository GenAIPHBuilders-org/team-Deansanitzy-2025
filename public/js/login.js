  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries
  import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserData, storeUserData, checkLoginStatus, resetFailedLoginAttempts, recordFailedLoginAttempt } from "./firestoredb.js";
import { firebaseConfig } from "./config.js";
import { initEncryption, secureStorage } from "./helpers.js";
import { 
  improvedGoogleSignIn, 
  handleRedirectResult, 
  shouldHandleRedirectResult,
  clearRedirectFlag,
  getReadableAuthError 
} from "./auth-helpers.js";

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

  // Global flags to prevent multiple simultaneous authentication attempts
  let isAuthInProgress = false;
  let authPopupWindow = null;
  let authTimeout = null;

  // Function to clean up authentication state
  function cleanupAuthState() {
    isAuthInProgress = false;
    if (authPopupWindow) {
      try {
        authPopupWindow.close();
      } catch (e) {
        // Ignore errors when closing popup
      }
      authPopupWindow = null;
    }
    if (authTimeout) {
      clearTimeout(authTimeout);
      authTimeout = null;
    }
  }

  // Listen for popup close events to clean up state
  window.addEventListener('beforeunload', cleanupAuthState);
  
  //submit button
document.addEventListener('DOMContentLoaded', async function() {
  // Check for redirect result first
  if (shouldHandleRedirectResult()) {
    try {
      const result = await handleRedirectResult();
      if (result) {
        console.log("Handling redirect result:", result.user);
        clearRedirectFlag();
        // Redirect to dashboard
        window.location.href = "dashboard.html";
        return;
      }
    } catch (error) {
      console.error("Error handling redirect result:", error);
      clearRedirectFlag();
    }
  }
    // Initialize Google login button
    const googleLogin = document.getElementById("google-login");
    if (!googleLogin) {
      console.error("Google login button not found in the DOM");
      return;
    }
    
    const originalGoogleText = googleLogin.innerHTML;
    
    googleLogin.addEventListener("click", async function(event) {
        // Prevent default behavior and event bubbling
        event.preventDefault();
        event.stopPropagation();
        
        console.log("Google login button clicked"); // Debug log
        
        // Prevent multiple simultaneous login attempts
        if (googleLogin.disabled || isAuthInProgress) {
            console.log("Google login already in progress, ignoring click");
            return;
        }
        
        // Clean up any existing auth state
        cleanupAuthState();
        
        isAuthInProgress = true;
        
        googleLogin.disabled = true;
        googleLogin.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in with Google...';
        googleLogin.style.opacity = '0.8';
        
        // Add a timeout to automatically clean up if authentication hangs
        authTimeout = setTimeout(() => {
            console.log("Authentication timeout, cleaning up...");
            cleanupAuthState();
            googleLogin.disabled = false;
            googleLogin.innerHTML = originalGoogleText;
            googleLogin.style.opacity = '1';
            showError("Authentication timed out. Please try again.");
        }, 30000); // 30 second timeout
        
              try {
          // Use improved Google Sign-In with auth helpers
          await improvedGoogleSignIn(provider, {
              useRedirectFallback: true,
              onLoading: (isLoading) => {
                  googleLogin.disabled = isLoading;
                  if (isLoading) {
                      googleLogin.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in with Google...';
                      googleLogin.style.opacity = '0.8';
                  } else {
                      googleLogin.innerHTML = originalGoogleText;
                      googleLogin.style.opacity = '1';
                  }
              },
              onSuccess: async (result) => {
                                  console.log("Google sign-in successful");
                  cleanupAuthState(); // Clean up successful auth
                  
                  const user = result.user;
                  console.log("Google sign-in successful for user:", user.uid);
                  
                  // Initialize encryption with user ID - now just a compatibility function
                  await initEncryption(user.uid);
                  
                  try {
                      const userData = await getUserData(user.uid);
                      if (userData) {
                          console.log("Existing user data found for:", user.uid);
                          // Store user data securely - UPDATED to use new approach
                          // Only store minimal, non-sensitive user profile in session
                          const safeUserData = {
                              firstName: userData.firstName,
                              lastName: userData.lastName,
                              email: userData.email,
                              lastLogin: userData.lastLogin,
                              accountStatus: userData.accountStatus
                          };
                          
                          await secureStorage.setItem('userData', safeUserData);
                          
                          // Set a secure auth cookie for persistent auth
                          secureStorage.setSecureCookie('auth_session', 'authenticated', 1); // 1 day expiry
                          
                          // Redirect to dashboard immediately 
                          window.location.href = "dashboard.html";
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
                          // Store user data securely - UPDATED
                          await secureStorage.setItem('userData', newUserData);
                          secureStorage.setSecureCookie('auth_session', 'authenticated', 1);
                          
                          // Redirect to dashboard immediately
                          window.location.href = "dashboard.html";
                      }
                  } catch (error) {
                      console.error("Error handling user data:", error);
                      window.location.href = "dashboard.html";
                  }
              },
              onError: (error) => {
                  console.error("Google sign-in error:", error);
                  
                  cleanupAuthState(); // Clean up failed auth
                  googleLogin.disabled = false;
                  googleLogin.innerHTML = originalGoogleText;
                  googleLogin.style.opacity = '1';
                  
                  // Only show error if user didn't cancel
                  if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                      const errorMessage = getReadableAuthError(error);
                      showError(errorMessage);
                  } else {
                      console.log("User cancelled authentication");
                  }
              }
          });
        } catch (error) {
            console.error("Exception in click handler:", error);
            cleanupAuthState();
            googleLogin.disabled = false;
            googleLogin.innerHTML = originalGoogleText;
            googleLogin.style.opacity = '1';
            showError("Error during Google sign-in setup: " + error.message);
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

    // Function to show error message
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
            showError(`For security reasons, this account has been temporarily locked. Please try again in ${loginStatus.remainingMinutes} minute(s).`);
            
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
                showError(errorMessage);
                

                
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