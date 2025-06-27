/**
 * Displays a toast notification with a specified message and type.
 * @param {string} message The message to display.
 * @param {('success'|'error')} type The type of notification.
 */
export function showToast(message, type = 'success') {
    const toast = document.getElementById('toast-notification');
    const toastMessage = document.getElementById('toast-message');

    if (!toast || !toastMessage) {
        console.error('Toast notification elements not found.');
        return;
    }

    toastMessage.textContent = message;
    toast.className = 'toast-notification'; // Reset classes
    toast.classList.add('show', type);

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000); // Hide after 3 seconds
} 