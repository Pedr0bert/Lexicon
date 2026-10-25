/* ==========================================================================
   Lexicon - UI Modal Module
   Single source of truth for opening/closing dialogs: modal stack, Escape key,
   backdrop clicks, focus trap/restore, ARIA attributes and close hooks.
   ========================================================================== */

window.Lexicon = window.Lexicon || {};
window.Lexicon.UI = window.Lexicon.UI || {};

(function() {
    let openModalStack = [];
    const beforeCloseHooks = new Map(); // id -> fn() ; return false to cancel
    const afterCloseHooks = new Map();  // id -> [fn]
    const lastFocused = new Map();      // id -> element focused before opening
    const hideTimers = new Map();

    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

    function visibleFocusables(modal) {
        return Array.from(modal.querySelectorAll(FOCUSABLE)).filter(el => {
            if (el.closest('.hidden')) return false;
            return el.offsetParent !== null || el === document.activeElement;
        });
    }

    window.Lexicon.UI.Modal = {
        /**
         * Open modal by ID with animated backdrop and scale
         * @param {string} id - Modal container element ID
         * @param {{focus?: string|HTMLElement|false}} [opts]
         */
        open(id, opts = {}) {
            const modal = document.getElementById(id);
            if (!modal) return;

            clearTimeout(hideTimers.get(id));
            const content = document.getElementById(`${id}-content`) || modal.querySelector('.modal-content');

            if (!openModalStack.includes(id)) {
                lastFocused.set(id, document.activeElement);
                openModalStack.push(id);
            }

            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.removeAttribute('aria-hidden');
            const heading = modal.querySelector('h2, h3');
            if (heading) {
                if (!heading.id) heading.id = `${id}-heading`;
                modal.setAttribute('aria-labelledby', heading.id);
            }

            modal.classList.remove('hidden');
            document.body.classList.add('modal-open');
            // Keep the newest modal on top
            modal.style.zIndex = String(50 + openModalStack.indexOf(id));

            requestAnimationFrame(() => {
                modal.classList.remove('opacity-0');
                if (content) {
                    content.classList.remove('scale-95', 'opacity-0');
                    content.classList.add('scale-100', 'opacity-100');
                }
            });

            if (opts.focus !== false) {
                setTimeout(() => {
                    let target = null;
                    if (typeof opts.focus === 'string') target = modal.querySelector(opts.focus);
                    else if (opts.focus instanceof HTMLElement) target = opts.focus;
                    if (!target) {
                        target = modal.querySelector('[autofocus]') ||
                            visibleFocusables(modal).find(el => el.matches('input, select, textarea')) ||
                            visibleFocusables(modal)[0];
                    }
                    if (target && typeof target.focus === 'function') target.focus();
                }, 60);
            }
        },

        /**
         * Close modal by ID with exit transitions
         * @param {string} id - Modal container element ID
         * @param {{skipHooks?: boolean}} [opts]
         */
        close(id, opts = {}) {
            const modal = document.getElementById(id);
            if (!modal || !openModalStack.includes(id) && modal.classList.contains('hidden')) return;

            if (!opts.skipHooks && beforeCloseHooks.has(id)) {
                try {
                    if (beforeCloseHooks.get(id)() === false) return;
                } catch (e) {
                    console.error(`[Modal] beforeClose hook for ${id} failed:`, e);
                }
            }

            const content = document.getElementById(`${id}-content`) || modal.querySelector('.modal-content');

            modal.classList.add('opacity-0');
            modal.setAttribute('aria-hidden', 'true');
            if (content) {
                content.classList.add('scale-95', 'opacity-0');
                content.classList.remove('scale-100', 'opacity-100');
            }

            openModalStack = openModalStack.filter(m => m !== id);
            if (openModalStack.length === 0) {
                document.body.classList.remove('modal-open');
            }

            clearTimeout(hideTimers.get(id));
            hideTimers.set(id, setTimeout(() => {
                if (!openModalStack.includes(id)) modal.classList.add('hidden');
            }, 200));

            // Restore focus to the element that opened the dialog
            const prev = lastFocused.get(id);
            lastFocused.delete(id);
            if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
                setTimeout(() => prev.focus(), 0);
            }

            (afterCloseHooks.get(id) || []).forEach(fn => {
                try { fn(); } catch (e) { console.error(`[Modal] onClose hook for ${id} failed:`, e); }
            });
        },

        isOpen(id) {
            return openModalStack.includes(id);
        },

        topId() {
            return openModalStack.length ? openModalStack[openModalStack.length - 1] : null;
        },

        /** Register a function run before a modal closes (return false to cancel). */
        beforeClose(id, fn) {
            beforeCloseHooks.set(id, fn);
        },

        /** Register a function run after a modal closes. */
        onClose(id, fn) {
            if (!afterCloseHooks.has(id)) afterCloseHooks.set(id, []);
            afterCloseHooks.get(id).push(fn);
        },

        /**
         * Close the topmost active modal
         */
        closeTop() {
            const topId = this.topId();
            if (topId) {
                this.close(topId);
                return true;
            }
            return false;
        },

        init() {
            if (this._initialized) return;
            this._initialized = true;

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    // Components (autocomplete popups, menus) call preventDefault to consume Escape
                    if (e.defaultPrevented) return;
                    if (this.closeTop()) {
                        e.preventDefault();
                    }
                    return;
                }

                // Focus trap inside the topmost modal
                if (e.key === 'Tab') {
                    const topId = this.topId();
                    if (!topId) return;
                    const modal = document.getElementById(topId);
                    if (!modal) return;
                    const items = visibleFocusables(modal);
                    if (!items.length) return;
                    const first = items[0];
                    const last = items[items.length - 1];
                    if (!modal.contains(document.activeElement)) {
                        e.preventDefault();
                        first.focus();
                    } else if (e.shiftKey && document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    } else if (!e.shiftKey && document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            });

            // Close on clicking the backdrop (only when the press started AND ended on it)
            document.querySelectorAll('.modal-overlay').forEach(modal => {
                if (modal.dataset.noBackdropClose === 'true') return;
                let downOnBackdrop = false;
                modal.addEventListener('mousedown', (e) => { downOnBackdrop = e.target === modal; });
                modal.addEventListener('click', (e) => {
                    if (e.target === modal && downOnBackdrop) {
                        this.close(modal.id);
                    }
                    downOnBackdrop = false;
                });
            });
        }
    };

    // Global helper shortcuts
    window.openModal = (id) => window.Lexicon.UI.Modal.open(id);
    window.closeModal = (id) => window.Lexicon.UI.Modal.close(id);
})();
