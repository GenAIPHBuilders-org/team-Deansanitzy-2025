import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { showToast } from './utils/notifications.js';

function handleLogout() {
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            const auth = getAuth();
            signOut(auth).then(() => {
                // Redirect will happen, so no need for a success message
                window.location.href = '../pages/login.html';
            }).catch((error) => {
                console.error('Sign out error:', error);
                showToast('Error signing out. Please try again.', 'error');
            });
        });
    }
}

// Initialize logout functionality on page load
document.addEventListener('DOMContentLoaded', handleLogout); 