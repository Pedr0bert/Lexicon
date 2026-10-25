/* ==========================================================================
   Lexicon - UI Modal Module
   ========================================================================== */

window.Lexicon = window.Lexicon || {};
window.Lexicon.UI = window.Lexicon.UI || {};

(function() {
    let openModalStack = [];

    window.Lexicon.UI.Modal = {
        /**
         * Open modal by ID with animated backdrop and scale
         * @param {string} id - Modal container element ID
         */
        open(id) {
            const modal = document.getElementById(id);
            if (!modal) return;

            const content = document.getElementById(`${id}-content`) || modal.querySelector('.modal-content');

            modal.classList.remove('hidden');
            document.body.classList.add('modal-open');

            // Trigger enter transitions on next frame
            requestAnimationFrame(() => {
                modal.classList.remove('opacity-0');
                if (content) {
                    content.classList.remove('scale-95', 'opacity-0');
                    content.classList.add('scale-100', 'opacity-100');
                }
            });

            if (!openModalStack.includes(id)) {
                openModalStack.push(id);
            }

            // Focus first relevant input
            setTimeout(() => {
                const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea, button');
                if (firstInput) firstInput.focus();
            }, 60);
        },

        /**
         * Close modal by ID with exit transitions
         * @param {string} id - Modal container element ID
         */
        close(id) {
            const modal = document.getElementById(id);
            if (!modal) return;

            const content = document.getElementById(`${id}-content`) || modal.querySelector('.modal-content');

            modal.classList.add('opacity-0');
            if (content) {
                content.classList.add('scale-95', 'opacity-0');
                content.classList.remove('scale-100', 'opacity-100');
            }

            openModalStack = openModalStack.filter(m => m !== id);
            if (openModalStack.length === 0) {
                document.body.classList.remove('modal-open');
            }

            if (id === 'inspector-modal' && window.Lexicon.Librarian) {
                window.Lexicon.Librarian.abortAll();
            }

            setTimeout(() => {
                modal.classList.add('hidden');
            }, 200);
        },

        /**
         * Close the topmost active modal
         */
        closeTop() {
            if (openModalStack.length > 0) {
                const topId = openModalStack[openModalStack.length - 1];
                this.close(topId);
                return true;
            }
            return false;
        },

        init() {
            // Global ESC key listener to close modals
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    if (this.closeTop()) {
                        e.stopPropagation();
                    }
                }
            });

            // Close on clicking backdrop outside .modal-content
            document.querySelectorAll('.modal-overlay').forEach(modal => {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.close(modal.id);
                    }
                });
            });
        }
    };

    // Global helper shortcuts
    window.openModal = (id) => window.Lexicon.UI.Modal.open(id);
    window.closeModal = (id) => window.Lexicon.UI.Modal.close(id);
})();
