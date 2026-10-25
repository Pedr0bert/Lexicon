/* ==========================================================================
   Lexicon - Collections Management Module
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    const U = () => window.Lexicon.Utils;
    const esc = (s) => U().escapeHTML(s);
    const tr = (k, f, p) => U().tr(k, f, p);

    window.Lexicon.Collections = {
        /**
         * Initialize event delegation for collections list
         */
        init() {
            const container = document.getElementById('collections-list');
            if (container && !container._hasDelegation) {
                container._hasDelegation = true;
                container.addEventListener('click', (e) => {
                    const expandBtn = e.target.closest('[data-action="toggle-collection-expand"]');
                    if (expandBtn) {
                        e.stopPropagation();
                        const colName = expandBtn.dataset.collectionName;
                        if (colName) this.toggleSidebarCollectionExpand(colName);
                        return;
                    }

                    const renameBtn = e.target.closest('[data-action="rename-collection"]');
                    if (renameBtn) {
                        e.stopPropagation();
                        this.promptRename(renameBtn.dataset.collectionId);
                        return;
                    }

                    const deleteBtn = e.target.closest('[data-action="delete-collection"]');
                    if (deleteBtn) {
                        e.stopPropagation();
                        const colId = deleteBtn.dataset.collectionId;
                        const colName = deleteBtn.dataset.collectionName;
                        if (colId && colName) this.deleteCollection(colId, colName);
                        return;
                    }

                    const inspectItem = e.target.closest('[data-action="inspect-article"]');
                    if (inspectItem) {
                        e.stopPropagation();
                        const articleId = Number(inspectItem.dataset.articleId);
                        if (articleId && window.Lexicon.Articles) {
                            window.Lexicon.Articles.inspect(articleId);
                        }
                        return;
                    }

                    const selectDiv = e.target.closest('[data-action="select-collection"]');
                    if (selectDiv) {
                        const colName = selectDiv.dataset.collectionName;
                        if (colName) this.select(colName);
                    }
                });

                container.addEventListener('keydown', (e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    const target = e.target.closest('[data-action="select-collection"], [data-action="inspect-article"]');
                    if (target) {
                        e.preventDefault();
                        target.click();
                    }
                });
            }
        },

        /** Find a collection by name (case-insensitive) */
        findByName(name) {
            if (!name) return null;
            const lower = String(name).trim().toLowerCase();
            return window.Lexicon.State.collections.find(c => c.name.toLowerCase() === lower) || null;
        },

        /**
         * Build <option> list for a collection <select>, fully escaped.
         * @param {{noneLabel?: string, noneValue?: string, extra?: string}} [opts]
         */
        optionsHtml(opts = {}) {
            const state = window.Lexicon.State;
            const noneLabel = opts.noneLabel || `(${tr('folders.unfiled', 'Sem coleção')})`;
            const noneValue = opts.noneValue !== undefined ? opts.noneValue : '';
            return (opts.extra || '') +
                `<option value="${esc(noneValue)}">${esc(noneLabel)}</option>` +
                state.collections.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
        },

        /** Fill a <select> with collections and select `value` (adds it if unknown) */
        fillSelect(select, value, opts = {}) {
            if (!select) return;
            select.innerHTML = this.optionsHtml(opts);
            const v = value || '';
            if (v && !Array.from(select.options).some(o => o.value === v)) {
                const opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                select.appendChild(opt);
            }
            select.value = v;
        },

        toggleSidebarSection() {
            const state = window.Lexicon.State;
            state.sidebarCollectionsCollapsed = !state.sidebarCollectionsCollapsed;
            this.render();
        },

        toggleSidebarCollectionExpand(colName) {
            const state = window.Lexicon.State;
            state.expandedSidebarCollections = state.expandedSidebarCollections || [];
            const idx = state.expandedSidebarCollections.indexOf(colName);
            if (idx >= 0) {
                state.expandedSidebarCollections.splice(idx, 1);
            } else {
                state.expandedSidebarCollections.push(colName);
            }
            this.render();
        },

        openCreateModal() {
            const input = document.getElementById('new-collection-name');
            if (input) input.value = '';
            window.Lexicon.UI.Modal.open('collection-modal', { focus: '#new-collection-name' });
        },

        /**
         * Render collections in sidebar with dynamic counts and expandable document sub-trees
         */
        render() {
            const state = window.Lexicon.State;
            const container = document.getElementById('collections-list');
            const chevron = document.getElementById('sidebar-collections-chevron');
            if (!container) return;

            const toggleBtn = chevron ? chevron.closest('button') : null;
            if (toggleBtn) toggleBtn.setAttribute('aria-expanded', String(!state.sidebarCollectionsCollapsed));

            if (state.sidebarCollectionsCollapsed) {
                container.classList.add('hidden');
                if (chevron) chevron.className = 'ph ph-caret-right text-xs text-earth group-hover:text-jungle transition-transform';
                return;
            }
            container.classList.remove('hidden');
            if (chevron) chevron.className = 'ph ph-caret-down text-xs text-earth group-hover:text-jungle transition-transform';

            const counts = {};
            const articlesByCol = {};
            state.articles.forEach(a => {
                if (a.collection) {
                    counts[a.collection] = (counts[a.collection] || 0) + 1;
                    (articlesByCol[a.collection] = articlesByCol[a.collection] || []).push(a);
                }
            });

            const noColText = esc(tr('collections.noCollections', 'No collections yet'));
            const emptyFolderText = esc(tr('collections.emptyFolder', '(Empty folder)'));
            const reduceTitle = esc(tr('collections.reduce', 'Reduce collection'));
            const expandTitle = esc(tr('collections.expand', 'Expand collection'));
            const deleteTitle = esc(tr('collections.deleteTitle', 'Delete collection'));
            const renameTitle = esc(tr('collections.renameTitle', 'Renomear coleção'));

            if (state.collections.length === 0) {
                container.innerHTML = `<div class="px-3 py-2 text-xs text-earth/70 italic sidebar-text">${noColText}</div>`;
                return;
            }

            state.expandedSidebarCollections = state.expandedSidebarCollections || [];

            container.innerHTML = state.collections.map(col => {
                const count = counts[col.name] || 0;
                const isActive = state.currentFilter.type === 'collection' && state.currentFilter.value === col.name;
                const isExpanded = state.expandedSidebarCollections.includes(col.name);
                const colArticles = articlesByCol[col.name] || [];
                const safeName = esc(col.name);
                const safeId = esc(col.id);

                let subArticlesHtml = '';
                if (isExpanded) {
                    subArticlesHtml = colArticles.length === 0
                        ? `<div class="ml-5 pl-2.5 border-l border-wood/70 py-1 text-[11px] text-earth/60 italic sidebar-text">${emptyFolderText}</div>`
                        : `<div class="ml-5 pl-2.5 border-l border-wood/70 space-y-0.5 py-1 sidebar-text">
                                ${colArticles.map(a => `
                                    <div data-action="inspect-article" data-article-id="${Number(a.id)}" role="button" tabindex="0"
                                         class="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-wood/40 text-[11px] text-soil/90 cursor-pointer truncate transition-colors"
                                         title="${esc(a.title)}">
                                        <i class="ph ph-file-text text-xs text-earth/70 shrink-0" aria-hidden="true"></i>
                                        <span class="truncate">${esc(a.title)}</span>
                                    </div>
                                `).join('')}
                           </div>`;
                }

                return `
                    <div class="group rounded-lg transition-colors ${isActive ? 'bg-wood/40 font-medium text-soil' : 'hover:bg-wood/20'}">
                        <div class="flex items-center justify-between px-2 py-1.5 text-earth hover:text-soil cursor-pointer">
                            <div class="flex items-center gap-1.5 min-w-0 flex-1">
                                <button type="button" data-action="toggle-collection-expand" data-collection-name="${safeName}"
                                        class="p-1 hover:bg-wood/50 rounded text-earth/70 hover:text-soil transition-colors shrink-0 cursor-pointer"
                                        title="${isExpanded ? reduceTitle : expandTitle}" aria-label="${isExpanded ? reduceTitle : expandTitle}" aria-expanded="${isExpanded}">
                                    <i class="ph-bold ${isExpanded ? 'ph-caret-down' : 'ph-caret-right'} text-[10px]" aria-hidden="true"></i>
                                </button>
                                <div class="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" data-action="select-collection" data-collection-name="${safeName}" role="button" tabindex="0" ${isActive ? 'aria-current="true"' : ''}>
                                    <i class="ph ${isExpanded ? 'ph-folder-open text-jungle' : 'ph-folder text-leaf'} text-base shrink-0" aria-hidden="true"></i>
                                    <span class="sidebar-text text-xs truncate font-medium">${safeName}</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-0.5 shrink-0">
                                <span class="sidebar-text text-[10px] font-semibold bg-wood/50 text-soil px-1.5 py-0.5 rounded-full">${count}</span>
                                <button type="button" data-action="rename-collection" data-collection-id="${safeId}"
                                        class="text-earth/60 hover:text-jungle opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5 rounded ml-0.5 sidebar-text cursor-pointer"
                                        title="${renameTitle}" aria-label="${renameTitle}">
                                    <i class="ph ph-pencil-simple text-xs" aria-hidden="true"></i>
                                </button>
                                <button type="button" data-action="delete-collection" data-collection-id="${safeId}" data-collection-name="${safeName}"
                                        class="text-earth/60 hover:text-terracotta opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5 rounded sidebar-text cursor-pointer"
                                        title="${deleteTitle}" aria-label="${deleteTitle}">
                                    <i class="ph ph-trash text-xs" aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>
                        ${subArticlesHtml}
                    </div>
                `;
            }).join('');
        },

        /**
         * Select a collection to filter by with clean filter reset
         */
        select(name) {
            if (window.Lexicon.Navigation) {
                window.Lexicon.Navigation.recordNavigation();
            }
            const state = window.Lexicon.State;
            state.currentFilter = { type: 'collection', value: name, title: name };
            state.activeTag = null;
            state.searchQuery = '';
            state.semanticFilter = null;
            state.selectedIds = [];

            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.value = '';

            document.querySelectorAll('#sidebar .nav-link').forEach(l => l.classList.remove('active'));
            this.render();
            window.Lexicon.Articles.render();
        },

        /**
         * Populate all collection dropdowns in forms
         */
        populateSelects() {
            const uploadSelect = document.getElementById('form-collection');
            const inspectorSelect = document.getElementById('inspector-collection');
            const importDefaultSelect = document.getElementById('import-opt-default-collection');

            [uploadSelect, inspectorSelect, importDefaultSelect].forEach(sel => {
                if (!sel) return;
                const current = sel.value;
                this.fillSelect(sel, current);
            });
        },

        /**
         * Get existing collection or create a new one safely
         * @param {string} name
         * @param {{silent?: boolean}} [opts] silent: don't save/render (caller does it)
         * @returns {object|null}
         */
        getOrCreate(name, opts = {}) {
            if (!name || !String(name).trim()) return null;
            const cleanName = String(name).trim().slice(0, 120);
            const state = window.Lexicon.State;
            let existing = this.findByName(cleanName);
            if (!existing) {
                existing = { id: U().newCollectionId(), name: cleanName };
                state.collections.push(existing);
                if (!opts.silent) {
                    window.Lexicon.Storage.save();
                    this.render();
                    this.populateSelects();
                }
            }
            return existing;
        },

        /**
         * Create a new collection from the modal
         */
        create() {
            const input = document.getElementById('new-collection-name');
            if (!input) return;

            const name = input.value.trim();
            if (!name) {
                window.Lexicon.UI.Toast.show(tr('collections.nameRequired', 'Please enter a collection name'), 'error');
                return;
            }
            if (this.findByName(name)) {
                window.Lexicon.UI.Toast.show(tr('collections.alreadyExists', 'A collection with this name already exists'), 'error');
                return;
            }

            this.getOrCreate(name);
            window.Lexicon.UI.Modal.close('collection-modal');
            input.value = '';
            window.Lexicon.Articles.render();
            window.Lexicon.UI.Toast.show(tr('collections.createdToast', 'Collection "{name}" created', { name }), 'success');
        },

        promptRename(id) {
            const state = window.Lexicon.State;
            const col = state.collections.find(c => c.id === id);
            if (!col) return;
            const next = window.prompt(tr('collections.renamePrompt', 'Novo nome para a coleção "{name}":', { name: col.name }), col.name);
            if (next === null) return;
            this.renameCollection(id, next);
        },

        /** Rename a collection and move all its documents */
        renameCollection(id, newName) {
            const state = window.Lexicon.State;
            const col = state.collections.find(c => c.id === id);
            const clean = String(newName || '').trim().slice(0, 120);
            if (!col || !clean || clean === col.name) return false;
            const clash = this.findByName(clean);
            if (clash && clash.id !== id) {
                window.Lexicon.UI.Toast.show(tr('collections.alreadyExists', 'A collection with this name already exists'), 'error');
                return false;
            }
            const oldName = col.name;
            col.name = clean;
            state.articles.forEach(a => { if (a.collection === oldName) a.collection = clean; });
            const swap = (arr) => Array.isArray(arr) ? arr.map(n => n === oldName ? clean : n) : arr;
            state.expandedSidebarCollections = swap(state.expandedSidebarCollections);
            state.expandedFolders = swap(state.expandedFolders);
            if (state.currentFilter.type === 'collection' && state.currentFilter.value === oldName) {
                state.currentFilter = { type: 'collection', value: clean, title: clean };
            }
            window.Lexicon.Storage.save();
            this.render();
            this.populateSelects();
            window.Lexicon.Articles.render();
            window.Lexicon.UI.Toast.show(tr('collections.renamedToast', 'Coleção renomeada para "{name}"', { name: clean }), 'success');
            return true;
        },

        /**
         * Delete a collection (documents stay in the library, unfiled)
         */
        deleteCollection(id, name) {
            const confirmMsg = tr('collections.confirmDelete',
                'Are you sure you want to delete collection "{name}"? Articles in it will remain in your library.', { name });

            if (!confirm(confirmMsg)) return;

            const state = window.Lexicon.State;
            state.collections = state.collections.filter(c => c.id !== id);
            state.articles.forEach(a => {
                if (a.collection === name) a.collection = null;
            });
            state.expandedSidebarCollections = (state.expandedSidebarCollections || []).filter(n => n !== name);

            if (state.currentFilter.type === 'collection' && state.currentFilter.value === name) {
                if (window.Lexicon.Navigation) window.Lexicon.Navigation.recordNavigation();
                state.currentFilter = { type: 'category', value: 'all', title: tr('nav.all', 'All Documents') };
                state.activeTag = null;
                state.searchQuery = '';
                state.semanticFilter = null;
                state.selectedIds = [];
            }

            window.Lexicon.Storage.save();
            this.render();
            this.populateSelects();
            window.Lexicon.Articles.render();
            window.Lexicon.UI.Toast.show(tr('collections.deletedToast', 'Collection "{name}" deleted', { name }), 'info');
        }
    };
})();
