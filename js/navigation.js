/* ==========================================================================
   Lexicon - Navigation History Controller
   Provides page return capabilities with back and forward navigation
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    const MAX_HISTORY = 100;
    const historyStack = [];
    const forwardStack = [];
    let isNavigating = false;

    window.Lexicon.Navigation = {
        init() {
            if (this._initialized) return;
            this._initialized = true;
            // Keyboard shortcuts: Alt + Left Arrow for Back, Alt + Right Arrow for Forward
            document.addEventListener('keydown', (e) => {
                const el = document.activeElement;
                const activeTag = el ? el.tagName.toLowerCase() : '';
                const isTyping = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || (el && el.isContentEditable);
                if (isTyping) return;
                // Don't navigate the library behind an open dialog
                if (window.Lexicon.UI && window.Lexicon.UI.Modal && window.Lexicon.UI.Modal.topId()) return;

                if (e.altKey && e.key === 'ArrowLeft') {
                    e.preventDefault();
                    this.back();
                } else if (e.altKey && e.key === 'ArrowRight') {
                    e.preventDefault();
                    this.forward();
                }
            });

            this.updateButtons();
        },

        getCurrentSnapshot() {
            const state = window.Lexicon.State;
            return {
                currentFilter: structuredClone(state.currentFilter),
                activeTag: state.activeTag,
                searchQuery: state.searchQuery || '',
                semanticFilter: state.semanticFilter ? structuredClone(state.semanticFilter) : null
            };
        },

        isEqual(snapA, snapB) {
            if (!snapA || !snapB) return false;
            return snapA.currentFilter.type === snapB.currentFilter.type &&
                   snapA.currentFilter.value === snapB.currentFilter.value &&
                   snapA.activeTag === snapB.activeTag &&
                   snapA.searchQuery === snapB.searchQuery &&
                   JSON.stringify(snapA.semanticFilter) === JSON.stringify(snapB.semanticFilter);
        },

        recordNavigation() {
            if (isNavigating) return;
            const current = this.getCurrentSnapshot();
            const last = historyStack[historyStack.length - 1];
            if (!this.isEqual(current, last)) {
                historyStack.push(current);
                if (historyStack.length > MAX_HISTORY) historyStack.shift();
                forwardStack.length = 0; // Clear forward stack on new navigation
                this.updateButtons();
            }
        },

        back() {
            if (historyStack.length === 0) return;
            isNavigating = true;

            const current = this.getCurrentSnapshot();
            forwardStack.push(current);

            const previous = historyStack.pop();
            this.applyState(previous);

            isNavigating = false;
            this.updateButtons();
        },

        forward() {
            if (forwardStack.length === 0) return;
            isNavigating = true;

            const current = this.getCurrentSnapshot();
            historyStack.push(current);

            const next = forwardStack.pop();
            this.applyState(next);

            isNavigating = false;
            this.updateButtons();
        },

        applyState(snapshot) {
            const state = window.Lexicon.State;
            state.currentFilter = structuredClone(snapshot.currentFilter);
            state.activeTag = snapshot.activeTag;
            state.searchQuery = snapshot.searchQuery || '';
            state.semanticFilter = snapshot.semanticFilter ? structuredClone(snapshot.semanticFilter) : null;
            state.selectedIds = []; // Reset batch selection across navigation steps

            // Sync localized title if it is a category filter
            if (state.currentFilter && state.currentFilter.type === 'category' && window.Lexicon.I18n) {
                state.currentFilter.title = window.Lexicon.I18n.t(`nav.${state.currentFilter.value}`) || state.currentFilter.title;
            }

            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.value = state.semanticFilter ? state.semanticFilter.originalQuery : state.searchQuery;
            }

            this.updateActiveSidebarLink();

            window.Lexicon.Collections.render();
            window.Lexicon.Articles.render();
        },

        /**
         * Keep sidebar .nav-link active state synchronized with State.currentFilter
         */
        updateActiveSidebarLink() {
            const state = window.Lexicon.State;
            if (!state || !state.currentFilter) return;

            document.querySelectorAll('#sidebar .nav-link[data-filter]').forEach(link => {
                const f = link.dataset.filter;
                if (state.currentFilter.type === 'category' && f === state.currentFilter.value) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });

            if (state.currentFilter.type === 'collection') {
                document.querySelectorAll('#sidebar .nav-link[data-filter]').forEach(l => l.classList.remove('active'));
            }
        },

        updateButtons() {
            const btnBack = document.getElementById('btn-nav-back');
            const btnForward = document.getElementById('btn-nav-forward');
            const pageBackBtn = document.getElementById('page-back-button');

            const canBack = historyStack.length > 0;
            const canForward = forwardStack.length > 0;

            if (btnBack) {
                btnBack.disabled = !canBack;
            }

            if (btnForward) {
                btnForward.disabled = !canForward;
            }

            if (pageBackBtn) {
                if (canBack) {
                    pageBackBtn.classList.remove('hidden');
                    pageBackBtn.classList.add('flex');
                } else {
                    pageBackBtn.classList.add('hidden');
                    pageBackBtn.classList.remove('flex');
                }
            }
        }
    };
})();
