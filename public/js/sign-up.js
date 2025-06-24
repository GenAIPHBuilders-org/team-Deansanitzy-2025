// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-analytics.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import { getAuth, createUserWithEmailAndPassword, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { storeUserData } from "./firestoredb.js";
import { firebaseConfig } from "./config.js";
import { 
  initEncryption, 
  secureStorage, 
  isValidEmail, 
  isStrongPassword, 
  validateName, 
  sanitizeString,
  showValidationError,
  clearValidationError,
  clearAllValidationErrors 
} from "./helpers.js";
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

//googleAuth
const provider = new GoogleAuthProvider();

// Configure Google Auth provider to improve sign-in reliability
provider.setCustomParameters({
  prompt: 'select_account',
  hd: undefined // Allow any domain
});

//submit button  
document.addEventListener('DOMContentLoaded', async function() {
  // Check for redirect result first
  if (shouldHandleRedirectResult()) {
    try {
      const result = await handleRedirectResult();
      if (result) {
        console.log("Handling redirect result for signup:", result.user);
        clearRedirectFlag();
        
        // Show loading state
        document.body.innerHTML = `
          <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #060e21; color: white; font-family: -webkit-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;">
            <div style="text-align: center;">
              <div style="margin-bottom: 20px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i>
              </div>
              <h2>Completing your signup...</h2>
              <p>Please wait while we set up your account.</p>
            </div>
          </div>
        `;
        
        // Handle signup completion
        try {
          const user = result.user;
          
          // Initialize encryption with user ID (now just compatibility)
          await initEncryption(user.uid);
          
          // Create a user data object
          const userData = {
            firstName: sanitizeString(user.displayName ? user.displayName.split(' ')[0] : ''),
            lastName: sanitizeString(user.displayName ? user.displayName.split(' ').slice(1).join(' ') : ''),
            email: sanitizeString(user.email),
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            accountStatus: 'active',
            securityLevel: 'standard'
          };
          
          // Store in Firestore
          await storeUserData(user.uid, userData);
          
          // Also store in secure storage for quick access
          await secureStorage.setItem('userData', userData);
          secureStorage.setSecureCookie('auth_session', 'authenticated', 1);
          
          console.log("Redirect signup complete, redirecting to dashboard");
          
          // Redirect to dashboard
          window.location.href = "dashboard.html";
          
        } catch (error) {
          console.error("Error completing redirect signup:", error);
          
          // Show error and redirect back to signup
          document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #060e21; color: white; font-family: -webkit-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;">
              <div style="text-align: center; max-width: 400px; padding: 2rem;">
                <div style="margin-bottom: 20px;">
                  <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #ff3b30;"></i>
                </div>
                <h2>Signup Error</h2>
                <p>There was an error completing your signup. Please try again.</p>
                <button onclick="window.location.href='sign-up.html'" style="background: #10df6f; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; margin-top: 1rem;">
                  Try Again
                </button>
              </div>
            </div>
          `;
        }
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
    event.preventDefault();
    event.stopPropagation();
    
    console.log("Google signup button clicked");
    
    if (googleLogin.disabled) {
      console.log("Google signup already in progress, ignoring click");
      return;
    }
    
    try {
      await improvedGoogleSignIn(provider, {
        useRedirectFallback: true,
        onLoading: (isLoading) => {
          googleLogin.disabled = isLoading;
          if (isLoading) {
            googleLogin.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing up with Google...';
            googleLogin.style.opacity = '0.8';
          } else {
            googleLogin.innerHTML = originalGoogleText;
            googleLogin.style.opacity = '1';
          }
        },
        onSuccess: async (result) => {
          try {
            const user = result.user;
            console.log("Google signup successful for user:", user.uid);
            
            // Show loading state
            document.body.innerHTML = `
              <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #060e21; color: white; font-family: -webkit-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;">
                <div style="text-align: center;">
                  <div style="margin-bottom: 20px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i>
                  </div>
                  <h2>Setting up your account...</h2>
                  <p>Please wait while we create your profile.</p>
                </div>
              </div>
            `;
            
            // Initialize encryption with user ID (now just compatibility)
            await initEncryption(user.uid);
            
            // Create a user data object
            const userData = {
              firstName: sanitizeString(user.displayName ? user.displayName.split(' ')[0] : ''),
              lastName: sanitizeString(user.displayName ? user.displayName.split(' ').slice(1).join(' ') : ''),
              email: sanitizeString(user.email),
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
              accountStatus: 'active',
              securityLevel: 'standard'
            };
            
            console.log("Storing user data:", userData);
            
            // Store in Firestore
            await storeUserData(user.uid, userData);
            console.log("User data stored successfully");
            
            // Register user with fixed telegram key
            try {
              const idToken = await user.getIdToken();
              const response = await fetch('/api/user/register', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${idToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
              });
              
              if (response.ok) {
                const result = await response.json();
                console.log('User registered with fixed telegram key:', result.data?.telegramKey);
              } else {
                console.warn('Failed to register with telegram key, but user account created successfully');
              }
            } catch (keyError) {
              console.warn('Failed to generate telegram key during signup:', keyError);
              // Don't fail the entire signup process for this
            }
            
            // Also store in secure storage for quick access - updated
            await secureStorage.setItem('userData', userData);
            secureStorage.setSecureCookie('auth_session', 'authenticated', 1);
            
            console.log("Account setup complete, redirecting to dashboard");
            
            // Redirect directly to dashboard instead of login page
            window.location.href = "dashboard.html";
            
          } catch (error) {
            console.error("Error in Google signup success handler:", error);
            
            // Show error page instead of white screen
            document.body.innerHTML = `
              <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #060e21; color: white; font-family: -webkit-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;">
                <div style="text-align: center; max-width: 400px; padding: 2rem;">
                  <div style="margin-bottom: 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #ff3b30;"></i>
                  </div>
                  <h2>Setup Error</h2>
                  <p>There was an error setting up your account. Please try again.</p>
                  <button onclick="window.location.href='sign-up.html'" style="background: #10df6f; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; margin-top: 1rem;">
                    Try Again
                  </button>
                </div>
              </div>
            `;
          }
        },
        onError: (error) => {
          console.error("Google signup error:", error);
          
          // Reset the button
          googleLogin.disabled = false;
          googleLogin.innerHTML = originalGoogleText;
          googleLogin.style.opacity = '1';
          
          // Display user-friendly error message
          const errorMessage = getReadableAuthError(error);
          showError(errorMessage);
        }
      });
    } catch (error) {
      console.error("Exception in Google signup:", error);
      googleLogin.disabled = false;
      googleLogin.innerHTML = originalGoogleText;
      googleLogin.style.opacity = '1';
      showError("Error during Google sign-up setup: " + error.message);
    }
  });

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
    const submitButton = document.getElementById('submit');
    if (submitButton) {
      submitButton.parentElement.insertBefore(errorDiv, submitButton);
    }

    // Animate error message
    errorDiv.style.animation = 'slideIn 0.3s ease-out';
  }

  const form = document.querySelector('.auth-form');
  const firstNameInput = document.getElementById('firstName');
  const lastNameInput = document.getElementById('lastName');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  
  // Password validation requirements in the UI
  const reqLength = document.getElementById('req-length');
  const reqCriteria = document.getElementById('req-criteria');
  const reqLowercase = document.getElementById('req-lowercase');
  const reqUppercase = document.getElementById('req-uppercase');
  const reqNumbers = document.getElementById('req-numbers');
  const reqSpecial = document.getElementById('req-special');
  
  // Function to validate password and update UI indicators
  function validatePasswordUI() {
    const password = passwordInput.value;
    
    if (!password) {
      // Reset all indicators when password is empty
      [reqLength, reqCriteria, reqLowercase, reqUppercase, reqNumbers, reqSpecial].forEach(el => {
        el.classList.remove('requirement-met', 'requirement-unmet');
      });
      return;
    }
    
    // Check length
    const hasLength = password.length >= 8;
    toggleRequirement(reqLength, hasLength);
    
    // Check character types
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    toggleRequirement(reqLowercase, hasLowercase);
    toggleRequirement(reqUppercase, hasUppercase);
    toggleRequirement(reqNumbers, hasNumbers);
    toggleRequirement(reqSpecial, hasSpecial);
    
    // Count criteria met
    const criteriaCount = [hasLowercase, hasUppercase, hasNumbers, hasSpecial].filter(Boolean).length;
    const hasCriteria = criteriaCount >= 3;
    toggleRequirement(reqCriteria, hasCriteria);
    
    // For common patterns check
    if (hasLength && hasCriteria) {
      // Check for common patterns and dictionary words
      const commonPatterns = [
        '12345678', '87654321', 'password', 'qwerty', 'abc123',
        'admin123', 'letmein', 'welcome', 'monkey', 'football'
      ];
      
      const lowercasePassword = password.toLowerCase();
      let hasCommonPattern = false;
      
      for (const pattern of commonPatterns) {
        if (lowercasePassword.includes(pattern)) {
          hasCommonPattern = true;
          break;
        }
      }
      
      if (hasCommonPattern) {
        showValidationError(passwordInput, "Password contains a common pattern that's easy to guess");
      } else {
        clearValidationError(passwordInput);
      }
    }
  }
  
  // Show requirement status in UI
  function toggleRequirement(element, isMet) {
    if (isMet) {
      element.classList.add('requirement-met');
      element.classList.remove('requirement-unmet');
    } else {
      element.classList.add('requirement-unmet');
      element.classList.remove('requirement-met');
    }
  }
  
  // Add input validation event listeners 
  passwordInput.addEventListener('input', validatePasswordUI);
  confirmPasswordInput.addEventListener('input', function() {
    // Check if passwords match
    if (passwordInput.value && confirmPasswordInput.value) {
      if (passwordInput.value !== confirmPasswordInput.value) {
        showValidationError(confirmPasswordInput, "Passwords do not match");
      } else {
        clearValidationError(confirmPasswordInput);
      }
    }
  });
  
  // Input validation for other fields
  firstNameInput.addEventListener('input', function() {
    if (firstNameInput.value && !validateName(firstNameInput.value)) {
      showValidationError(firstNameInput, "Please enter a valid first name");
    } else {
      clearValidationError(firstNameInput);
    }
  });
  
  lastNameInput.addEventListener('input', function() {
    if (lastNameInput.value && !validateName(lastNameInput.value)) {
      showValidationError(lastNameInput, "Please enter a valid last name");
    } else {
      clearValidationError(lastNameInput);
    }
  });
  
  emailInput.addEventListener('input', function() {
    if (emailInput.value && !isValidEmail(emailInput.value)) {
      showValidationError(emailInput, "Please enter a valid email address");
    } else {
      clearValidationError(emailInput);
    }
  });
  
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    
    // Clear any previous validation errors
    clearAllValidationErrors(form);
    
    // Validate all fields
    let hasErrors = false;
    
    // First Name validation
    if (!firstNameInput.value.trim()) {
      showValidationError(firstNameInput, "First name is required");
      hasErrors = true;
    } else if (!validateName(firstNameInput.value)) {
      showValidationError(firstNameInput, "Please enter a valid first name");
      hasErrors = true;
    }
    
    // Last Name validation
    if (!lastNameInput.value.trim()) {
      showValidationError(lastNameInput, "Last name is required");
      hasErrors = true;
    } else if (!validateName(lastNameInput.value)) {
      showValidationError(lastNameInput, "Please enter a valid last name");
      hasErrors = true;
    }
    
    // Email validation
    if (!emailInput.value.trim()) {
      showValidationError(emailInput, "Email is required");
      hasErrors = true;
    } else if (!isValidEmail(emailInput.value)) {
      showValidationError(emailInput, "Please enter a valid email address");
      hasErrors = true;
    }
    
    // Password validation
    if (!passwordInput.value) {
      showValidationError(passwordInput, "Password is required");
      hasErrors = true;
    } else if (!isStrongPassword(passwordInput.value)) {
      showValidationError(passwordInput, "Password doesn't meet the security requirements");
      hasErrors = true;
    }
    
    // Confirm Password validation
    if (!confirmPasswordInput.value) {
      showValidationError(confirmPasswordInput, "Please confirm your password");
      hasErrors = true;
    } else if (passwordInput.value !== confirmPasswordInput.value) {
      showValidationError(confirmPasswordInput, "Passwords do not match");
      hasErrors = true;
    }
    
    // If there are validation errors, don't submit
    if (hasErrors) {
      // Scroll to the first error
      const firstError = form.querySelector('.is-invalid');
      if (firstError) {
        firstError.focus();
      }
      return;
    }
    
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
    
    try {
      // Create account in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        sanitizeString(emailInput.value), 
        passwordInput.value // Don't sanitize password as it would alter it
      );
      
      const user = userCredential.user;
      
      // Initialize encryption with user ID (now just compatibility)
      await initEncryption(user.uid);
      
      // Create a sanitized user data object
      const userData = {
        firstName: sanitizeString(firstNameInput.value),
        lastName: sanitizeString(lastNameInput.value),
        email: sanitizeString(emailInput.value),
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        accountStatus: 'active',
        securityLevel: 'standard'
      };
      
      // Store in Firestore
      await storeUserData(user.uid, userData);
      
      // Register user with fixed telegram key
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/user/register', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(userData)
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('User registered with fixed telegram key:', result.data?.telegramKey);
        } else {
          console.warn('Failed to register with telegram key, but user account created successfully');
        }
      } catch (keyError) {
        console.warn('Failed to generate telegram key during signup:', keyError);
        // Don't fail the entire signup process for this
      }
      
      // Also store in secure storage for quick access - updated
      await secureStorage.setItem('userData', userData);
      secureStorage.setSecureCookie('auth_session', 'authenticated', 1);
      
      // Show success message
      alert("Account created successfully!");
      
      // Redirect to login page
      window.location.href = "login.html";
      
    } catch (error) {
      // Reset the button
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonText;
      
      // Error handling for common errors
      switch (error.code) {
        case 'auth/email-already-in-use':
          showValidationError(emailInput, "This email is already registered. Please login instead.");
          emailInput.focus();
          break;
        case 'auth/weak-password':
          showValidationError(passwordInput, "Firebase considers this password too weak. Please choose a stronger password.");
          passwordInput.focus();
          break;
        case 'auth/invalid-email':
          showValidationError(emailInput, "The email address is not valid.");
          emailInput.focus();
          break;
        case 'auth/operation-not-allowed':
          alert("Email/password accounts are not enabled. Please contact support.");
          break;
        case 'auth/network-request-failed':
          alert("Network error. Please check your internet connection and try again.");
          break;
        default:
          alert(`Error creating account: ${error.message}`);
      }
      
      console.error("Account creation error:", error);
    }
  });
});