/* ==========================================================================
   Lexicon - UI Toast Module
   ========================================================================== */

window.Lexicon = window.Lexicon || {};
window.Lexicon.UI = window.Lexicon.UI || {};

(function() {
    let toastTimeout = null;

    window.Lexicon.UI.Toast = {
        /**
         * Display a floating toast notification
         * @param {string} message - Notification text
         * @param {'success'|'error'|'info'} type - Toast type
         * @param {number} duration - Milliseconds before auto-dismiss
         */
        show(message, type = 'success', duration = 3000) {
            const toast = document.getElementById('toast');
            const toastMessage = document.getElementById('toast-message');
            const toastIcon = document.getElementById('toast-icon');

            if (!toast || !toastMessage) return;

            toastMessage.textContent = message;

            // Configure icon & theme based on type
            let iconClass = 'ph ph-check-circle text-xl';
            let bgClass = 'bg-soil text-white';

            if (type === 'error') {
                iconClass = 'ph ph-warning-circle text-xl text-white';
                bgClass = 'bg-terracotta text-white';
            } else if (type === 'info') {
                iconClass = 'ph ph-info text-xl text-leaf';
                bgClass = 'bg-soil text-white';
            } else {
                iconClass = 'ph ph-check-circle text-xl text-leaf';
                bgClass = 'bg-soil text-white';
            }

            if (toastIcon) {
                toastIcon.innerHTML = `<i class="${iconClass}"></i>`;
            }

            toast.className = `fixed bottom-6 right-6 ${bgClass} border border-wood/60 rounded-xl shadow-2xl p-4 flex items-center gap-3 transform transition-all duration-300 z-50 translate-y-0 opacity-100`;

            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                toast.classList.remove('translate-y-0', 'opacity-100');
                toast.classList.add('translate-y-20', 'opacity-0');
            }, duration);
        }
    };

    // Global shortcut
    window.showToast = window.Lexicon.UI.Toast.show;
})();
