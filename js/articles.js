/* ==========================================================================
   Lexicon - Articles & Document Manager Module
   Intelligent file organization, document overview, inspection & native read
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    window.Lexicon.Articles = {
        /**
         * Initialize central event delegation for articles container and modals
         */
        init() {
            // 1. Container delegation for cards, rows, tags, folders, favorites, selections, read
            const container = document.getElementById('articles-container');
            if (container && !container._hasDelegation) {
                container._hasDelegation = true;
                container.addEventListener('click', (e) => {
                    // Tag filter
                    const tagChip = e.target.closest('[data-action="filter-tag"]');
                    if (tagChip) {
                        e.stopPropagation();
                        const tag = tagChip.dataset.tagName;
                        if (tag) this.filterByTag(tag);
                        return;
                    }

                    // Favorite button
                    const favBtn = e.target.closest('[data-action="toggle-favorite"]');
                    if (favBtn) {
                        e.stopPropagation();
                        const id = Number(favBtn.dataset.articleId);
                        if (id) this.toggleFavorite(id);
                        return;
                    }

                    // Select checkbox
                    const selectBox = e.target.closest('[data-action="toggle-select"]');
                    if (selectBox) {
                        e.stopPropagation();
                        const id = Number(selectBox.dataset.articleId);
                        if (id) this.toggleSelect(id);
                        return;
                    }

                    // Read document
                    const readBtn = e.target.closest('[data-action="read-article"]');
                    if (readBtn) {
                        e.stopPropagation();
                        const id = Number(readBtn.dataset.articleId);
                        if (id) {
                            window.Lexicon.State.inspectedArticleId = id;
                            this.openDocumentForReading();
                        }
                        return;
                    }

                    // Folder toggles and actions
                    const folderToggle = e.target.closest('[data-action="toggle-folder-expand"]');
                    if (folderToggle) {
                        e.stopPropagation();
                        const folderName = folderToggle.dataset.folderName;
                        if (folderName) this.toggleFolderExpand(folderName);
                        return;
                    }

                    const folderAdd = e.target.closest('[data-action="add-folder-doc"]');
                    if (folderAdd) {
                        e.stopPropagation();
                        const folderName = folderAdd.dataset.folderName;
                        if (folderName) this.openAddModalForCollection(folderName);
                        return;
                    }

                    const folderSelect = e.target.closest('[data-action="select-folder"]');
                    if (folderSelect) {
                        e.stopPropagation();
                        const folderName = folderSelect.dataset.folderName;
                        if (folderName && window.Lexicon.Collections) window.Lexicon.Collections.select(folderName);
                        return;
                    }

                    const folderDelete = e.target.closest('[data-action="delete-folder"]');
                    if (folderDelete) {
                        e.stopPropagation();
                        const id = folderDelete.dataset.folderId;
                        const name = folderDelete.dataset.folderName;
                        if (id && name && window.Lexicon.Collections) window.Lexicon.Collections.deleteCollection(id, name);
                        return;
                    }

                    const toggleAll = e.target.closest('[data-action="toggle-all-folders"]');
                    if (toggleAll) {
                        e.stopPropagation();
                        const expand = toggleAll.dataset.expand === 'true';
                        this.toggleAllFolders(expand);
                        return;
                    }

                    const createCol = e.target.closest('[data-action="create-collection-modal"]');
                    if (createCol) {
                        e.stopPropagation();
                        if (window.Lexicon.Collections) window.Lexicon.Collections.openCreateModal();
                        return;
                    }

                    // Card or row click -> inspect article
                    const articleItem = e.target.closest('[data-action="inspect-article"]');
                    if (articleItem) {
                        const id = Number(articleItem.dataset.articleId);
                        if (id) this.inspect(id);
                        return;
                    }
                });
            }

            // 2. Inspector tags list delegation
            const tagsList = document.getElementById('inspector-tags-list');
            if (tagsList && !tagsList._hasDelegation) {
                tagsList._hasDelegation = true;
                tagsList.addEventListener('click', (e) => {
                    const removeBtn = e.target.closest('[data-action="remove-inspected-tag"]');
                    if (removeBtn) {
                        e.stopPropagation();
                        const tag = removeBtn.dataset.tagName;
                        if (tag) this.removeTagFromInspected(tag);
                        return;
                    }
                });
            }

            // 3. Staged multi-upload preview list delegation
            const stagedList = document.getElementById('multi-file-preview');
            if (stagedList && !stagedList._hasDelegation) {
                stagedList._hasDelegation = true;
                stagedList.addEventListener('click', (e) => {
                    const removeBtn = e.target.closest('[data-action="remove-staged-file"]');
                    if (removeBtn) {
                        e.stopPropagation();
                        const idx = Number(removeBtn.dataset.index);
                        if (!isNaN(idx)) this.removeStagedFile(idx);
                        return;
                    }
                });
            }

            // 4. Active filter banner delegation
            const banner = document.getElementById('active-filter-banner');
            if (banner && !banner._hasDelegation) {
                banner._hasDelegation = true;
                banner.addEventListener('click', (e) => {
                    const clearSem = e.target.closest('[data-action="clear-semantic-filter"]');
                    if (clearSem) {
                        e.stopPropagation();
                        if (window.Lexicon.Librarian) window.Lexicon.Librarian.clearSemanticFilter();
                        return;
                    }

                    const clearTag = e.target.closest('[data-action="clear-tag-filter"]');
                    if (clearTag) {
                        e.stopPropagation();
                        this.clearTagFilter();
                        return;
                    }
                });
            }
        },

        /**
         * Get filtered and sorted list of articles
         */
        getFilteredArticles() {
            const state = window.Lexicon.State;
            let list = [...state.articles];

            // 1. Filter by category / status / collection
            if (state.currentFilter.type === 'category') {
                const filter = state.currentFilter.value;
                if (filter === 'inbox') {
                    list = list.filter(a => a.status === 'inbox');
                } else if (filter === 'reading') {
                    list = list.filter(a => a.status === 'reading');
                } else if (filter === 'processing') {
                    list = list.filter(a => a.status === 'processing');
                } else if (filter === 'favorites') {
                    list = list.filter(a => a.isFavorite);
                } else if (filter === 'archived') {
                    list = list.filter(a => a.status === 'archived');
                } else if (filter === 'recent') {
                    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    list = list.filter(a => new Date(a.addedDate || 0) >= sevenDaysAgo);
                }
            } else if (state.currentFilter.type === 'collection') {
                const colName = state.currentFilter.value;
                list = list.filter(a => a.collection === colName);
            }

            // 2. Filter by active tag
            if (state.activeTag) {
                list = list.filter(a => Array.isArray(a.tags) && a.tags.includes(state.activeTag));
            }

            // 2.5 Filter by AI Semantic Filter (Librarian Agent)
            if (state.semanticFilter) {
                const sf = state.semanticFilter;
                
                // Status filtering
                if (sf.status) {
                    if (sf.status === 'favorites') {
                        list = list.filter(a => a.isFavorite);
                    } else if (sf.status === 'archived') {
                        // Interpreting "que li" / lidos: covers archived and reading
                        list = list.filter(a => a.status === 'archived' || a.status === 'reading');
                    } else {
                        list = list.filter(a => a.status === sf.status);
                    }
                }

                // Year filtering
                if (sf.year) {
                    list = list.filter(a => Number(a.year) === Number(sf.year));
                }

                // Collection filtering
                if (sf.collection) {
                    const colQ = sf.collection.toLowerCase();
                    list = list.filter(a => (a.collection || '').toLowerCase().includes(colQ));
                }

                // Tag filtering
                if (sf.tag) {
                    const tagQ = sf.tag.toLowerCase();
                    list = list.filter(a => Array.isArray(a.tags) && a.tags.some(t => t.toLowerCase() === tagQ));
                }

                // Text query filtering
                if (sf.textQuery) {
                    const q = sf.textQuery.toLowerCase();
                    list = list.filter(a => {
                        const titleMatch = (a.title || '').toLowerCase().includes(q);
                        const authorMatch = (a.authors || '').toLowerCase().includes(q);
                        const summaryMatch = (a.summary || '').toLowerCase().includes(q);
                        const notesMatch = (a.notes || '').toLowerCase().includes(q);
                        const fileMatch = (a.fileName || '').toLowerCase().includes(q);
                        const pubMatch = (a.publication || '').toLowerCase().includes(q);
                        const doiMatch = (a.doi || '').toLowerCase().includes(q);
                        const tagsMatch = (a.tags || []).some(t => t.toLowerCase().includes(q));
                        return titleMatch || authorMatch || summaryMatch || notesMatch || fileMatch || pubMatch || doiMatch || tagsMatch;
                    });
                }
            }

            // 3. Filter by search query (multi-field search)
            if (state.searchQuery) {
                const q = state.searchQuery.toLowerCase();
                list = list.filter(a => {
                    const titleMatch = (a.title || '').toLowerCase().includes(q);
                    const authorMatch = (a.authors || '').toLowerCase().includes(q);
                    const summaryMatch = (a.summary || '').toLowerCase().includes(q);
                    const notesMatch = (a.notes || '').toLowerCase().includes(q);
                    const fileMatch = (a.fileName || '').toLowerCase().includes(q);
                    const pubMatch = (a.publication || '').toLowerCase().includes(q);
                    const doiMatch = (a.doi || '').toLowerCase().includes(q);
                    const tagsMatch = (a.tags || []).some(t => t.toLowerCase().includes(q));
                    return titleMatch || authorMatch || summaryMatch || notesMatch || fileMatch || pubMatch || doiMatch || tagsMatch;
                });
            }

            // 4. Sort documents
            switch (state.sortBy) {
                case 'date-asc':
                    list.sort((a, b) => new Date(a.addedDate || 0) - new Date(b.addedDate || 0));
                    break;
                case 'title-asc':
                    list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                    break;
                case 'year-desc':
                    list.sort((a, b) => (b.year || 0) - (a.year || 0));
                    break;
                case 'date-desc':
                default:
                    list.sort((a, b) => new Date(b.addedDate || 0) - new Date(a.addedDate || 0));
                    break;
            }

            return list;
        },

        /**
         * Render the document cards or table view
         */
        render() {
            const state = window.Lexicon.State;
            const articles = this.getFilteredArticles();

            const container = document.getElementById('articles-container');
            const emptyState = document.getElementById('empty-state');
            const viewTitle = document.getElementById('current-view-title');
            const viewCount = document.getElementById('current-view-count');
            const activeFilterBanner = document.getElementById('active-filter-banner');

            if (!container) return;

            // Check if viewing "Collections & Folders" workflow view
            if (state.currentFilter.type === 'category' && state.currentFilter.value === 'collections') {
                if (activeFilterBanner) {
                    activeFilterBanner.classList.add('hidden');
                    activeFilterBanner.innerHTML = '';
                }
                this.renderFoldersView(container, emptyState, viewTitle, viewCount);
                this.updateBatchBar();
                if (window.Lexicon.Navigation) {
                    window.Lexicon.Navigation.updateButtons();
                    window.Lexicon.Navigation.updateActiveSidebarLink();
                }
                return;
            }

            // Check if viewing "Estatísticas & Insights" (Dashboard)
            if (state.currentFilter.type === 'category' && state.currentFilter.value === 'stats') {
                if (activeFilterBanner) {
                    activeFilterBanner.classList.add('hidden');
                    activeFilterBanner.innerHTML = '';
                }
                this.updateBatchBar();
                container.className = 'w-full block';
                if (window.Lexicon.Dashboard) {
                    window.Lexicon.Dashboard.render(container, emptyState, viewTitle, viewCount);
                }
                if (window.Lexicon.Navigation) {
                    window.Lexicon.Navigation.updateButtons();
                    window.Lexicon.Navigation.updateActiveSidebarLink();
                }
                return;
            }

            // Update View Title
            const i18n = window.Lexicon.I18n;
            if (state.semanticFilter) {
                const semTitle = i18n ? i18n.t('search.semanticTitle') : 'Busca Semântica';
                viewTitle.textContent = `${semTitle}: "${state.semanticFilter.originalQuery}"`;
            } else if (state.searchQuery) {
                const sTitle = i18n ? i18n.t('search.title') : 'Search';
                viewTitle.textContent = `${sTitle}: "${state.searchQuery}"`;
            } else if (state.activeTag) {
                const tagTitle = i18n ? i18n.t('search.tagTitle') : 'Tag';
                viewTitle.textContent = `${tagTitle}: #${state.activeTag}`;
            } else {
                if (state.currentFilter.type === 'category' && i18n) {
                    viewTitle.textContent = i18n.t(`nav.${state.currentFilter.value}`) || state.currentFilter.title;
                } else {
                    viewTitle.textContent = state.currentFilter.title || (i18n ? i18n.t('nav.all') : 'All Documents');
                }
            }

            const docWord = articles.length === 1 ? (i18n ? i18n.t('common.document') : 'document') : (i18n ? i18n.t('common.documents') : 'documents');
            viewCount.textContent = `${articles.length} ${docWord}`;

            // Active filter banner (Semantic AI or Tag)
            if (activeFilterBanner) {
                if (state.semanticFilter) {
                    const sf = state.semanticFilter;
                    activeFilterBanner.classList.remove('hidden');
                    activeFilterBanner.innerHTML = `
                        <div class="flex flex-wrap items-center gap-2 px-3.5 py-2 bg-jungle/10 border border-jungle/20 rounded-xl text-xs text-soil w-full">
                            <div class="flex items-center gap-1.5 font-semibold text-canopy shrink-0">
                                <i class="ph ph-robot text-base text-jungle"></i>
                                <span>Bibliotecário IA:</span>
                            </div>
                            <span class="text-earth/90 italic">"${window.Lexicon.Utils.escapeHTML(sf.originalQuery)}"</span>
                            ${sf.year ? `<span class="px-2 py-0.5 bg-paper border border-wood rounded text-[11px] font-mono text-soil font-medium">Ano: ${window.Lexicon.Utils.escapeHTML(sf.year)}</span>` : ''}
                            ${sf.status ? `<span class="px-2 py-0.5 bg-paper border border-wood rounded text-[11px] text-soil font-medium capitalize">Status: ${sf.status === 'archived' ? 'Lidos / Arquivados' : sf.status}</span>` : ''}
                            ${sf.tag ? `<span class="px-2 py-0.5 bg-paper border border-wood rounded text-[11px] text-soil font-medium">#${window.Lexicon.Utils.escapeHTML(sf.tag)}</span>` : ''}
                            ${sf.collection ? `<span class="px-2 py-0.5 bg-paper border border-wood rounded text-[11px] text-soil font-medium">Coleção: ${window.Lexicon.Utils.escapeHTML(sf.collection)}</span>` : ''}
                            ${sf.textQuery ? `<span class="px-2 py-0.5 bg-paper border border-wood rounded text-[11px] text-soil font-medium">Termo: "${window.Lexicon.Utils.escapeHTML(sf.textQuery)}"</span>` : ''}
                            <button type="button" data-action="clear-semantic-filter" class="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-terracotta hover:underline shrink-0 cursor-pointer">
                                <i class="ph ph-x-circle text-sm"></i> ${i18n ? i18n.t('search.clearSemantic') : 'Limpar Filtro IA'}
                            </button>
                        </div>
                    `;
                } else if (state.activeTag) {
                    activeFilterBanner.classList.remove('hidden');
                    activeFilterBanner.innerHTML = `
                        <div class="inline-flex items-center gap-2 px-3 py-1 bg-jungle/10 border border-jungle/20 text-canopy rounded-lg text-xs font-medium">
                            <span>${i18n ? i18n.t('search.filteringByTag') : 'Filtering by tag:'} <strong>#${window.Lexicon.Utils.escapeHTML(state.activeTag)}</strong></span>
                            <button type="button" data-action="clear-tag-filter" class="hover:text-terracotta p-0.5 cursor-pointer"><i class="ph-bold ph-x"></i></button>
                        </div>
                    `;
                } else {
                    activeFilterBanner.classList.add('hidden');
                    activeFilterBanner.innerHTML = '';
                }
            }

            if (articles.length === 0) {
                container.innerHTML = '';
                if (emptyState) {
                    emptyState.classList.remove('hidden');
                    emptyState.classList.add('flex');
                }
                if (window.Lexicon.Navigation) {
                    window.Lexicon.Navigation.updateButtons();
                    window.Lexicon.Navigation.updateActiveSidebarLink();
                }
                return;
            }

            if (emptyState) {
                emptyState.classList.add('hidden');
                emptyState.classList.remove('flex');
            }

            if (state.viewMode === 'table') {
                container.className = 'flex flex-col gap-2 pb-24';
                container.innerHTML = this.renderTable(articles);
            } else {
                container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24';
                container.innerHTML = articles.map(a => this.createCardHtml(a)).join('');
            }

            this.updateBatchBar();
            if (window.Lexicon.Navigation) {
                window.Lexicon.Navigation.updateButtons();
                window.Lexicon.Navigation.updateActiveSidebarLink();
            }
        },

        /**
         * Render the Dedicated Folders & Collections View
         */
        renderFoldersView(container, emptyState, viewTitle, viewCount) {
            const state = window.Lexicon.State;
            const i18n = window.Lexicon.I18n;

            // Initialize expandedFolders if needed
            if (!Array.isArray(state.expandedFolders)) {
                state.expandedFolders = state.collections.map(c => c.name);
                state.expandedFolders.push('Unfiled / General');
            }

            // Update title and stats
            viewTitle.textContent = i18n ? i18n.t('folders.title') : 'Collections & Folders';
            const docWord = state.articles.length === 1 ? (i18n ? i18n.t('common.document') : 'document') : (i18n ? i18n.t('common.documents') : 'documents');
            const colWord = state.collections.length === 1 ? (i18n && i18n.locale === 'pt-BR' ? 'coleção' : 'collection') : (i18n && i18n.locale === 'pt-BR' ? 'coleções' : 'collections');
            viewCount.textContent = `${state.collections.length} ${colWord} • ${state.articles.length} ${docWord}`;

            if (emptyState) {
                emptyState.classList.add('hidden');
                emptyState.classList.remove('flex');
            }

            // Map articles by collection
            const articlesByCol = {};
            state.collections.forEach(c => { articlesByCol[c.name] = []; });
            articlesByCol['Unfiled / General'] = [];

            const q = (state.searchQuery || '').toLowerCase();

            state.articles.forEach(a => {
                // Apply search filter if present
                if (q) {
                    const match = (a.title || '').toLowerCase().includes(q) ||
                                  (a.authors || '').toLowerCase().includes(q) ||
                                  (a.fileName || '').toLowerCase().includes(q) ||
                                  (a.tags || []).some(t => t.toLowerCase().includes(q));
                    if (!match) return;
                }

                if (a.collection && articlesByCol[a.collection]) {
                    articlesByCol[a.collection].push(a);
                } else {
                    articlesByCol['Unfiled / General'].push(a);
                }
            });

            const allFoldersList = [...state.collections];
            // Only show Unfiled folder if there are documents in it
            const unfiledArticles = articlesByCol['Unfiled / General'] || [];
            if (unfiledArticles.length > 0) {
                allFoldersList.push({
                    id: 'unfiled_general',
                    name: 'Unfiled / General',
                    isUnfiled: true
                });
            }

            if (allFoldersList.length === 0) {
                container.className = 'flex flex-col gap-4 pb-24';
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-20 text-center bg-paper rounded-2xl border border-wood">
                        <div class="w-16 h-16 rounded-full bg-clay border border-wood flex items-center justify-center text-earth mb-4">
                            <i class="ph ph-folder-notch-open text-3xl"></i>
                        </div>
                        <h3 class="text-base font-serif font-bold text-soil mb-1">${i18n ? i18n.t('folders.emptyNotice') : 'No collections created yet'}</h3>
                        <p class="text-xs text-earth max-w-sm mb-6">${i18n ? i18n.t('folders.noFiles') : 'Create your first collection or import folders to organize your research documents.'}</p>
                        <button type="button" data-action="create-collection-modal" class="px-4 py-2 bg-jungle text-white rounded-xl text-xs font-semibold hover:bg-canopy transition-colors flex items-center gap-2 cursor-pointer">
                            <i class="ph ph-folder-plus text-base"></i>
                            <span>${i18n ? i18n.t('collections.createBtn') : 'Create Collection'}</span>
                        </button>
                    </div>
                `;
                return;
            }

            const allExpanded = allFoldersList.length > 0 && allFoldersList.every(f => (state.expandedFolders || []).includes(f.name));

            container.className = 'flex flex-col gap-4 pb-24';

            // Top Toolbar for Folders View
            const toolbarHtml = `
                <div class="flex flex-wrap items-center justify-between gap-3 bg-paper border border-wood/70 rounded-2xl px-5 py-3 shadow-2xs mb-2">
                    <div class="flex items-center gap-2 text-xs text-earth">
                        <span class="w-2 h-2 rounded-full bg-leaf"></span>
                        <span class="font-bold text-soil">${allFoldersList.length}</span> ${colWord}
                        ${q ? `<span class="bg-jungle/10 text-canopy px-2 py-0.5 rounded text-[11px] font-medium ml-1">${i18n ? i18n.t('search.filteredBy') : 'Filtered by:'} "${window.Lexicon.Utils.escapeHTML(state.searchQuery)}"</span>` : ''}
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" data-action="toggle-all-folders" data-expand="${!allExpanded}" 
                                class="px-3.5 py-1.5 bg-sand hover:bg-wood/40 border border-wood rounded-xl text-xs font-semibold text-soil transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer">
                            <i class="ph ${allExpanded ? 'ph-caret-double-up' : 'ph-caret-double-down'} text-earth"></i>
                            <span>${allExpanded ? (i18n ? i18n.t('folders.reduceAll') : 'Reduce All Folders') : (i18n ? i18n.t('folders.expandAll') : 'Expand All Folders')}</span>
                        </button>
                        <button type="button" data-action="create-collection-modal" 
                                class="px-3.5 py-1.5 bg-jungle text-white hover:bg-canopy rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer">
                            <i class="ph ph-folder-plus text-sm"></i>
                            <span>${i18n ? i18n.t('collections.createBtn') : 'New Collection'}</span>
                        </button>
                    </div>
                </div>
            `;

            const foldersHtml = allFoldersList.map(folder => {
                const folderArticles = articlesByCol[folder.name] || [];
                const isExpanded = (state.expandedFolders || []).includes(folder.name);

                // Summary of formats inside this folder
                const formatCounts = {};
                folderArticles.forEach(a => {
                    const ext = (a.fileName || '').split('.').pop().toUpperCase() || 'DOC';
                    formatCounts[ext] = (formatCounts[ext] || 0) + 1;
                });
                const formatBreakdown = Object.keys(formatCounts).map(k => `${formatCounts[k]} ${k}`).join(' • ');
                const folderSafeName = window.Lexicon.Utils.escapeHTML(folder.name);
                const folderDocWord = folderArticles.length === 1 ? (i18n ? i18n.t('common.document') : 'document') : (i18n ? i18n.t('common.documents') : 'documents');

                return `
                    <div class="bg-paper border border-wood rounded-2xl overflow-hidden shadow-2xs transition-all ${isExpanded ? 'border-wood/80 ring-1 ring-jungle/15' : 'hover:border-leaf/50'}">
                        <!-- Folder Header Bar -->
                        <div class="px-5 py-3.5 bg-clay/35 hover:bg-clay/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                             data-action="toggle-folder-expand" data-folder-name="${folderSafeName}">
                            <div class="flex items-center gap-3 min-w-0">
                                <button type="button" class="w-7 h-7 rounded-lg bg-sand border border-wood/70 flex items-center justify-center text-soil shrink-0 hover:bg-wood/40 transition-transform cursor-pointer"
                                        data-action="toggle-folder-expand" data-folder-name="${folderSafeName}"
                                        title="${isExpanded ? (i18n ? i18n.t('folders.reduce') : 'Reduce folder') : (i18n ? i18n.t('folders.expand') : 'Expand folder')}">
                                    <i class="ph-bold ${isExpanded ? 'ph-caret-down' : 'ph-caret-right'} text-xs text-earth"></i>
                                </button>
                                
                                <div class="w-9 h-9 rounded-xl ${folder.isUnfiled ? 'bg-wood/50 text-earth' : 'bg-jungle/15 text-canopy border border-jungle/20'} flex items-center justify-center shrink-0 shadow-2xs">
                                    <i class="ph ${folder.isUnfiled ? 'ph-tray' : isExpanded ? 'ph-folder-open' : 'ph-folder'} text-lg"></i>
                                </div>

                                <div class="min-w-0">
                                    <div class="flex items-center gap-2">
                                        <h3 class="font-serif font-bold text-soil text-base tracking-tight truncate">${folderSafeName}</h3>
                                        <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-wood/50 text-soil shrink-0 font-mono">
                                            ${folderArticles.length} ${folderDocWord}
                                        </span>
                                    </div>
                                    <p class="text-[11px] text-earth/70 mt-0.5 truncate">
                                        ${formatBreakdown ? formatBreakdown : (i18n ? i18n.t('folders.noFiles') : 'No files recorded yet')}
                                    </p>
                                </div>
                            </div>

                            <div class="flex items-center gap-2 shrink-0 self-end sm:self-center" onclick="event.stopPropagation()">
                                ${!folder.isUnfiled ? `
                                    <button type="button" data-action="add-folder-doc" data-folder-name="${folderSafeName}" 
                                            class="px-2.5 py-1.5 bg-sand hover:bg-wood/40 border border-wood rounded-lg text-xs font-semibold text-soil transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer" 
                                            title="${i18n ? i18n.t('folders.addDocTitle') : 'Add document to this collection'}">
                                        <i class="ph-bold ph-plus text-jungle text-xs"></i>
                                        <span class="hidden md:inline">${i18n ? i18n.t('folders.addDoc') : 'Add Document'}</span>
                                    </button>

                                    <button type="button" data-action="select-folder" data-folder-name="${folderSafeName}" 
                                            class="px-2.5 py-1.5 bg-sand hover:bg-wood/40 border border-wood rounded-lg text-xs font-semibold text-earth hover:text-soil transition-colors flex items-center gap-1 shadow-2xs cursor-pointer" 
                                            title="${i18n ? i18n.t('folders.filterTitle') : 'Filter library by this collection'}">
                                        <i class="ph ph-funnel text-xs"></i>
                                        <span class="hidden md:inline">${i18n ? i18n.t('folders.filter') : 'Filter'}</span>
                                    </button>

                                    <button type="button" data-action="delete-folder" data-folder-id="${folder.id}" data-folder-name="${folderSafeName}" 
                                            class="p-1.5 text-earth/60 hover:text-terracotta hover:bg-wood/40 rounded-lg transition-colors cursor-pointer" 
                                            title="${i18n ? i18n.t('folders.deleteTitle') : 'Delete Collection'}">
                                        <i class="ph ph-trash text-sm"></i>
                                    </button>
                                ` : ''}

                                <button type="button" data-action="toggle-folder-expand" data-folder-name="${folderSafeName}" 
                                        class="px-2.5 py-1.5 bg-sand hover:bg-wood/40 border border-wood rounded-lg text-xs font-semibold text-soil transition-colors flex items-center gap-1 cursor-pointer">
                                    <span>${isExpanded ? (i18n ? i18n.t('folders.reduce') : 'Reduce') : (i18n ? i18n.t('folders.expand') : 'Expand')}</span>
                                    <i class="ph ${isExpanded ? 'ph-caret-up text-xs' : 'ph-caret-down text-xs'}"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Folder Content Area (when expanded) -->
                        ${isExpanded ? `
                            <div class="p-4 border-t border-wood/40 bg-sand/30">
                                ${folderArticles.length === 0 ? `
                                    <div class="text-center py-6 px-4 border border-dashed border-wood/70 rounded-xl bg-white/50">
                                        <p class="text-xs text-earth font-medium">${i18n ? i18n.t('folders.emptyNotice') : 'No documents in this folder.'}</p>
                                        ${!folder.isUnfiled ? `
                                            <button type="button" data-action="add-folder-doc" data-folder-name="${folderSafeName}" 
                                                    class="mt-2 text-xs text-jungle font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer">
                                                <i class="ph-bold ph-plus"></i> ${i18n ? i18n.t('folders.addDocsNow') : 'Add documents now'}
                                            </button>
                                        ` : ''}
                                    </div>
                                ` : `
                                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        ${folderArticles.map(a => this.createFolderDocTileHtml(a)).join('')}
                                    </div>
                                `}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');

            container.innerHTML = toolbarHtml + foldersHtml;
        },

        createFolderDocTileHtml(article) {
            const i18n = window.Lexicon.I18n;
            const formatIcon = article.coverType === 'book' ? 'ph-book-bookmark text-terracotta' :
                               article.coverType === 'doc' ? 'ph-file-doc text-jungle' :
                               'ph-file-pdf text-terracotta';
            const statusClass = this.getStatusBadgeClass(article.status);
            const statusLabel = this.getStatusLabel(article.status);
            const readText = i18n ? i18n.t('common.read') : 'READ';

            return `
                <div class="bg-paper border border-wood/80 hover:border-jungle rounded-xl p-3.5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                     data-action="inspect-article" data-article-id="${article.id}">
                    <div>
                        <div class="flex items-center justify-between mb-1.5">
                            <div class="flex items-center gap-1.5">
                                <i class="ph ${formatIcon} text-base"></i>
                                <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${statusClass}">
                                    ${statusLabel}
                                </span>
                            </div>
                            <button type="button" data-action="toggle-favorite" data-article-id="${article.id}" 
                                    class="p-1 text-wood hover:text-yellow-500 transition-colors cursor-pointer ${article.isFavorite ? 'text-yellow-500' : ''}">
                                <i class="${article.isFavorite ? 'ph-fill' : 'ph'} ph-star text-sm"></i>
                            </button>
                        </div>
                        <h4 class="font-serif font-bold text-xs text-soil group-hover:text-jungle transition-colors line-clamp-2 mb-1 leading-snug">
                            ${window.Lexicon.Utils.escapeHTML(article.title)}
                        </h4>
                        <p class="text-[11px] text-earth/80 truncate mb-2">
                            ${window.Lexicon.Utils.escapeHTML(String(article.authors)) || 'Unknown'} • ${window.Lexicon.Utils.escapeHTML(String(article.year)) || 'N/A'}
                        </p>
                    </div>

                    <div class="pt-2 border-t border-wood/40 flex items-center justify-between text-[10px] text-earth/70 mt-2">
                        <span class="font-mono truncate max-w-[120px]">${article.fileSize || 'Local'}</span>
                        <button type="button" data-action="read-article" data-article-id="${article.id}" 
                                class="px-2 py-0.5 rounded bg-jungle/10 hover:bg-jungle text-canopy hover:text-white font-bold transition-colors flex items-center gap-1 cursor-pointer">
                            <i class="ph ph-book-open"></i> ${readText}
                        </button>
                    </div>
                </div>
            `;
        },

        toggleFolderExpand(folderName) {
            const state = window.Lexicon.State;
            state.expandedFolders = state.expandedFolders || [];
            const idx = state.expandedFolders.indexOf(folderName);
            if (idx >= 0) {
                state.expandedFolders.splice(idx, 1);
            } else {
                state.expandedFolders.push(folderName);
            }
            this.render();
        },

        toggleAllFolders(expand) {
            const state = window.Lexicon.State;
            if (expand) {
                state.expandedFolders = state.collections.map(c => c.name);
                state.expandedFolders.push('Unfiled / General');
            } else {
                state.expandedFolders = [];
            }
            this.render();
        },

        openAddModalForCollection(colName) {
            window.Lexicon.UI.Modal.open('upload-modal');
            const formCol = document.getElementById('form-collection');
            const importDefCol = document.getElementById('import-opt-default-collection');
            if (formCol) formCol.value = colName;
            if (importDefCol) importDefCol.value = colName;
        },

        /**
         * Render High-Density Table View
         */
        renderTable(articles) {
            const state = window.Lexicon.State;
            const i18n = window.Lexicon.I18n;
            const allSelected = articles.length > 0 && articles.every(a => (state.selectedIds || []).includes(a.id));

            const colTitle = i18n ? i18n.t('table.colTitle') : 'Title & Details';
            const colCollection = i18n ? i18n.t('table.colCollection') : 'Collection';
            const colFile = 'File Name / Path';
            const colTags = i18n ? i18n.t('table.colTags') : 'Tags';
            const colAction = i18n ? i18n.t('table.colActions') : 'Action';

            return `
                <div class="bg-paper border border-wood rounded-xl overflow-hidden shadow-sm">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-sm text-soil border-collapse">
                            <thead>
                                <tr class="border-b border-wood bg-clay/50 text-xs font-semibold text-earth uppercase tracking-wider">
                                    <th class="py-3 px-3 w-10 text-center">
                                        <input type="checkbox" id="table-select-all" 
                                               class="w-4 h-4 rounded text-jungle focus:ring-jungle border-wood cursor-pointer"
                                               ${allSelected ? 'checked' : ''} 
                                               onclick="Lexicon.Articles.toggleSelectAll(this.checked)">
                                    </th>
                                    <th class="py-3 px-3 w-28">Status</th>
                                    <th class="py-3 px-4">${colTitle}</th>
                                    <th class="py-3 px-4 w-40">${colCollection}</th>
                                    <th class="py-3 px-4 w-44">${colFile}</th>
                                    <th class="py-3 px-4 w-40">${colTags}</th>
                                    <th class="py-3 px-4 text-right w-28">${colAction}</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-wood/50">
                                ${articles.map(a => this.createTableRowHtml(a)).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        },

        createCardHtml(article) {
            const state = window.Lexicon.State;
            const i18n = window.Lexicon.I18n;
            const isSelected = (state.selectedIds || []).includes(article.id);
            const formatIcon = article.coverType === 'book' ? 'ph-book-bookmark text-terracotta' :
                               article.coverType === 'doc' ? 'ph-file-doc text-jungle' :
                               'ph-file-pdf text-terracotta';

            const statusClass = this.getStatusBadgeClass(article.status);
            const statusLabel = this.getStatusLabel(article.status);

            const tagsHtml = (article.tags || []).slice(0, 3).map(tag => 
                `<span data-action="filter-tag" data-tag-name="${window.Lexicon.Utils.escapeHTML(tag)}" 
                       class="tag-chip cursor-pointer" title="Filter by #${window.Lexicon.Utils.escapeHTML(tag)}">
                    #${window.Lexicon.Utils.escapeHTML(tag)}
                 </span>`
            ).join('');

            const favTitle = article.isFavorite ? 
                (i18n ? i18n.t('inspector.starRemoved') : 'Remove from favorites') : 
                (i18n ? i18n.t('inspector.starAdded') : 'Add to favorites');

            const unfiledLabel = i18n ? i18n.t('folders.unfiled') : 'Uncategorized';

            return `
                <div class="glass-card rounded-xl p-5 flex flex-col h-80 group relative overflow-hidden cursor-pointer ${isSelected ? 'card-selected' : ''}" 
                     data-action="inspect-article" data-article-id="${article.id}">
                    
                    <!-- Card Header -->
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex items-center gap-2">
                            <input type="checkbox" 
                                   class="card-checkbox w-4 h-4 rounded text-jungle focus:ring-jungle border-wood cursor-pointer" 
                                   ${isSelected ? 'checked' : ''} 
                                   data-action="toggle-select" data-article-id="${article.id}">
                            <div class="w-8 h-8 rounded-lg bg-sand border border-wood flex items-center justify-center shrink-0">
                                <i class="ph ${formatIcon} text-base"></i>
                            </div>
                            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${statusClass}">
                                ${statusLabel}
                            </span>
                        </div>
                        
                        <!-- Card Star Action -->
                        <div class="flex items-center gap-1">
                            <button type="button" data-action="toggle-favorite" data-article-id="${article.id}" 
                                    class="p-1.5 rounded-md hover:bg-wood/50 transition-colors cursor-pointer ${article.isFavorite ? 'text-yellow-500' : 'text-wood hover:text-yellow-500'}" 
                                    title="${favTitle}">
                                <i class="${article.isFavorite ? 'ph-fill' : 'ph'} ph-star text-lg"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Card Body -->
                    <div class="flex-1 min-h-0">
                        <h3 class="font-serif font-bold text-soil leading-snug mb-1 line-clamp-2 text-base group-hover:text-jungle transition-colors">
                            ${window.Lexicon.Utils.escapeHTML(article.title)}
                        </h3>
                        <p class="text-xs text-earth mb-2 font-medium truncate">
                            ${window.Lexicon.Utils.escapeHTML(String(article.authors)) || 'Unknown'} • ${window.Lexicon.Utils.escapeHTML(String(article.year)) || 'N/A'}
                        </p>
                        <p class="text-xs text-earth/80 line-clamp-3 leading-relaxed mb-3 font-normal">
                            ${window.Lexicon.Utils.escapeHTML(String(article.summary)) || 'Click to view overview, metadata, summary, and open document.'}
                        </p>
                    </div>

                    <!-- Card Footer: File Info & Tags -->
                    <div class="pt-2 border-t border-wood/40 flex flex-col gap-2 mt-auto">
                        <div class="flex items-center justify-between text-[11px] text-earth/70">
                            <span class="truncate flex items-center gap-1">
                                <i class="ph ph-folder text-xs"></i>
                                <span>${window.Lexicon.Utils.escapeHTML(String(article.collection)) || unfiledLabel}</span>
                            </span>
                            <span class="font-mono text-[10px] shrink-0 text-earth/60">
                                ${article.fileSize || 'Local'}
                            </span>
                        </div>
                        <div class="flex flex-wrap gap-1 items-center overflow-hidden h-6">
                            ${tagsHtml}
                        </div>
                    </div>

                    <!-- Bottom Accent Bar -->
                    <div class="absolute bottom-0 left-0 w-full h-1 bg-jungle transform translate-y-1 group-hover:translate-y-0 transition-transform"></div>
                </div>
            `;
        },

        createTableRowHtml(article) {
            const state = window.Lexicon.State;
            const i18n = window.Lexicon.I18n;
            const isSelected = (state.selectedIds || []).includes(article.id);
            const formatIcon = article.coverType === 'book' ? 'ph-book-bookmark text-terracotta' :
                               article.coverType === 'doc' ? 'ph-file-doc text-jungle' :
                               'ph-file-pdf text-terracotta';

            const statusClass = this.getStatusBadgeClass(article.status);
            const statusLabel = this.getStatusLabel(article.status);

            const tagsHtml = (article.tags || []).slice(0, 2).map(tag => 
                `<span data-action="filter-tag" data-tag-name="${window.Lexicon.Utils.escapeHTML(tag)}" 
                       class="tag-chip cursor-pointer text-[10px]">
                    #${window.Lexicon.Utils.escapeHTML(tag)}
                 </span>`
            ).join('');

            const readText = i18n ? i18n.t('common.read') : 'Read';

            return `
                <tr class="hover:bg-sand/60 transition-colors cursor-pointer group ${isSelected ? 'bg-jungle/10 font-medium' : ''}" 
                    data-action="inspect-article" data-article-id="${article.id}">
                    <td class="py-3 px-3 text-center">
                        <input type="checkbox" 
                               class="w-4 h-4 rounded text-jungle focus:ring-jungle border-wood cursor-pointer"
                               ${isSelected ? 'checked' : ''} 
                               data-action="toggle-select" data-article-id="${article.id}">
                    </td>
                    <td class="py-3 px-3">
                        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${statusClass}">
                            ${statusLabel}
                        </span>
                    </td>
                    <td class="py-3 px-4 min-w-0">
                        <div class="flex items-center gap-3">
                            <i class="ph ${formatIcon} text-lg shrink-0"></i>
                            <div class="truncate">
                                <div class="font-serif font-semibold text-soil truncate group-hover:text-jungle transition-colors">
                                    ${window.Lexicon.Utils.escapeHTML(article.title)}
                                </div>
                                <div class="text-xs text-earth/70 truncate">
                                    ${window.Lexicon.Utils.escapeHTML(String(article.authors)) || 'Unknown'} (${window.Lexicon.Utils.escapeHTML(String(article.year)) || 'N/A'})
                                </div>
                            </div>
                        </div>
                    </td>
                    <td class="py-3 px-4 text-xs text-earth">
                        ${window.Lexicon.Utils.escapeHTML(String(article.collection)) || '—'}
                    </td>
                    <td class="py-3 px-4 text-xs font-mono text-earth/80 truncate max-w-[180px]" title="${article.filePath || article.fileName || 'Local file'}">
                        ${window.Lexicon.Utils.escapeHTML(String(article.fileName)) || 'document.pdf'}
                    </td>
                    <td class="py-3 px-4">
                        <div class="flex flex-wrap gap-1">
                            ${tagsHtml}
                        </div>
                    </td>
                    <td class="py-3 px-4 text-right">
                        <div class="flex items-center justify-end gap-1">
                            <button type="button" data-action="toggle-favorite" data-article-id="${article.id}" 
                                    class="p-1 rounded hover:bg-wood/50 transition-colors cursor-pointer ${article.isFavorite ? 'text-yellow-500' : 'text-wood hover:text-yellow-500'}" 
                                    title="Favorite">
                                <i class="${article.isFavorite ? 'ph-fill' : 'ph'} ph-star text-base"></i>
                            </button>
                            <button type="button" data-action="read-article" data-article-id="${article.id}" 
                                    class="px-2 py-1 bg-jungle/10 hover:bg-jungle text-jungle hover:text-white rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                    title="Open to Read">
                                <i class="ph ph-book-open"></i> ${readText}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        },

        getStatusBadgeClass(status) {
            switch (status) {
                case 'inbox': return 'badge-status-inbox';
                case 'reading': return 'badge-status-reading';
                case 'processing': return 'badge-status-processing';
                case 'archived': return 'badge-status-archived';
                default: return 'badge-status-inbox';
            }
        },

        getStatusLabel(status) {
            const i18n = window.Lexicon.I18n;
            switch (status) {
                case 'inbox': return i18n ? i18n.t('nav.inbox') : 'Inbox';
                case 'reading': return i18n ? i18n.t('nav.reading') : 'Reading';
                case 'processing': return i18n ? i18n.t('nav.processing') : 'Fichamento';
                case 'archived': return i18n ? i18n.t('nav.archived') : 'Archived';
                default: return i18n ? i18n.t('nav.inbox') : 'Inbox';
            }
        },

        filterByTag(tag) {
            if (window.Lexicon.Navigation) {
                window.Lexicon.Navigation.recordNavigation();
            }
            const state = window.Lexicon.State;
            state.activeTag = tag;
            state.searchQuery = '';
            state.semanticFilter = null;
            state.selectedIds = [];
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.value = '';
            this.render();
        },

        clearTagFilter() {
            if (window.Lexicon.Navigation) {
                window.Lexicon.Navigation.recordNavigation();
            }
            const state = window.Lexicon.State;
            state.activeTag = null;
            this.render();
        },

        filterByCollection(name) {
            if (window.Lexicon.Collections) {
                window.Lexicon.Collections.select(name);
            }
        },

        setCategoryFilter(filterValue) {
            if (window.Lexicon.Navigation) {
                window.Lexicon.Navigation.recordNavigation();
            }
            const state = window.Lexicon.State;
            const localizedTitle = window.Lexicon.I18n ? window.Lexicon.I18n.t(`nav.${filterValue}`) : null;
            const titles = {
                'all': 'All Documents',
                'collections': 'Collections & Folders',
                'inbox': 'Inbox (Unsorted)',
                'reading': 'Reading List',
                'processing': 'Notes',
                'favorites': 'Favorite Documents',
                'archived': 'Archived References',
                'recent': 'Recently Added',
                'stats': 'Estatísticas & Insights'
            };
            state.currentFilter = {
                type: 'category',
                value: filterValue,
                title: localizedTitle || titles[filterValue] || 'Documents'
            };
            state.activeTag = null;
            state.searchQuery = '';
            state.semanticFilter = null;
            state.selectedIds = [];
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.value = '';
            if (window.Lexicon.Collections) window.Lexicon.Collections.render();
            this.render();
            if (window.Lexicon.Navigation) window.Lexicon.Navigation.updateActiveSidebarLink();
        },

        /* ------------------------------------------------------------------
           Multiple Selection & Batch Operations
           ------------------------------------------------------------------ */
        toggleSelect(id) {
            const state = window.Lexicon.State;
            state.selectedIds = state.selectedIds || [];
            const idx = state.selectedIds.indexOf(id);
            if (idx >= 0) {
                state.selectedIds.splice(idx, 1);
            } else {
                state.selectedIds.push(id);
            }
            this.render();
        },

        toggleSelectAll(checked) {
            const state = window.Lexicon.State;
            if (checked) {
                const currentList = this.getFilteredArticles();
                state.selectedIds = currentList.map(a => a.id);
            } else {
                state.selectedIds = [];
            }
            this.render();
        },

        clearSelection() {
            const state = window.Lexicon.State;
            state.selectedIds = [];
            this.render();
        },

        updateBatchBar() {
            const state = window.Lexicon.State;
            const bar = document.getElementById('batch-action-bar');
            const countEl = document.getElementById('batch-selected-count');
            const colSelect = document.getElementById('batch-collection-select');
            if (!bar) return;

            const n = (state.selectedIds || []).length;
            if (n > 0) {
                bar.classList.remove('hidden-bar');
                if (countEl) {
                    const label = window.Lexicon.I18n ? window.Lexicon.I18n.t('batch.selected') : 'selected';
                    countEl.textContent = `${n} ${label}`;
                }

                if (colSelect) {
                    colSelect.innerHTML = '<option value="">Move to Collection...</option>' +
                        '<option value="__NEW__">+ Create New Collection...</option>' +
                        '<option value="none">(None / General)</option>' +
                        state.collections.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
                }
            } else {
                bar.classList.add('hidden-bar');
            }
        },

        batchChangeStatus(status) {
            if (!status) return;
            const state = window.Lexicon.State;
            const count = state.selectedIds.length;
            state.articles.forEach(a => {
                if (state.selectedIds.includes(a.id)) {
                    a.status = status;
                }
            });
            window.Lexicon.Storage.save();
            window.Lexicon.Collections.render();
            this.render();
            const toastMsg = status === 'archived' && window.Lexicon.I18n
                ? window.Lexicon.I18n.t('batch.batchMarkedRead', { count })
                : `Updated status for ${count} documents`;
            window.Lexicon.UI.Toast.show(toastMsg, 'success');
        },

        batchSetCollection(colName) {
            if (!colName) return;
            if (colName === '__NEW__') {
                this.batchCreateCollectionPrompt();
                return;
            }

            const state = window.Lexicon.State;
            const count = state.selectedIds.length;
            const targetCol = colName === 'none' ? null : colName;
            state.articles.forEach(a => {
                if (state.selectedIds.includes(a.id)) {
                    a.collection = targetCol;
                }
            });
            window.Lexicon.Storage.save();
            window.Lexicon.Collections.render();
            this.render();
            const colDisplay = targetCol || (window.Lexicon.I18n ? window.Lexicon.I18n.t('folders.unfiled') : 'General');
            const toastMsg = window.Lexicon.I18n
                ? window.Lexicon.I18n.t('batch.batchMoved', { count, name: colDisplay })
                : `Moved ${count} documents to ${colDisplay}`;
            window.Lexicon.UI.Toast.show(toastMsg, 'success');
        },

        batchCreateCollectionPrompt() {
            const state = window.Lexicon.State;
            const n = (state.selectedIds || []).length;
            if (n === 0) {
                window.Lexicon.UI.Toast.show('Please select at least one document first', 'warning');
                return;
            }

            const subtitle = document.getElementById('batch-collection-modal-subtitle');
            if (subtitle) {
                subtitle.textContent = window.Lexicon.I18n ? window.Lexicon.I18n.t('batch.modalSubtitle') : `Create a new collection and move ${n} selected documents into it.`;
            }

            const input = document.getElementById('batch-new-collection-name');
            if (input) input.value = '';

            window.Lexicon.UI.Modal.open('batch-collection-modal');
            setTimeout(() => {
                if (input) input.focus();
            }, 100);
        },

        submitBatchCreateCollection() {
            const input = document.getElementById('batch-new-collection-name');
            if (!input) return;

            const name = input.value.trim();
            if (!name) {
                window.Lexicon.UI.Toast.show(window.Lexicon.I18n ? window.Lexicon.I18n.t('collections.nameRequired') : 'Please enter a collection name', 'error');
                return;
            }

            const state = window.Lexicon.State;
            const count = (state.selectedIds || []).length;
            if (count === 0) {
                window.Lexicon.UI.Modal.close('batch-collection-modal');
                return;
            }

            // Get or create collection
            window.Lexicon.Collections.getOrCreate(name);

            // Assign selected documents to this collection
            state.articles.forEach(a => {
                if (state.selectedIds.includes(a.id)) {
                    a.collection = name;
                }
            });

            window.Lexicon.Storage.save();
            window.Lexicon.Collections.render();
            this.render();

            window.Lexicon.UI.Modal.close('batch-collection-modal');
            const toastMsg = window.Lexicon.I18n
                ? window.Lexicon.I18n.t('batch.batchMoved', { count, name })
                : `Created collection "${name}" and moved ${count} documents into it`;
            window.Lexicon.UI.Toast.show(toastMsg, 'success');
        },

        batchAddTag() {
            const state = window.Lexicon.State;
            if (!state.selectedIds || !state.selectedIds.length) return;

            const tagPrompt = window.Lexicon.I18n ? window.Lexicon.I18n.t('inspector.tagPlaceholder') : "Enter tag to add to selected documents:";
            const tag = window.prompt(tagPrompt);
            if (!tag || !tag.trim()) return;
            const cleanTag = tag.trim().replace(/^#/, '');

            let updated = 0;
            state.articles.forEach(a => {
                if (state.selectedIds.includes(a.id)) {
                    a.tags = a.tags || [];
                    if (!a.tags.includes(cleanTag)) {
                        a.tags.push(cleanTag);
                        updated++;
                    }
                }
            });
            window.Lexicon.Storage.save();
            this.render();
            const toastMsg = window.Lexicon.I18n
                ? window.Lexicon.I18n.t('batch.batchTagAdded', { tag: cleanTag, count: state.selectedIds.length })
                : `Added tag #${cleanTag} to ${state.selectedIds.length} documents`;
            window.Lexicon.UI.Toast.show(toastMsg, 'success');
        },

        batchToggleFavorite(fav) {
            const state = window.Lexicon.State;
            state.articles.forEach(a => {
                if (state.selectedIds.includes(a.id)) {
                    a.isFavorite = fav;
                }
            });
            window.Lexicon.Storage.save();
            this.render();
            const toastMsg = window.Lexicon.I18n
                ? window.Lexicon.I18n.t('batch.batchFavoritesUpdated', { count: state.selectedIds.length })
                : `Updated favorites for ${state.selectedIds.length} documents`;
            window.Lexicon.UI.Toast.show(toastMsg, 'success');
        },

        async batchDelete() {
            const state = window.Lexicon.State;
            const count = state.selectedIds.length;
            if (!count) return;

            const confirmMsg = window.Lexicon.I18n
                ? window.Lexicon.I18n.t('batch.confirmBatchDelete', { count })
                : `Are you sure you want to delete ${count} selected documents from your library?`;
            if (!confirm(confirmMsg)) {
                return;
            }

            for (const id of state.selectedIds) {
                await window.Lexicon.Storage.deleteFile(id);
            }

            state.articles = state.articles.filter(a => !state.selectedIds.includes(a.id));
            state.selectedIds = [];
            window.Lexicon.Storage.save();
            window.Lexicon.Collections.render();
            this.render();
            const toastMsg = window.Lexicon.I18n
                ? window.Lexicon.I18n.t('batch.batchDeleted', { count })
                : `Deleted ${count} documents`;
            window.Lexicon.UI.Toast.show(toastMsg, 'info');
        },

        batchExportNotes() {
            const state = window.Lexicon.State;
            const selectedArticles = state.articles.filter(a => state.selectedIds.includes(a.id));
            if (!selectedArticles.length) return;

            let md = `# Consolidated Research Synthesis & Notes\nExported: ${new Date().toLocaleDateString()}\nTotal Documents: ${selectedArticles.length}\n\n---\n\n`;

            selectedArticles.forEach(a => {
                md += `## ${a.title}\n`;
                md += `**Authors:** ${a.authors || 'Unknown'} (${a.year || 'N/A'}) | **Status:** ${a.status} | **Collection:** ${a.collection || 'General'}\n\n`;
                if (a.summary) {
                    md += `### Summary\n${a.summary}\n\n`;
                }
                if (a.notes) {
                    const notesHeading = window.Lexicon.I18n ? window.Lexicon.I18n.t('inspector.notesTitle') : 'Fichamento';
                    md += `### ${notesHeading}\n${a.notes}\n\n`;
                }
                md += `---\n\n`;
            });

            const blob = new Blob([md], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Batch_Research_Notes_${new Date().toISOString().split('T')[0]}.md`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            window.Lexicon.UI.Toast.show(`Exported notes for ${selectedArticles.length} documents`, 'success');
        },

        toggleFavorite(id) {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === id);
            if (!article) return;

            article.isFavorite = !article.isFavorite;
            window.Lexicon.Storage.save();
            this.render();

            // Also update inspector modal star if currently open
            if (state.inspectedArticleId === id) {
                this.updateInspectorStar(article.isFavorite);
            }

            const msg = article.isFavorite ? 'Added to favorites' : 'Removed from favorites';
            window.Lexicon.UI.Toast.show(msg, 'info');
        },

        updateInspectorStar(isFavorite) {
            const starBtn = document.getElementById('inspector-star-btn');
            if (starBtn) {
                starBtn.className = `p-2 rounded-xl transition-colors cursor-pointer ${isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-earth hover:text-soil'}`;
                starBtn.innerHTML = `<i class="${isFavorite ? 'ph-fill' : 'ph'} ph-star text-xl"></i>`;
            }
        },

        /**
         * Open Document Overview & Inspector Modal
         * Shows Summary, Metadata, File Location, and Prominent READ button
         * @param {number|string} id
         */
        inspect(id) {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === Number(id));
            if (!article) return;

            state.inspectedArticleId = article.id;

            // Populate Inspector Fields
            const titleEl = document.getElementById('inspector-title');
            const authorEl = document.getElementById('inspector-author');
            const yearEl = document.getElementById('inspector-year');
            const pubEl = document.getElementById('inspector-publication');
            const doiEl = document.getElementById('inspector-doi');
            const doiLinkEl = document.getElementById('inspector-doi-link');
            const statusEl = document.getElementById('inspector-status');
            const collectionEl = document.getElementById('inspector-collection');
            const summaryEl = document.getElementById('inspector-summary');
            const notesEl = document.getElementById('inspector-notes');
            const fileNameEl = document.getElementById('inspector-file-name');
            const filePathEl = document.getElementById('inspector-file-path');
            const fileSizeEl = document.getElementById('inspector-file-size');
            const fileIconEl = document.getElementById('inspector-file-icon');

            if (titleEl) titleEl.value = article.title || '';
            if (authorEl) authorEl.value = article.authors || '';
            if (yearEl) yearEl.value = article.year || '';
            if (pubEl) pubEl.value = article.publication || '';
            if (doiEl) doiEl.value = article.doi || '';
            
            if (doiLinkEl) {
                if (article.doi) {
                    let doiUrl = article.doi;
                    if (/arxiv/i.test(article.doi) || /^\d{4}\.\d{4,5}/.test(article.doi)) {
                        const cleanArxiv = article.doi.replace(/^arxiv:\s*/i, '').replace(/^10\.48550\/arxiv\./i, '');
                        doiUrl = `https://arxiv.org/abs/${cleanArxiv}`;
                    } else if (!doiUrl.startsWith('http')) {
                        doiUrl = `https://doi.org/${article.doi}`;
                    }
                    doiLinkEl.href = doiUrl;
                    doiLinkEl.classList.remove('hidden');
                } else {
                    doiLinkEl.classList.add('hidden');
                }
            }

            if (window.Lexicon.Academic && typeof window.Lexicon.Academic.closeCiteMenu === 'function') {
                window.Lexicon.Academic.closeCiteMenu();
            }

            if (statusEl) statusEl.value = article.status || 'inbox';
            
            // Populate collections dropdown
            if (collectionEl) {
                collectionEl.innerHTML = `
                    <option value="">(None / Uncategorized)</option>
                    ${state.collections.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                `;
                collectionEl.value = article.collection || '';
            }

            if (summaryEl) summaryEl.value = article.summary || '';
            if (notesEl) notesEl.value = article.notes || '';

            // File information
            if (fileNameEl) fileNameEl.textContent = article.fileName || 'Document File';
            if (filePathEl) filePathEl.textContent = article.filePath || article.fileName || 'Stored locally';
            if (fileSizeEl) fileSizeEl.textContent = article.fileSize || 'Standard file';

            if (fileIconEl) {
                const iconClass = article.coverType === 'book' ? 'ph-book-bookmark text-terracotta' :
                                 article.coverType === 'doc' ? 'ph-file-doc text-jungle' :
                                 'ph-file-pdf text-terracotta';
                fileIconEl.className = `ph ${iconClass} text-2xl`;
            }

            this.updateInspectorStar(article.isFavorite);
            this.renderInspectorTags(article.tags || []);

            // Attach Zettelkasten autocomplete & Backlinks (Item 3.3)
            if (window.Lexicon.Zettelkasten) {
                if (notesEl) window.Lexicon.Zettelkasten.attach(notesEl);
                const backlinksContainer = document.getElementById('inspector-backlinks-container');
                if (backlinksContainer) {
                    window.Lexicon.Zettelkasten.renderBacklinks(article, backlinksContainer);
                }
            }

            // Open the Modal
            window.Lexicon.UI.Modal.open('inspector-modal');
        },

        /**
         * Render tag badges in the inspector modal
         */
        renderInspectorTags(tags) {
            const listEl = document.getElementById('inspector-tags-list');
            if (!listEl) return;

            listEl.innerHTML = tags.map(tag => `
                <span class="tag-chip inline-flex items-center gap-1.5 py-1 px-2.5 bg-clay/70 border border-wood rounded-lg text-xs font-medium">
                    #${window.Lexicon.Utils.escapeHTML(tag)}
                    <button type="button" data-action="remove-inspected-tag" data-tag-name="${window.Lexicon.Utils.escapeHTML(tag)}" 
                            class="hover:text-terracotta transition-colors text-earth cursor-pointer" title="Remove tag">
                        <i class="ph ph-x text-xs"></i>
                    </button>
                </span>
            `).join('');
        },

        addTagToInspected() {
            const input = document.getElementById('inspector-new-tag');
            if (!input || !input.value.trim()) return;

            const tag = input.value.trim().replace(/^#/, '');
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article) return;

            article.tags = article.tags || [];
            if (!article.tags.includes(tag)) {
                article.tags.push(tag);
                this.renderInspectorTags(article.tags);
                window.Lexicon.Storage.save();
                this.render();
            }

            input.value = '';
        },

        removeTagFromInspected(tag) {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article || !article.tags) return;

            article.tags = article.tags.filter(t => t !== tag);
            this.renderInspectorTags(article.tags);
            window.Lexicon.Storage.save();
            this.render();
        },

        /**
         * Save edits made inside the Inspector modal
         */
        saveInspected() {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article) return;

            const titleEl = document.getElementById('inspector-title');
            const authorEl = document.getElementById('inspector-author');
            const yearEl = document.getElementById('inspector-year');
            const pubEl = document.getElementById('inspector-publication');
            const doiEl = document.getElementById('inspector-doi');
            const statusEl = document.getElementById('inspector-status');
            const collectionEl = document.getElementById('inspector-collection');
            const summaryEl = document.getElementById('inspector-summary');
            const notesEl = document.getElementById('inspector-notes');

            if (titleEl && titleEl.value.trim()) article.title = titleEl.value.trim();
            if (authorEl) article.authors = authorEl.value.trim();
            if (yearEl) article.year = parseInt(yearEl.value) || new Date().getFullYear();
            if (pubEl) article.publication = pubEl.value.trim();
            if (doiEl) {
                article.doi = doiEl.value.trim();
                const doiLinkEl = document.getElementById('inspector-doi-link');
                if (doiLinkEl) {
                    if (article.doi) {
                        let doiUrl = article.doi;
                        if (/arxiv/i.test(article.doi) || /^\d{4}\.\d{4,5}/.test(article.doi)) {
                            const cleanArxiv = article.doi.replace(/^arxiv:\s*/i, '').replace(/^10\.48550\/arxiv\./i, '');
                            doiUrl = `https://arxiv.org/abs/${cleanArxiv}`;
                        } else if (!doiUrl.startsWith('http')) {
                            doiUrl = `https://doi.org/${article.doi}`;
                        }
                        doiLinkEl.href = doiUrl;
                        doiLinkEl.classList.remove('hidden');
                    } else {
                        doiLinkEl.classList.add('hidden');
                    }
                }
            }
            if (statusEl) article.status = statusEl.value;
            if (collectionEl) article.collection = collectionEl.value || null;
            if (summaryEl) article.summary = summaryEl.value.trim();
            if (notesEl) article.notes = notesEl.value;

            window.Lexicon.Storage.save();
            window.Lexicon.Collections.render();
            this.render();

            window.Lexicon.UI.Toast.show('Document details saved', 'success');
        },

        /**
         * Auto-save research notes on input with debounce
         */
        autoSaveNotes() {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            const notesEl = document.getElementById('inspector-notes');
            const indicatorEl = document.getElementById('notes-save-indicator');
            if (!article || !notesEl) return;

            article.notes = notesEl.value;

            if (indicatorEl) indicatorEl.textContent = 'Saving...';

            clearTimeout(this._noteDebounce);
            this._noteDebounce = setTimeout(() => {
                window.Lexicon.Storage.save();
                if (indicatorEl) indicatorEl.textContent = 'Auto-saved';
            }, 500);
        },

        /**
         * Insert Markdown formatting into the inspector notes textarea
         * @param {string} format
         */
        insertNotesFormatting(format) {
            const textarea = document.getElementById('inspector-notes');
            if (!textarea) return;

            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const selection = text.substring(start, end);

            let replacement = '';
            let cursorOffset = 0;

            switch (format) {
                case 'bold':
                    replacement = `**${selection || 'bold text'}**`;
                    cursorOffset = selection ? replacement.length : 2;
                    break;
                case 'italic':
                    replacement = `*${selection || 'italic text'}*`;
                    cursorOffset = selection ? replacement.length : 1;
                    break;
                case 'h2':
                    replacement = `\n## ${selection || 'Section Heading'}\n`;
                    cursorOffset = replacement.length;
                    break;
                case 'quote':
                    replacement = `\n> "${selection || 'Key quotation or citation'}"\n`;
                    cursorOffset = replacement.length;
                    break;
                case 'bullet':
                    replacement = `\n- ${selection || 'Point / takeaway'}\n`;
                    cursorOffset = replacement.length;
                    break;
                case 'date':
                    const today = new Date().toISOString().split('T')[0];
                    replacement = `[${today}] `;
                    cursorOffset = replacement.length;
                    break;
            }

            textarea.value = text.substring(0, start) + replacement + text.substring(end);
            textarea.focus();
            textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
            this.autoSaveNotes();
        },

        /**
         * Insert quick citation block into notes (> "text" (p. X - DD/MM/YYYY))
         */
        insertQuickCitation() {
            if (window.Lexicon.Reader && window.Lexicon.Reader.isOpen()) {
                window.Lexicon.Reader.insertQuickCitation();
            } else {
                const notesEl = document.getElementById('inspector-notes');
                if (!notesEl) return;
                const start = notesEl.selectionStart;
                const end = notesEl.selectionEnd;
                const text = notesEl.value;
                const selected = text.substring(start, end).trim();

                const pageNum = prompt('Digite o número da página citada (ou deixe em branco):', '1');
                if (pageNum === null) return;

                const now = new Date();
                const dateStr = now.toLocaleDateString('pt-BR');
                const pageRef = pageNum ? `(p. ${pageNum.trim()} - ${dateStr})` : `(${dateStr})`;
                const quoteText = selected || 'trecho citado do documento...';
                const citationBlock = `\n\n> "${quoteText}" ${pageRef}\n\n`;

                notesEl.value = text.substring(0, start) + citationBlock + text.substring(end);
                const nextCursor = start + citationBlock.length;
                notesEl.setSelectionRange(nextCursor, nextCursor);
                notesEl.focus();
                this.autoSaveNotes();
                window.Lexicon.UI.Toast.show('Citação formatada inserida no fichamento', 'info');
            }
        },

        /**
         * Export consolidated structured markdown note
         */
        exportConsolidatedMarkdown() {
            if (window.Lexicon.Academic && typeof window.Lexicon.Academic.exportConsolidatedMarkdown === 'function') {
                window.Lexicon.Academic.exportConsolidatedMarkdown();
            } else {
                this.exportNotesForInspected();
            }
        },

        /**
         * The Primary Read Action: Opens the document in Integrated Split-View Reader (Phase 3)
         * @param {number|string} [articleId]
         */
        async openDocumentForReading(articleId) {
            const state = window.Lexicon.State;
            const id = Number(articleId || state.inspectedArticleId);
            const article = state.articles.find(a => a.id === id);
            if (!article) return;

            // Automatically open in Integrated Split-View Reader!
            if (window.Lexicon.Reader) {
                window.Lexicon.Reader.open(article.id);
                return;
            }

            // Fallback to external tab
            this.openDocumentInExternalTab(article.id);
        },

        /**
         * Opens document directly in external browser tab
         * @param {number|string} [articleId]
         */
        async openDocumentInExternalTab(articleId) {
            const state = window.Lexicon.State;
            const id = Number(articleId || state.inspectedArticleId);
            const article = state.articles.find(a => a.id === id);
            if (!article) return;

            // Automatically transition from inbox to reading
            if (article.status === 'inbox') {
                article.status = 'reading';
                const statusEl = document.getElementById('inspector-status');
                if (statusEl) statusEl.value = 'reading';
                window.Lexicon.Storage.save();
                window.Lexicon.Collections.render();
                this.render();
            }

            // 1. Check IndexedDB for the real stored file
            const storedFile = await window.Lexicon.Storage.getFile(article.id);
            if (storedFile) {
                const objectUrl = URL.createObjectURL(storedFile);
                window.open(objectUrl, '_blank');
                return;
            }

            // 2. If no binary file stored yet (e.g. sample items or DOI entry)
            // Generate a high-fidelity formatted document tab
            const htmlContent = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <title>${window.Lexicon.Utils.escapeHTML(article.title)}</title>
                    <style>
                        body { font-family: 'Merriweather', Georgia, serif; line-height: 1.8; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #2D251F; background: #FCFAF8; }
                        header { border-bottom: 2px solid #D1C7B7; padding-bottom: 20px; margin-bottom: 30px; }
                        h1 { font-size: 28px; line-height: 1.3; color: #1B4332; margin-bottom: 8px; }
                        .meta { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #4A4036; margin-bottom: 12px; }
                        .file-notice { background: #E6DFD3; padding: 12px 16px; border-radius: 8px; font-family: sans-serif; font-size: 13px; margin: 20px 0; }
                        .section-title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold; color: #2D6A4F; margin-top: 30px; margin-bottom: 8px; }
                        .summary { font-size: 17px; color: #2D251F; }
                        .notes { background: #F4F1EA; border-left: 4px solid #2D6A4F; padding: 15px; border-radius: 0 8px 8px 0; margin-top: 15px; font-family: sans-serif; font-size: 14px; white-space: pre-wrap; }
                        .btn-relink { display: inline-block; margin-top: 15px; padding: 8px 16px; background: #2D6A4F; color: #fff; text-decoration: none; border-radius: 6px; font-family: sans-serif; font-size: 13px; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <header>
                        <h1>${window.Lexicon.Utils.escapeHTML(article.title)}</h1>
                        <div class="meta"><strong>Authors:</strong> ${window.Lexicon.Utils.escapeHTML(String(article.authors)) || 'Unknown'} | <strong>Year:</strong> ${window.Lexicon.Utils.escapeHTML(String(article.year)) || 'N/A'} | <strong>Publication:</strong> ${window.Lexicon.Utils.escapeHTML(String(article.publication)) || 'Academic Reference'}</div>
                        ${article.doi ? `<div class="meta"><strong>DOI / Link:</strong> <a href="${article.doi.startsWith('http') ? article.doi : 'https://doi.org/' + article.doi}" target="_blank">${article.doi}</a></div>` : ''}
                    </header>
                    <div class="file-notice">
                        <strong>File Reference:</strong> <code>${article.filePath || article.fileName || 'No disk file attached'}</code>
                        <br><small>To read the full binary PDF file, attach your local PDF file using the "Re-link File" button in the document manager.</small>
                    </div>
                    <div class="section-title">Abstract & Summary</div>
                    <div class="summary">${window.Lexicon.Utils.escapeHTML(String(article.summary)) || 'No summary available.'}</div>
                    ${article.notes ? `
                        <div class="section-title">${window.Lexicon.I18n ? window.Lexicon.I18n.t('inspector.notesTitle') : 'Fichamento'}</div>
                        <div class="notes">${article.notes}</div>
                    ` : ''}
                </body>
                </html>
            `;
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const tempUrl = URL.createObjectURL(blob);
            window.open(tempUrl, '_blank');
        },

        /**
         * Prompt user to re-link or attach an actual file from their computer
         */
        async relinkFileForInspected() {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article) return;

            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf,.epub,.doc,.docx,.txt,.md';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                article.fileName = file.name;
                article.fileSize = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
                article.filePath = file.name;
                if (file.name.endsWith('.pdf')) article.coverType = 'pdf';
                else if (file.name.endsWith('.epub')) article.coverType = 'book';

                await window.Lexicon.Storage.storeFile(article.id, file);
                window.Lexicon.Storage.save();

                // Update inspector display
                const fileNameEl = document.getElementById('inspector-file-name');
                const filePathEl = document.getElementById('inspector-file-path');
                const fileSizeEl = document.getElementById('inspector-file-size');
                if (fileNameEl) fileNameEl.textContent = article.fileName;
                if (filePathEl) filePathEl.textContent = article.filePath;
                if (fileSizeEl) fileSizeEl.textContent = article.fileSize;

                this.render();
                window.Lexicon.UI.Toast.show('File linked successfully! Click READ to open.', 'success');
            };
            input.click();
        },

        /**
         * Export document notes as Markdown (.md)
         */
        exportNotesForInspected() {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article) return;

            const notesHeading = window.Lexicon.I18n ? window.Lexicon.I18n.t('inspector.notesTitle') : 'Fichamento';
            const summaryHeading = window.Lexicon.I18n ? window.Lexicon.I18n.t('inspector.summaryTab') : 'Abstract & Summary';
            const mdContent = `# ${notesHeading}: ${window.Lexicon.Utils.escapeHTML(article.title)}\n\n**Authors:** ${window.Lexicon.Utils.escapeHTML(String(article.authors)) || 'Unknown'}\n**Year:** ${window.Lexicon.Utils.escapeHTML(String(article.year)) || 'N/A'}\n**Collection:** ${window.Lexicon.Utils.escapeHTML(String(article.collection)) || 'General'}\n**File Reference:** ${window.Lexicon.Utils.escapeHTML(String(article.fileName)) || 'N/A'}\n\n## ${summaryHeading}\n${window.Lexicon.Utils.escapeHTML(String(article.summary)) || 'N/A'}\n\n## ${notesHeading}\n${article.notes || 'No notes written yet.'}\n`;

            const blob = new Blob([mdContent], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const cleanTitle = (article.title || 'document').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
            a.href = url;
            a.download = `Notes_${cleanTitle}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.Lexicon.UI.Toast.show('Notes exported as Markdown', 'success');
        },

        /**
         * Delete document from catalog and IndexedDB
         */
        async deleteInspected() {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article) return;

            if (!confirm(`Are you sure you want to remove "${window.Lexicon.Utils.escapeHTML(article.title)}" from your library catalog?`)) {
                return;
            }

            await window.Lexicon.Storage.deleteFile(article.id);
            state.articles = state.articles.filter(a => a.id !== article.id);
            window.Lexicon.Storage.save();
            window.Lexicon.Collections.render();
            this.render();

            window.Lexicon.UI.Modal.close('inspector-modal');
            window.Lexicon.UI.Toast.show('Document removed from catalog', 'info');
        },

        /**
         * Handle submission of "Add Document" modal
         */
        async handleAddArticleSubmit() {
            const titleInput = document.getElementById('form-title');
            const authorInput = document.getElementById('form-author');
            const yearInput = document.getElementById('form-year');
            const pubInput = document.getElementById('form-pub');
            const doiInput = document.getElementById('form-doi');
            const statusSelect = document.getElementById('form-status');
            const collectionSelect = document.getElementById('form-collection');
            const summaryInput = document.getElementById('form-summary');
            const fileInput = document.getElementById('file-upload');
            const submitBtn = document.getElementById('submit-article-btn');

            const title = titleInput ? titleInput.value.trim() : '';
            if (!title) {
                window.Lexicon.UI.Toast.show('Please enter a document title', 'warning');
                return;
            }

            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Registering...';
            submitBtn.disabled = true;

            const file = fileInput && fileInput.files ? fileInput.files[0] : null;
            const articleId = Date.now();

            let fileName = 'Manual entry';
            let fileSize = '—';
            let filePath = 'Local file';
            let coverType = 'pdf';

            if (file) {
                fileName = file.name;
                fileSize = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
                filePath = file.webkitRelativePath || file.name;
                if (file.name.endsWith('.epub')) coverType = 'book';
                else if (file.name.endsWith('.doc') || file.name.endsWith('.docx')) coverType = 'doc';

                // Save binary file into IndexedDB
                await window.Lexicon.Storage.storeFile(articleId, file);
            }

            const col = collectionSelect && collectionSelect.value !== 'none' && collectionSelect.value !== '' ? collectionSelect.value : null;

            const newArticle = {
                id: articleId,
                title: title,
                authors: authorInput && authorInput.value.trim() ? authorInput.value.trim() : 'Unknown',
                year: parseInt(yearInput && yearInput.value ? yearInput.value : new Date().getFullYear()),
                publication: pubInput && pubInput.value.trim() ? pubInput.value.trim() : '',
                doi: doiInput && doiInput.value.trim() ? doiInput.value.trim() : '',
                status: statusSelect ? statusSelect.value : 'inbox',
                collection: col,
                tags: ['New', file ? file.name.split('.').pop().toUpperCase() : 'Document'],
                addedDate: new Date().toISOString().split('T')[0],
                isFavorite: false,
                coverType: coverType,
                fileName: fileName,
                fileSize: fileSize,
                filePath: filePath,
                summary: summaryInput && summaryInput.value.trim() ? summaryInput.value.trim() : 'Registered document.',
                notes: ''
            };

            const state = window.Lexicon.State;
            state.articles.unshift(newArticle);
            window.Lexicon.Storage.save();
            window.Lexicon.Collections.render();
            this.render();

            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
            window.Lexicon.UI.Modal.close('upload-modal');
            window.Lexicon.UI.Toast.show('Document added to library catalog', 'success');

            // Reset form
            document.getElementById('add-article-form').reset();
            const fileNameDisplay = document.getElementById('selected-file-name');
            if (fileNameDisplay) fileNameDisplay.textContent = '';
        },

        /* ------------------------------------------------------------------
           Upload Modal Tabs & Multi-File / Folder Import
           ------------------------------------------------------------------ */
        stagedFiles: [],

        switchUploadTab(tab) {
            const tabSingle = document.getElementById('upload-tab-single');
            const tabMulti = document.getElementById('upload-tab-multi');
            const btnSingle = document.getElementById('tab-btn-single');
            const btnMulti = document.getElementById('tab-btn-multi');
            const submitSingle = document.getElementById('submit-article-btn');
            const submitMulti = document.getElementById('submit-multi-import-btn');

            if (tab === 'multi') {
                if (tabSingle) tabSingle.classList.add('hidden');
                if (tabMulti) tabMulti.classList.remove('hidden');
                if (btnSingle) btnSingle.classList.remove('active');
                if (btnMulti) btnMulti.classList.add('active');
                if (submitSingle) submitSingle.classList.add('hidden');
                if (submitMulti) submitMulti.classList.remove('hidden');
            } else {
                if (tabMulti) tabMulti.classList.add('hidden');
                if (tabSingle) tabSingle.classList.remove('hidden');
                if (btnMulti) btnMulti.classList.remove('active');
                if (btnSingle) btnSingle.classList.add('active');
                if (submitMulti) submitMulti.classList.add('hidden');
                if (submitSingle) submitSingle.classList.remove('hidden');
            }
        },

        isSupportedDocument(filename) {
            const supportedExts = ['.pdf', '.epub', '.doc', '.docx', '.txt', '.md', '.mobi', '.djvu'];
            const lower = filename.toLowerCase();
            return supportedExts.some(ext => lower.endsWith(ext));
        },

        cleanTitle(filename) {
            const base = filename.replace(/\.[^/.]+$/, "");
            const cleaned = base.replace(/[-_+]/g, " ").replace(/\s+/g, " ").trim();
            return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        },

        extractYear(filename) {
            const match = filename.match(/\b(19\d{2}|20\d{2})\b/);
            return match ? parseInt(match[1]) : new Date().getFullYear();
        },

        getCoverType(filename) {
            const lower = filename.toLowerCase();
            if (lower.endsWith('.epub') || lower.endsWith('.mobi')) return 'book';
            if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'doc';
            return 'pdf';
        },

        formatBytes(bytes) {
            if (!bytes || bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        },

        /**
         * Add files to staging list, checking for supported extensions and extracting folder info
         */
        addFilesToStaging(items) {
            let addedCount = 0;
            items.forEach(item => {
                const file = item.file || item;
                if (!file || !file.name) return;

                // Ignore hidden or OS files
                if (file.name.startsWith('.') || file.name.startsWith('~') || file.name === 'Thumbs.db') return;
                if (!this.isSupportedDocument(file.name)) return;

                // Check duplicate in staged
                const exists = this.stagedFiles.some(s => s.file.name === file.name && s.file.size === file.size && s.path === (item.path || file.name));
                if (exists) return;

                let relativePath = item.path || file.webkitRelativePath || file.name;
                let folder = item.folder || '';

                if (!folder && relativePath && relativePath.includes('/')) {
                    const parts = relativePath.split('/').filter(Boolean);
                    if (parts.length > 1) {
                        folder = parts[parts.length - 2];
                    }
                }

                this.stagedFiles.push({
                    file: file,
                    name: file.name,
                    size: file.size,
                    path: relativePath,
                    folder: folder ? folder.trim() : ''
                });
                addedCount++;
            });

            this.renderStagedFiles();
            if (addedCount > 0) {
                this.switchUploadTab('multi');
            }
        },

        renderStagedFiles() {
            const container = document.getElementById('staged-files-section');
            const listEl = document.getElementById('staged-files-list');
            const countText = document.getElementById('staged-count-text');
            const submitBtn = document.getElementById('submit-multi-import-btn');

            if (!container || !listEl || !countText) return;

            const n = this.stagedFiles.length;
            if (n === 0) {
                container.classList.add('hidden');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Import Documents';
                }
                return;
            }

            container.classList.remove('hidden');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = `Import ${n} Document${n > 1 ? 's' : ''}`;
            }

            // Calculate folders breakdown
            const folders = {};
            this.stagedFiles.forEach(f => {
                const fol = f.folder || 'Uncategorized';
                folders[fol] = (folders[fol] || 0) + 1;
            });

            const folderNames = Object.keys(folders);
            const folderBreakdown = folderNames.map(f => `${f} (${folders[f]})`).join(', ');
            countText.innerHTML = `<strong>${n} document${n > 1 ? 's' : ''} staged</strong> <span class="text-earth/70 font-normal">in ${folderNames.length} folder${folderNames.length > 1 ? 's' : ''}: ${folderBreakdown}</span>`;

            listEl.innerHTML = this.stagedFiles.map((staged, idx) => {
                const coverType = this.getCoverType(staged.name);
                const icon = coverType === 'book' ? 'ph-book-bookmark text-terracotta' :
                             coverType === 'doc' ? 'ph-file-doc text-jungle' :
                             'ph-file-pdf text-terracotta';

                return `
                    <div class="staged-file-row flex items-center justify-between px-3 py-2 gap-3">
                        <div class="flex items-center gap-2.5 min-w-0 flex-1">
                            <i class="ph ${icon} text-base shrink-0"></i>
                            <div class="min-w-0">
                                <p class="text-xs font-semibold text-soil truncate">${window.Lexicon.Utils.escapeHTML(staged.name)}</p>
                                <div class="flex items-center gap-2 text-[10px] text-earth/70 font-mono">
                                    ${staged.folder ? `<span class="bg-jungle/10 text-canopy px-1.5 py-0.5 rounded font-sans font-semibold flex items-center gap-1"><i class="ph ph-folder text-xs"></i> ${window.Lexicon.Utils.escapeHTML(staged.folder)}</span>` : '<span class="italic font-sans">No folder</span>'}
                                    <span>${this.formatBytes(staged.size)}</span>
                                </div>
                            </div>
                        </div>
                        <button type="button" data-action="remove-staged-file" data-index="${idx}" class="text-earth hover:text-terracotta p-1 rounded transition-colors cursor-pointer" title="Remove file">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>
                `;
            }).join('');
        },

        removeStagedFile(idx) {
            this.stagedFiles.splice(idx, 1);
            this.renderStagedFiles();
        },

        clearStagedFiles() {
            this.stagedFiles = [];
            this.renderStagedFiles();
            const multiInput = document.getElementById('import-multi-files-input');
            const folderInput = document.getElementById('import-folder-input');
            if (multiInput) multiInput.value = '';
            if (folderInput) folderInput.value = '';
        },

        /**
         * Recursively scan DataTransferItemList for files and folder hierarchies
         */
        async scanDataTransferItems(items) {
            const results = [];
            const queue = [];

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.webkitGetAsEntry) {
                    const entry = item.webkitGetAsEntry();
                    if (entry) queue.push(entry);
                } else if (item.kind === 'file') {
                    const f = item.getAsFile();
                    if (f) results.push({ file: f, path: f.name, folder: '' });
                }
            }

            while (queue.length > 0) {
                const entry = queue.shift();
                if (entry.isFile) {
                    await new Promise((resolve) => {
                        entry.file((file) => {
                            const cleanPath = (entry.fullPath || '').replace(/^\//, '') || file.name;
                            const parts = cleanPath.split('/').filter(Boolean);
                            const folder = parts.length > 1 ? parts[parts.length - 2] : '';
                            results.push({ file, path: cleanPath, folder });
                            resolve();
                        }, () => resolve());
                    });
                } else if (entry.isDirectory) {
                    const dirReader = entry.createReader();
                    const entries = await new Promise((resolve) => {
                        const readAll = (acc = []) => {
                            dirReader.readEntries((batch) => {
                                if (!batch.length) resolve(acc);
                                else readAll(acc.concat(Array.from(batch)));
                            }, () => resolve(acc));
                        };
                        readAll();
                    });
                    for (const sub of entries) {
                        queue.push(sub);
                    }
                }
            }

            return results;
        },

        /**
         * Execute multi-file and folder import
         */
        async executeMultiImport() {
            if (this.stagedFiles.length === 0) return;

            const submitBtn = document.getElementById('submit-multi-import-btn');
            const progressContainer = document.getElementById('import-progress-container');
            const progressBar = document.getElementById('import-progress-bar');
            const progressLabel = document.getElementById('import-progress-label');
            const progressPercent = document.getElementById('import-progress-percent');

            const autoCollections = document.getElementById('import-opt-folder-collections')?.checked ?? true;
            const autoTags = document.getElementById('import-opt-folder-tags')?.checked ?? true;
            const fallbackCollection = document.getElementById('import-opt-default-collection')?.value || null;
            const targetStatus = document.getElementById('import-opt-status')?.value || 'inbox';

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Importing...';
            }

            if (progressContainer) progressContainer.classList.remove('hidden');

            const total = this.stagedFiles.length;
            const createdCollections = new Set();
            const state = window.Lexicon.State;

            for (let i = 0; i < total; i++) {
                const staged = this.stagedFiles[i];
                const file = staged.file;
                const articleId = Date.now() + i;

                // Determine collection
                let collectionName = fallbackCollection;
                if (staged.folder && autoCollections) {
                    collectionName = staged.folder;
                    window.Lexicon.Collections.getOrCreate(collectionName);
                    createdCollections.add(collectionName);
                } else if (fallbackCollection) {
                    collectionName = fallbackCollection;
                }

                // Determine tags
                const tags = [];
                if (staged.folder && autoTags) {
                    tags.push(staged.folder.replace(/[^a-zA-Z0-9_-]/g, '-'));
                }
                const ext = file.name.split('.').pop().toUpperCase();
                if (ext) tags.push(ext);

                // Store in IndexedDB
                await window.Lexicon.Storage.storeFile(articleId, file);

                // Build article metadata
                const title = this.cleanTitle(file.name);
                const year = this.extractYear(file.name);
                const coverType = this.getCoverType(file.name);

                const newArticle = {
                    id: articleId,
                    title: title,
                    authors: 'Unknown',
                    year: year,
                    publication: '',
                    doi: '',
                    status: targetStatus,
                    collection: collectionName,
                    tags: tags,
                    addedDate: new Date().toISOString().split('T')[0],
                    isFavorite: false,
                    coverType: coverType,
                    fileName: file.name,
                    fileSize: this.formatBytes(file.size),
                    filePath: staged.path || file.name,
                    summary: staged.folder 
                        ? `Imported from folder "${staged.folder}".` 
                        : 'Imported document.',
                    notes: ''
                };

                state.articles.unshift(newArticle);

                // Update progress
                const pct = Math.round(((i + 1) / total) * 100);
                if (progressBar) progressBar.style.width = `${pct}%`;
                if (progressPercent) progressPercent.textContent = `${pct}%`;
                if (progressLabel) progressLabel.textContent = `Importing (${i + 1}/${total}): ${file.name}`;
            }

            window.Lexicon.Storage.save();
            window.Lexicon.Collections.render();
            window.Lexicon.Collections.populateSelects();
            this.render();

            this.clearStagedFiles();
            if (progressContainer) progressContainer.classList.add('hidden');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Import Documents';
            }

            window.Lexicon.UI.Modal.close('upload-modal');

            const colMsg = createdCollections.size > 0 
                ? ` into ${createdCollections.size} collection${createdCollections.size > 1 ? 's' : ''}` 
                : '';
            window.Lexicon.UI.Toast.show(`Imported ${total} documents${colMsg} successfully!`, 'success');
        }
    };
})();
