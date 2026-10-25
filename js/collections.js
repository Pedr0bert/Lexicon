/* ==========================================================================
   Lexicon - Collections Management Module
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    window.Lexicon.Collections = {
        /**
         * Initialize event delegation for collections list
         */
        init() {
            const container = document.getElementById('collections-list');
            if (container && !container._hasDelegation) {
                container._hasDelegation = true;
                container.addEventListener('click', (e) => {
                    // Toggle expand/reduce
                    const expandBtn = e.target.closest('[data-action="toggle-collection-expand"]');
                    if (expandBtn) {
                        e.stopPropagation();
                        const colName = expandBtn.dataset.collectionName;
                        if (colName) this.toggleSidebarCollectionExpand(colName);
                        return;
                    }

                    // Delete collection
                    const deleteBtn = e.target.closest('[data-action="delete-collection"]');
                    if (deleteBtn) {
                        e.stopPropagation();
                        const colId = deleteBtn.dataset.collectionId;
                        const colName = deleteBtn.dataset.collectionName;
                        if (colId && colName) this.deleteCollection(colId, colName);
                        return;
                    }

                    // Inspect sub-article
                    const inspectItem = e.target.closest('[data-action="inspect-article"]');
                    if (inspectItem) {
                        e.stopPropagation();
                        const articleId = Number(inspectItem.dataset.articleId);
                        if (articleId && window.Lexicon.Articles) {
                            window.Lexicon.Articles.inspect(articleId);
                        }
                        return;
                    }

                    // Select collection
                    const selectDiv = e.target.closest('[data-action="select-collection"]');
                    if (selectDiv) {
                        const colName = selectDiv.dataset.collectionName;
                        if (colName) this.select(colName);
                        return;
                    }
                });
            }
        },

        /**
         * Toggle expand / reduce of the entire Collections section in the sidebar
         */
        toggleSidebarSection() {
            const state = window.Lexicon.State;
            state.sidebarCollectionsCollapsed = !state.sidebarCollectionsCollapsed;
            const chevron = document.getElementById('sidebar-collections-chevron');
            const container = document.getElementById('collections-list');

            if (state.sidebarCollectionsCollapsed) {
                if (chevron) chevron.className = 'ph ph-caret-right text-xs text-earth group-hover:text-jungle transition-transform';
                if (container) container.classList.add('hidden');
            } else {
                if (chevron) chevron.className = 'ph ph-caret-down text-xs text-earth group-hover:text-jungle transition-transform';
                if (container) container.classList.remove('hidden');
                this.render();
            }
        },

        /**
         * Toggle expansion of an individual collection in the sidebar tree
         */
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

        /**
         * Open modal to create collection
         */
        openCreateModal() {
            const input = document.getElementById('new-collection-name');
            if (input) input.value = '';
            window.Lexicon.UI.Modal.open('collection-modal');
            setTimeout(() => {
                if (input) input.focus();
            }, 80);
        },

        /**
         * Render collections in sidebar with dynamic counts and expandable document sub-trees
         */
        render() {
            const state = window.Lexicon.State;
            const container = document.getElementById('collections-list');
            const chevron = document.getElementById('sidebar-collections-chevron');
            if (!container) return;

            if (state.sidebarCollectionsCollapsed) {
                container.classList.add('hidden');
                if (chevron) chevron.className = 'ph ph-caret-right text-xs text-earth group-hover:text-jungle transition-transform';
                return;
            } else {
                container.classList.remove('hidden');
                if (chevron) chevron.className = 'ph ph-caret-down text-xs text-earth group-hover:text-jungle transition-transform';
            }

            // Recalculate article counts & map articles by collection
            const counts = {};
            const articlesByCol = {};
            state.articles.forEach(a => {
                if (a.collection && a.collection !== 'none') {
                    counts[a.collection] = (counts[a.collection] || 0) + 1;
                    articlesByCol[a.collection] = articlesByCol[a.collection] || [];
                    articlesByCol[a.collection].push(a);
                }
            });

            const i18n = window.Lexicon.I18n;
            const noColText = i18n ? i18n.t('collections.noCollections') : 'No collections yet';
            const emptyFolderText = i18n ? i18n.t('collections.emptyFolder') : '(Empty folder)';
            const reduceTitle = i18n ? i18n.t('collections.reduce') : 'Reduce collection';
            const expandTitle = i18n ? i18n.t('collections.expand') : 'Expand collection';
            const deleteTitle = i18n ? i18n.t('collections.deleteTitle') : 'Delete collection';

            if (state.collections.length === 0) {
                container.innerHTML = `
                    <div class="px-3 py-2 text-xs text-earth/70 italic sidebar-text">
                        ${noColText}
                    </div>
                `;
                return;
            }

            state.expandedSidebarCollections = state.expandedSidebarCollections || [];

            container.innerHTML = state.collections.map(col => {
                const count = counts[col.name] || 0;
                const isActive = state.currentFilter.type === 'collection' && state.currentFilter.value === col.name;
                const isExpanded = state.expandedSidebarCollections.includes(col.name);
                const colArticles = articlesByCol[col.name] || [];
                const safeName = window.Lexicon.Utils.escapeHTML(col.name);

                let subArticlesHtml = '';
                if (isExpanded) {
                    if (colArticles.length === 0) {
                        subArticlesHtml = `
                            <div class="ml-5 pl-2.5 border-l border-wood/70 py-1 text-[11px] text-earth/60 italic sidebar-text">
                                ${emptyFolderText}
                            </div>
                        `;
                    } else {
                        subArticlesHtml = `
                            <div class="ml-5 pl-2.5 border-l border-wood/70 space-y-0.5 py-1 sidebar-text">
                                ${colArticles.map(a => `
                                    <div data-action="inspect-article" data-article-id="${a.id}" 
                                         class="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-wood/40 text-[11px] text-soil/90 cursor-pointer truncate transition-colors" 
                                         title="${window.Lexicon.Utils.escapeHTML(a.title)}">
                                        <i class="ph ph-file-text text-xs text-earth/70 shrink-0"></i>
                                        <span class="truncate">${window.Lexicon.Utils.escapeHTML(a.title)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    }
                }

                return `
                    <div class="group rounded-lg transition-colors ${isActive ? 'bg-wood/40 font-medium text-soil' : 'hover:bg-wood/20'}">
                        <div class="flex items-center justify-between px-2 py-1.5 text-earth hover:text-soil cursor-pointer" data-collection="${safeName}">
                            <div class="flex items-center gap-1.5 min-w-0 flex-1">
                                <button type="button" data-action="toggle-collection-expand" data-collection-name="${safeName}" 
                                        class="p-1 hover:bg-wood/50 rounded text-earth/70 hover:text-soil transition-colors shrink-0 cursor-pointer" 
                                        title="${isExpanded ? reduceTitle : expandTitle}">
                                    <i class="ph-bold ${isExpanded ? 'ph-caret-down' : 'ph-caret-right'} text-[10px]"></i>
                                </button>
                                <div class="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" data-action="select-collection" data-collection-name="${safeName}">
                                    <i class="ph ${isExpanded ? 'ph-folder-open text-jungle' : 'ph-folder text-leaf'} text-base shrink-0"></i>
                                    <span class="sidebar-text text-xs truncate font-medium">${safeName}</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-1 shrink-0">
                                <span class="sidebar-text text-[10px] font-semibold bg-wood/50 text-soil px-1.5 py-0.5 rounded-full">${count}</span>
                                <button type="button" data-action="delete-collection" data-collection-id="${col.id}" data-collection-name="${safeName}" 
                                        class="text-earth/60 hover:text-terracotta opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded ml-0.5 sidebar-text cursor-pointer" 
                                        title="${deleteTitle}">
                                    <i class="ph ph-trash text-xs"></i>
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
         * @param {string} name
         */
        select(name) {
            if (window.Lexicon.Navigation) {
                window.Lexicon.Navigation.recordNavigation();
            }
            const state = window.Lexicon.State;
            state.currentFilter = {
                type: 'collection',
                value: name,
                title: name
            };
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
            const state = window.Lexicon.State;
            const uploadSelect = document.getElementById('form-collection');
            const inspectorSelect = document.getElementById('inspector-collection');
            const importDefaultSelect = document.getElementById('import-opt-default-collection');

            const defaultLabel = window.Lexicon.I18n ? `(${window.Lexicon.I18n.t('folders.unfiled')})` : '(None / General)';
            const optionsHtml = `<option value="">${defaultLabel}</option>` + 
                state.collections.map(c => `<option value="${window.Lexicon.Utils.escapeHTML(c.name)}">${window.Lexicon.Utils.escapeHTML(c.name)}</option>`).join('');

            if (uploadSelect) uploadSelect.innerHTML = optionsHtml;
            if (inspectorSelect) inspectorSelect.innerHTML = optionsHtml;
            if (importDefaultSelect) importDefaultSelect.innerHTML = optionsHtml;
        },

        /**
         * Get existing collection or create a new one safely
         * @param {string} name
         * @returns {object|null}
         */
        getOrCreate(name) {
            if (!name || !name.trim()) return null;
            const cleanName = name.trim();
            const state = window.Lexicon.State;
            let existing = state.collections.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
            if (!existing) {
                existing = {
                    id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    name: cleanName
                };
                state.collections.push(existing);
                window.Lexicon.Storage.save();
                this.render();
                this.populateSelects();
            }
            return existing;
        },

        /**
         * Create a new collection
         */
        create() {
            const input = document.getElementById('new-collection-name');
            if (!input) return;

            const name = input.value.trim();
            const i18n = window.Lexicon.I18n;

            if (!name) {
                const msg = i18n ? i18n.t('collections.nameRequired') : 'Please enter a collection name';
                window.Lexicon.UI.Toast.show(msg, 'error');
                return;
            }

            const state = window.Lexicon.State;
            if (state.collections.some(c => c.name.toLowerCase() === name.toLowerCase())) {
                const msg = i18n ? i18n.t('collections.alreadyExists') : 'A collection with this name already exists';
                window.Lexicon.UI.Toast.show(msg, 'error');
                return;
            }

            const newCol = {
                id: `c_${Date.now()}`,
                name: name
            };

            state.collections.push(newCol);
            window.Lexicon.Storage.save();
            this.render();
            this.populateSelects();
            window.Lexicon.UI.Modal.close('collection-modal');
            input.value = '';

            const successMsg = i18n ? i18n.t('collections.createdToast', { name }) : `Collection "${name}" created`;
            window.Lexicon.UI.Toast.show(successMsg, 'success');
        },

        /**
         * Delete a collection
         * @param {string} id
         * @param {string} name
         */
        deleteCollection(id, name) {
            const i18n = window.Lexicon.I18n;
            const confirmMsg = i18n ? 
                i18n.t('collections.confirmDelete', { name }) : 
                `Are you sure you want to delete collection "${name}"? Articles in it will remain in your library.`;

            if (!confirm(confirmMsg)) {
                return;
            }

            const state = window.Lexicon.State;
            state.collections = state.collections.filter(c => c.id !== id);

            // Remove collection tag from articles
            state.articles.forEach(a => {
                if (a.collection === name) {
                    a.collection = null;
                }
            });

            if (state.currentFilter.type === 'collection' && state.currentFilter.value === name) {
                if (window.Lexicon.Navigation) {
                    window.Lexicon.Navigation.recordNavigation();
                }
                const allTitle = i18n ? i18n.t('nav.all') : 'All Documents';
                state.currentFilter = { type: 'category', value: 'all', title: allTitle };
                state.activeTag = null;
                state.searchQuery = '';
                state.semanticFilter = null;
                state.selectedIds = [];
            }

            window.Lexicon.Storage.save();
            this.render();
            this.populateSelects();
            window.Lexicon.Articles.render();

            const deletedMsg = i18n ? i18n.t('collections.deletedToast', { name }) : `Collection "${name}" deleted`;
            window.Lexicon.UI.Toast.show(deletedMsg, 'info');
        }
    };
})();
