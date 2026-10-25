/* ==========================================================================
   Lexicon - Articles & Document Manager Module
   Intelligent file organization, document overview, inspection & native read
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    const PAGE_SIZE = 200;
    const UNFILED_KEY = '\u0000__unfiled__';
    const VALID_STATUS = ['inbox', 'reading', 'processing', 'archived'];
    const SUPPORTED_EXTS = ['pdf', 'epub', 'doc', 'docx', 'txt', 'md', 'mobi', 'djvu'];
    const RENDERABLE_EXTS = ['pdf', 'epub', 'txt', 'md'];

    const U = () => window.Lexicon.Utils;
    const esc = (s) => U().escapeHTML(s);
    const disp = (v, f) => U().display(v, f);
    const tr = (k, f, p) => U().tr(k, f, p);
    const toast = (m, t) => window.Lexicon.UI.Toast.show(m, t);
    const L = () => window.Lexicon;

    /** Cache of the last PDF extraction done in the "Add document" form */
    let formExtraction = null; // { file, result }

    function fileTypeIcon(article) {
        const ext = U().fileExt(article.fileName);
        if (article.coverType === 'book' || ext === 'epub' || ext === 'mobi') return 'ph-book-bookmark text-terracotta';
        if (article.coverType === 'doc' || ext === 'doc' || ext === 'docx') return 'ph-file-doc text-jungle';
        if (ext === 'txt' || ext === 'md') return 'ph-file-text text-jungle';
        return 'ph-file-pdf text-terracotta';
    }

    function searchHaystack(a) {
        return U().fold([
            a.title, a.authors, a.summary, a.notes, a.fileName, a.publication, a.doi,
            (a.tags || []).join(' ')
        ].join('\u0001'));
    }

    function filterSignature(state) {
        return JSON.stringify([state.currentFilter, state.activeTag, state.searchQuery, state.semanticFilter, state.sortBy, state.viewMode]);
    }

    window.Lexicon.Articles = {
        renderLimit: PAGE_SIZE,
        _lastSignature: '',

        /**
         * Initialize central event delegation for articles container and modals
         */
        init() {
            if (this._initialized) return;
            this._initialized = true;

            const container = document.getElementById('articles-container');
            if (container) {
                container.addEventListener('click', (e) => this._handleContainerAction(e));
                container.addEventListener('keydown', (e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    const el = e.target.closest('[data-action="inspect-article"], [data-action="toggle-folder-expand"]');
                    if (el && el === e.target) {
                        e.preventDefault();
                        el.click();
                    }
                });
            }

            const tagsList = document.getElementById('inspector-tags-list');
            if (tagsList) {
                tagsList.addEventListener('click', (e) => {
                    const removeBtn = e.target.closest('[data-action="remove-inspected-tag"]');
                    if (removeBtn) {
                        e.stopPropagation();
                        const tag = removeBtn.dataset.tagName;
                        if (tag) this.removeTagFromInspected(tag);
                    }
                });
            }

            const stagedList = document.getElementById('staged-files-list') || document.getElementById('multi-file-preview');
            if (stagedList) {
                stagedList.addEventListener('click', (e) => {
                    const removeBtn = e.target.closest('[data-action="remove-staged-file"]');
                    if (removeBtn) {
                        e.stopPropagation();
                        const idx = Number(removeBtn.dataset.index);
                        if (!isNaN(idx)) this.removeStagedFile(idx);
                    }
                });
            }

            const banner = document.getElementById('active-filter-banner');
            if (banner) {
                banner.addEventListener('click', (e) => {
                    const actionEl = e.target.closest('[data-action]');
                    if (!actionEl) return;
                    e.stopPropagation();
                    if (actionEl.dataset.action === 'clear-semantic-filter' && L().Librarian) L().Librarian.clearSemanticFilter();
                    if (actionEl.dataset.action === 'clear-tag-filter') this.clearTagFilter();
                });
            }

            // Inspector: unsaved metadata edits are not silently discarded
            const Modal = L().UI.Modal;
            Modal.beforeClose('inspector-modal', () => {
                this.flushNotesSave();
                if (this._skipDirtyCheck) {
                    this._skipDirtyCheck = false;
                    return true;
                }
                if (this.isInspectorDirty()) {
                    if (window.confirm(tr('inspector.confirmSaveOnClose', 'Salvar as alterações feitas neste documento antes de fechar?\n\nOK = salvar • Cancelar = descartar'))) {
                        this.saveInspected({ silent: true });
                    }
                }
                return true;
            });
        },

        _handleContainerAction(e) {
            const el = e.target.closest('[data-action]');
            if (!el) return;
            const action = el.dataset.action;
            const id = Number(el.dataset.articleId);
            const folderName = el.dataset.folderName;

            switch (action) {
                case 'noop':
                    return;
                case 'filter-tag':
                    e.stopPropagation();
                    if (el.dataset.tagName) this.filterByTag(el.dataset.tagName);
                    return;
                case 'toggle-favorite':
                    e.stopPropagation();
                    if (id) this.toggleFavorite(id);
                    return;
                case 'toggle-select':
                    e.stopPropagation();
                    if (id) this.toggleSelect(id);
                    return;
                case 'toggle-select-all':
                    e.stopPropagation();
                    this.toggleSelectAll(el.checked);
                    return;
                case 'read-article':
                    e.stopPropagation();
                    if (id) this.openDocumentForReading(id);
                    return;
                case 'toggle-folder-expand':
                    e.stopPropagation();
                    if (folderName) this.toggleFolderExpand(folderName);
                    return;
                case 'add-folder-doc':
                    e.stopPropagation();
                    if (folderName) this.openAddModalForCollection(folderName);
                    return;
                case 'select-folder':
                    e.stopPropagation();
                    if (folderName === UNFILED_KEY) this.filterUnfiled();
                    else if (folderName) L().Collections.select(folderName);
                    return;
                case 'delete-folder':
                    e.stopPropagation();
                    if (el.dataset.folderId && folderName) L().Collections.deleteCollection(el.dataset.folderId, folderName);
                    return;
                case 'toggle-all-folders':
                    e.stopPropagation();
                    this.toggleAllFolders(el.dataset.expand === 'true');
                    return;
                case 'create-collection-modal':
                    e.stopPropagation();
                    L().Collections.openCreateModal();
                    return;
                case 'show-more':
                    e.stopPropagation();
                    this.renderLimit += PAGE_SIZE;
                    this.render({ keepLimit: true });
                    return;
                case 'inspect-article':
                    if (id) this.inspect(id);
                    return;
                default:
                    return;
            }
        },

        /**
         * Get filtered and sorted list of articles
         */
        getFilteredArticles() {
            const state = window.Lexicon.State;
            let list = state.articles.slice();

            if (state.currentFilter.type === 'category') {
                const filter = state.currentFilter.value;
                if (VALID_STATUS.includes(filter)) {
                    list = list.filter(a => a.status === filter);
                } else if (filter === 'favorites') {
                    list = list.filter(a => a.isFavorite);
                } else if (filter === 'recent') {
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setHours(0, 0, 0, 0);
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    list = list.filter(a => {
                        const d = U().parseLocalDate(a.addedDate);
                        return d && d >= sevenDaysAgo;
                    });
                }
            } else if (state.currentFilter.type === 'collection') {
                const colName = state.currentFilter.value;
                list = list.filter(a => a.collection === colName);
            } else if (state.currentFilter.type === 'unfiled') {
                const known = new Set(state.collections.map(c => c.name));
                list = list.filter(a => !a.collection || !known.has(a.collection));
            }

            if (state.activeTag) {
                const tagLower = String(state.activeTag).toLowerCase();
                list = list.filter(a => Array.isArray(a.tags) && a.tags.some(t => String(t).toLowerCase() === tagLower));
            }

            if (state.semanticFilter) {
                const sf = state.semanticFilter;
                if (sf.status) {
                    if (sf.status === 'favorites') {
                        list = list.filter(a => a.isFavorite);
                    } else if (sf.status === 'recent') {
                        const cutoff = new Date();
                        cutoff.setDate(cutoff.getDate() - 30);
                        list = list.filter(a => {
                            const d = U().parseLocalDate(a.addedDate);
                            return d && d >= cutoff;
                        });
                    } else {
                        list = list.filter(a => a.status === sf.status);
                    }
                }
                if (sf.year) list = list.filter(a => Number(a.year) === Number(sf.year));
                if (sf.collection) {
                    const colQ = String(sf.collection).toLowerCase();
                    list = list.filter(a => (a.collection || '').toLowerCase() === colQ);
                }
                if (sf.tag) {
                    const tagQ = String(sf.tag).toLowerCase();
                    list = list.filter(a => Array.isArray(a.tags) && a.tags.some(t => String(t).toLowerCase() === tagQ));
                }
                if (sf.textQuery) {
                    const terms = U().fold(sf.textQuery).split(/\s+/).filter(Boolean);
                    list = list.filter(a => {
                        const hay = searchHaystack(a);
                        return terms.every(t => hay.includes(t));
                    });
                }
            }

            if (state.searchQuery) {
                const terms = U().fold(state.searchQuery).split(/\s+/).filter(Boolean);
                list = list.filter(a => {
                    const hay = searchHaystack(a);
                    return terms.every(t => hay.includes(t));
                });
            }

            const dateVal = (a) => {
                const d = U().parseLocalDate(a.addedDate);
                return d ? d.getTime() : 0;
            };
            switch (state.sortBy) {
                case 'date-asc':
                    list.sort((a, b) => dateVal(a) - dateVal(b) || a.id - b.id);
                    break;
                case 'title-asc': {
                    const collator = new Intl.Collator((L().I18n && L().I18n.locale) || 'pt-BR', { sensitivity: 'base', numeric: true });
                    list.sort((a, b) => collator.compare(a.title || '', b.title || ''));
                    break;
                }
                case 'year-desc':
                    list.sort((a, b) => (b.year || 0) - (a.year || 0) || dateVal(b) - dateVal(a));
                    break;
                case 'date-desc':
                default:
                    list.sort((a, b) => dateVal(b) - dateVal(a) || b.id - a.id);
                    break;
            }

            return list;
        },

        /**
         * Render the document cards or table view
         * @param {{keepLimit?: boolean}} [opts]
         */
        render(opts = {}) {
            const state = window.Lexicon.State;
            const container = document.getElementById('articles-container');
            const emptyState = document.getElementById('empty-state');
            const viewTitle = document.getElementById('current-view-title');
            const viewCount = document.getElementById('current-view-count');
            const activeFilterBanner = document.getElementById('active-filter-banner');
            if (!container || !viewTitle || !viewCount) return;

            // Drop selections that no longer exist
            if (state.selectedIds && state.selectedIds.length) {
                const ids = new Set(state.articles.map(a => a.id));
                state.selectedIds = state.selectedIds.filter(id => ids.has(id));
            }

            const signature = filterSignature(state);
            if (!opts.keepLimit && signature !== this._lastSignature) this.renderLimit = PAGE_SIZE;
            this._lastSignature = signature;

            const finish = () => {
                this.updateBatchBar();
                if (L().Navigation) {
                    L().Navigation.updateButtons();
                    L().Navigation.updateActiveSidebarLink();
                }
            };

            const hideBanner = () => {
                if (activeFilterBanner) {
                    activeFilterBanner.classList.add('hidden');
                    activeFilterBanner.innerHTML = '';
                }
            };

            if (state.currentFilter.type === 'category' && state.currentFilter.value === 'collections') {
                hideBanner();
                this.renderFoldersView(container, emptyState, viewTitle, viewCount);
                finish();
                return;
            }

            if (state.currentFilter.type === 'category' && state.currentFilter.value === 'stats') {
                hideBanner();
                if (emptyState) {
                    emptyState.classList.add('hidden');
                    emptyState.classList.remove('flex');
                }
                container.className = 'w-full block';
                if (L().Dashboard) L().Dashboard.render(container, emptyState, viewTitle, viewCount);
                finish();
                return;
            }

            const articles = this.getFilteredArticles();

            if (state.semanticFilter) {
                viewTitle.textContent = `${tr('search.semanticTitle', 'Busca Semântica')}: "${state.semanticFilter.originalQuery}"`;
            } else if (state.searchQuery) {
                viewTitle.textContent = `${tr('search.title', 'Search')}: "${state.searchQuery}"`;
            } else if (state.activeTag) {
                viewTitle.textContent = `${tr('search.tagTitle', 'Tag')}: #${state.activeTag}`;
            } else if (state.currentFilter.type === 'category') {
                viewTitle.textContent = tr(`nav.${state.currentFilter.value}`, state.currentFilter.title || 'Documents');
            } else if (state.currentFilter.type === 'unfiled') {
                viewTitle.textContent = tr('folders.unfiled', 'Sem coleção');
            } else {
                viewTitle.textContent = state.currentFilter.title || tr('nav.all', 'All Documents');
            }

            const docWord = articles.length === 1 ? tr('common.document', 'document') : tr('common.documents', 'documents');
            viewCount.textContent = `${articles.length} ${docWord}`;

            if (activeFilterBanner) {
                if (state.semanticFilter) {
                    const sf = state.semanticFilter;
                    const statusLabel = sf.status === 'favorites' ? tr('nav.favorites', 'Favorites')
                        : sf.status === 'recent' ? tr('nav.recent', 'Recent')
                        : sf.status ? this.getStatusLabel(sf.status) : '';
                    const chip = (content) => `<span class="px-2 py-0.5 bg-paper border border-wood rounded text-[11px] text-soil font-medium">${content}</span>`;
                    activeFilterBanner.classList.remove('hidden');
                    activeFilterBanner.innerHTML = `
                        <div class="flex flex-wrap items-center gap-2 px-3.5 py-2 bg-jungle/10 border border-jungle/20 rounded-xl text-xs text-soil w-full" role="status">
                            <div class="flex items-center gap-1.5 font-semibold text-canopy shrink-0">
                                <i class="ph ph-robot text-base text-jungle" aria-hidden="true"></i>
                                <span>${esc(tr('search.aiLibrarian', 'Bibliotecário IA'))}:</span>
                            </div>
                            <span class="text-earth/90 italic">"${esc(sf.originalQuery)}"</span>
                            ${sf.year ? chip(`${esc(tr('search.chipYear', 'Ano'))}: ${esc(sf.year)}`) : ''}
                            ${statusLabel ? chip(`${esc(tr('search.chipStatus', 'Status'))}: ${esc(statusLabel)}`) : ''}
                            ${sf.tag ? chip(`#${esc(sf.tag)}`) : ''}
                            ${sf.collection ? chip(`${esc(tr('search.chipCollection', 'Coleção'))}: ${esc(sf.collection)}`) : ''}
                            ${sf.textQuery ? chip(`${esc(tr('search.chipTerm', 'Termo'))}: "${esc(sf.textQuery)}"`) : ''}
                            <button type="button" data-action="clear-semantic-filter" class="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-terracotta hover:underline shrink-0 cursor-pointer">
                                <i class="ph ph-x-circle text-sm" aria-hidden="true"></i> ${esc(tr('search.clearSemantic', 'Limpar Filtro IA'))}
                            </button>
                        </div>
                    `;
                } else if (state.activeTag) {
                    activeFilterBanner.classList.remove('hidden');
                    activeFilterBanner.innerHTML = `
                        <div class="inline-flex items-center gap-2 px-3 py-1 bg-jungle/10 border border-jungle/20 text-canopy rounded-lg text-xs font-medium">
                            <span>${esc(tr('search.filteringByTag', 'Filtering by tag:'))} <strong>#${esc(state.activeTag)}</strong></span>
                            <button type="button" data-action="clear-tag-filter" class="hover:text-terracotta p-0.5 cursor-pointer" aria-label="${esc(tr('search.clearTag', 'Remover filtro de tag'))}"><i class="ph-bold ph-x" aria-hidden="true"></i></button>
                        </div>
                    `;
                } else {
                    hideBanner();
                }
            }

            if (articles.length === 0) {
                container.innerHTML = '';
                container.className = '';
                if (emptyState) {
                    emptyState.classList.remove('hidden');
                    emptyState.classList.add('flex');
                }
                finish();
                return;
            }

            if (emptyState) {
                emptyState.classList.add('hidden');
                emptyState.classList.remove('flex');
            }

            const visible = articles.slice(0, this.renderLimit);
            const remaining = articles.length - visible.length;
            const moreBtn = remaining > 0 ? `
                <div class="col-span-full flex justify-center pt-2">
                    <button type="button" data-action="show-more" class="px-4 py-2 bg-paper border border-wood rounded-xl text-xs font-semibold text-soil hover:bg-clay/50 cursor-pointer">
                        ${esc(tr('common.showMore', 'Mostrar mais ({count} restantes)', { count: remaining }))}
                    </button>
                </div>` : '';

            if (state.viewMode === 'table') {
                container.className = 'flex flex-col gap-2 pb-24';
                container.innerHTML = this.renderTable(visible, articles) + moreBtn;
            } else {
                container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24';
                container.innerHTML = visible.map(a => this.createCardHtml(a)).join('') + moreBtn;
            }

            finish();
        },

        /**
         * Render the Dedicated Folders & Collections View
         */
        renderFoldersView(container, emptyState, viewTitle, viewCount) {
            const state = window.Lexicon.State;
            const unfiledLabel = tr('folders.unfiled', 'Sem coleção');

            if (!Array.isArray(state.expandedFolders)) {
                state.expandedFolders = state.collections.map(c => c.name);
                state.expandedFolders.push(UNFILED_KEY);
            }

            viewTitle.textContent = tr('folders.title', 'Coleções & Pastas');
            const docWord = state.articles.length === 1 ? tr('common.document', 'document') : tr('common.documents', 'documents');
            const colWord = state.collections.length === 1 ? tr('common.collection', 'coleção') : tr('common.collectionsLower', 'coleções');
            viewCount.textContent = `${state.collections.length} ${colWord} • ${state.articles.length} ${docWord}`;

            if (emptyState) {
                emptyState.classList.add('hidden');
                emptyState.classList.remove('flex');
            }

            const articlesByCol = new Map(state.collections.map(c => [c.name, []]));
            articlesByCol.set(UNFILED_KEY, []);

            const terms = U().fold(state.searchQuery || '').split(/\s+/).filter(Boolean);

            state.articles.forEach(a => {
                if (terms.length) {
                    const hay = searchHaystack(a);
                    if (!terms.every(t => hay.includes(t))) return;
                }
                if (a.collection && articlesByCol.has(a.collection)) {
                    articlesByCol.get(a.collection).push(a);
                } else {
                    articlesByCol.get(UNFILED_KEY).push(a);
                }
            });

            const allFoldersList = state.collections.map(c => ({ id: c.id, key: c.name, name: c.name }));
            if (articlesByCol.get(UNFILED_KEY).length > 0) {
                allFoldersList.push({ id: 'unfiled_general', key: UNFILED_KEY, name: unfiledLabel, isUnfiled: true });
            }

            if (allFoldersList.length === 0) {
                container.className = 'flex flex-col gap-4 pb-24';
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-20 text-center bg-paper rounded-2xl border border-wood">
                        <div class="w-16 h-16 rounded-full bg-clay border border-wood flex items-center justify-center text-earth mb-4">
                            <i class="ph ph-folder-notch-open text-3xl" aria-hidden="true"></i>
                        </div>
                        <h3 class="text-base font-serif font-bold text-soil mb-1">${esc(tr('folders.emptyNotice', 'No collections created yet'))}</h3>
                        <p class="text-xs text-earth max-w-sm mb-6">${esc(tr('folders.noFiles', 'Create your first collection or import folders to organize your research documents.'))}</p>
                        <button type="button" data-action="create-collection-modal" class="px-4 py-2 bg-jungle text-white rounded-xl text-xs font-semibold hover:bg-canopy transition-colors flex items-center gap-2 cursor-pointer">
                            <i class="ph ph-folder-plus text-base" aria-hidden="true"></i>
                            <span>${esc(tr('collections.createBtn', 'Create Collection'))}</span>
                        </button>
                    </div>
                `;
                return;
            }

            const expanded = new Set(state.expandedFolders || []);
            const allExpanded = allFoldersList.every(f => expanded.has(f.key));

            container.className = 'flex flex-col gap-4 pb-24';

            const toolbarHtml = `
                <div class="flex flex-wrap items-center justify-between gap-3 bg-paper border border-wood/70 rounded-2xl px-5 py-3 shadow-2xs mb-2">
                    <div class="flex items-center gap-2 text-xs text-earth">
                        <span class="w-2 h-2 rounded-full bg-leaf" aria-hidden="true"></span>
                        <span class="font-bold text-soil">${allFoldersList.length}</span> ${esc(allFoldersList.length === 1 ? tr('common.collection', 'coleção') : tr('common.collectionsLower', 'coleções'))}
                        ${terms.length ? `<span class="bg-jungle/10 text-canopy px-2 py-0.5 rounded text-[11px] font-medium ml-1">${esc(tr('search.filteredBy', 'Filtered by:'))} "${esc(state.searchQuery)}"</span>` : ''}
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" data-action="toggle-all-folders" data-expand="${!allExpanded}"
                                class="px-3.5 py-1.5 bg-sand hover:bg-wood/40 border border-wood rounded-xl text-xs font-semibold text-soil transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer">
                            <i class="ph ${allExpanded ? 'ph-caret-double-up' : 'ph-caret-double-down'} text-earth" aria-hidden="true"></i>
                            <span>${esc(allExpanded ? tr('folders.reduceAll', 'Reduce All Folders') : tr('folders.expandAll', 'Expand All Folders'))}</span>
                        </button>
                        <button type="button" data-action="create-collection-modal"
                                class="px-3.5 py-1.5 bg-jungle text-white hover:bg-canopy rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer">
                            <i class="ph ph-folder-plus text-sm" aria-hidden="true"></i>
                            <span>${esc(tr('collections.createBtn', 'New Collection'))}</span>
                        </button>
                    </div>
                </div>
            `;

            const foldersHtml = allFoldersList.map(folder => {
                const folderArticles = articlesByCol.get(folder.key) || [];
                const isExpanded = expanded.has(folder.key);

                const formatCounts = {};
                folderArticles.forEach(a => {
                    const ext = (U().fileExt(a.fileName) || 'doc').toUpperCase();
                    formatCounts[ext] = (formatCounts[ext] || 0) + 1;
                });
                const formatBreakdown = Object.keys(formatCounts).map(k => `${formatCounts[k]} ${k}`).join(' • ');
                const keyAttr = esc(folder.key);
                const folderSafeName = esc(folder.name);
                const folderDocWord = folderArticles.length === 1 ? tr('common.document', 'document') : tr('common.documents', 'documents');
                const expandLabel = esc(isExpanded ? tr('folders.reduce', 'Reduce') : tr('folders.expand', 'Expand'));

                return `
                    <div class="bg-paper border border-wood rounded-2xl overflow-hidden shadow-2xs transition-all ${isExpanded ? 'border-wood/80 ring-1 ring-jungle/15' : 'hover:border-leaf/50'}">
                        <div class="px-5 py-3.5 bg-clay/35 hover:bg-clay/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                             data-action="toggle-folder-expand" data-folder-name="${keyAttr}" role="button" tabindex="0" aria-expanded="${isExpanded}">
                            <div class="flex items-center gap-3 min-w-0">
                                <span class="w-7 h-7 rounded-lg bg-sand border border-wood/70 flex items-center justify-center text-soil shrink-0" aria-hidden="true">
                                    <i class="ph-bold ${isExpanded ? 'ph-caret-down' : 'ph-caret-right'} text-xs text-earth"></i>
                                </span>
                                <div class="w-9 h-9 rounded-xl ${folder.isUnfiled ? 'bg-wood/50 text-earth' : 'bg-jungle/15 text-canopy border border-jungle/20'} flex items-center justify-center shrink-0 shadow-2xs">
                                    <i class="ph ${folder.isUnfiled ? 'ph-tray' : isExpanded ? 'ph-folder-open' : 'ph-folder'} text-lg" aria-hidden="true"></i>
                                </div>
                                <div class="min-w-0">
                                    <div class="flex items-center gap-2">
                                        <h3 class="font-serif font-bold text-soil text-base tracking-tight truncate">${folderSafeName}</h3>
                                        <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-wood/50 text-soil shrink-0 font-mono">${folderArticles.length} ${esc(folderDocWord)}</span>
                                    </div>
                                    <p class="text-[11px] text-earth/70 mt-0.5 truncate">${esc(formatBreakdown || tr('folders.noFiles', 'No files recorded yet'))}</p>
                                </div>
                            </div>

                            <div class="flex items-center gap-2 shrink-0 self-end sm:self-center" data-action="noop">
                                ${!folder.isUnfiled ? `
                                    <button type="button" data-action="add-folder-doc" data-folder-name="${keyAttr}"
                                            class="px-2.5 py-1.5 bg-sand hover:bg-wood/40 border border-wood rounded-lg text-xs font-semibold text-soil transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                            title="${esc(tr('folders.addDocTitle', 'Add document to this collection'))}">
                                        <i class="ph-bold ph-plus text-jungle text-xs" aria-hidden="true"></i>
                                        <span class="hidden md:inline">${esc(tr('folders.addDoc', 'Add Document'))}</span>
                                    </button>
                                ` : ''}
                                <button type="button" data-action="select-folder" data-folder-name="${keyAttr}"
                                        class="px-2.5 py-1.5 bg-sand hover:bg-wood/40 border border-wood rounded-lg text-xs font-semibold text-earth hover:text-soil transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                                        title="${esc(tr('folders.filterTitle', 'Filter library by this collection'))}">
                                    <i class="ph ph-funnel text-xs" aria-hidden="true"></i>
                                    <span class="hidden md:inline">${esc(tr('folders.filter', 'Filter'))}</span>
                                </button>
                                ${!folder.isUnfiled ? `
                                    <button type="button" data-action="delete-folder" data-folder-id="${esc(folder.id)}" data-folder-name="${keyAttr}"
                                            class="p-1.5 text-earth/60 hover:text-terracotta hover:bg-wood/40 rounded-lg transition-colors cursor-pointer"
                                            title="${esc(tr('folders.deleteTitle', 'Delete Collection'))}" aria-label="${esc(tr('folders.deleteTitle', 'Delete Collection'))}">
                                        <i class="ph ph-trash text-sm" aria-hidden="true"></i>
                                    </button>
                                ` : ''}
                                <button type="button" data-action="toggle-folder-expand" data-folder-name="${keyAttr}"
                                        class="px-2.5 py-1.5 bg-sand hover:bg-wood/40 border border-wood rounded-lg text-xs font-semibold text-soil transition-colors flex items-center gap-1 cursor-pointer">
                                    <span>${expandLabel}</span>
                                    <i class="ph ${isExpanded ? 'ph-caret-up text-xs' : 'ph-caret-down text-xs'}" aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>

                        ${isExpanded ? `
                            <div class="p-4 border-t border-wood/40 bg-sand/30">
                                ${folderArticles.length === 0 ? `
                                    <div class="text-center py-6 px-4 border border-dashed border-wood/70 rounded-xl bg-white/50">
                                        <p class="text-xs text-earth font-medium">${esc(tr('folders.emptyFolderNotice', 'Nenhum documento nesta pasta.'))}</p>
                                        ${!folder.isUnfiled ? `
                                            <button type="button" data-action="add-folder-doc" data-folder-name="${keyAttr}"
                                                    class="mt-2 text-xs text-jungle font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer">
                                                <i class="ph-bold ph-plus" aria-hidden="true"></i> ${esc(tr('folders.addDocsNow', 'Add documents now'))}
                                            </button>
                                        ` : ''}
                                    </div>
                                ` : `
                                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        ${folderArticles.slice(0, PAGE_SIZE).map(a => this.createFolderDocTileHtml(a)).join('')}
                                    </div>
                                    ${folderArticles.length > PAGE_SIZE ? `<p class="text-[11px] text-earth mt-2 text-center">${esc(tr('folders.moreInFilter', '+{count} documentos — use "Filtrar" para ver todos.', { count: folderArticles.length - PAGE_SIZE }))}</p>` : ''}
                                `}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');

            container.innerHTML = toolbarHtml + foldersHtml;
        },

        createFolderDocTileHtml(article) {
            const statusClass = this.getStatusBadgeClass(article.status);
            const statusLabel = this.getStatusLabel(article.status);
            const favLabel = esc(article.isFavorite ? tr('inspector.favoriteRemove', 'Remover dos favoritos') : tr('inspector.favoriteAdd', 'Adicionar aos favoritos'));

            return `
                <div class="bg-paper border border-wood/80 hover:border-jungle rounded-xl p-3.5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                     data-action="inspect-article" data-article-id="${Number(article.id)}" role="button" tabindex="0" aria-label="${esc(article.title)}">
                    <div>
                        <div class="flex items-center justify-between mb-1.5">
                            <div class="flex items-center gap-1.5">
                                <i class="ph ${fileTypeIcon(article)} text-base" aria-hidden="true"></i>
                                <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${statusClass}">${esc(statusLabel)}</span>
                            </div>
                            <button type="button" data-action="toggle-favorite" data-article-id="${Number(article.id)}"
                                    class="p-1 text-wood hover:text-yellow-500 transition-colors cursor-pointer ${article.isFavorite ? 'text-yellow-500' : ''}"
                                    title="${favLabel}" aria-label="${favLabel}" aria-pressed="${!!article.isFavorite}">
                                <i class="${article.isFavorite ? 'ph-fill' : 'ph'} ph-star text-sm" aria-hidden="true"></i>
                            </button>
                        </div>
                        <h4 class="font-serif font-bold text-xs text-soil group-hover:text-jungle transition-colors line-clamp-2 mb-1 leading-snug">${esc(article.title)}</h4>
                        <p class="text-[11px] text-earth/80 truncate mb-2">${disp(article.authors, tr('common.unknownAuthor', 'Autor desconhecido'))} • ${disp(article.year, 'N/A')}</p>
                    </div>
                    <div class="pt-2 border-t border-wood/40 flex items-center justify-between text-[10px] text-earth/70 mt-2">
                        <span class="font-mono truncate max-w-[120px]">${disp(article.fileSize, tr('common.noFile', 'Sem arquivo'))}</span>
                        <button type="button" data-action="read-article" data-article-id="${Number(article.id)}"
                                class="px-2 py-0.5 rounded bg-jungle/10 hover:bg-jungle text-canopy hover:text-white font-bold transition-colors flex items-center gap-1 cursor-pointer">
                            <i class="ph ph-book-open" aria-hidden="true"></i> ${esc(tr('common.read', 'READ'))}
                        </button>
                    </div>
                </div>
            `;
        },

        toggleFolderExpand(folderKey) {
            const state = window.Lexicon.State;
            state.expandedFolders = Array.isArray(state.expandedFolders) ? state.expandedFolders : [];
            const idx = state.expandedFolders.indexOf(folderKey);
            if (idx >= 0) state.expandedFolders.splice(idx, 1);
            else state.expandedFolders.push(folderKey);
            this.render();
        },

        toggleAllFolders(expand) {
            const state = window.Lexicon.State;
            state.expandedFolders = expand ? state.collections.map(c => c.name).concat([UNFILED_KEY]) : [];
            this.render();
        },

        openAddModalForCollection(colName) {
            L().UI.Modal.open('upload-modal');
            L().Collections.fillSelect(document.getElementById('form-collection'), colName);
            L().Collections.fillSelect(document.getElementById('import-opt-default-collection'), colName);
        },

        /**
         * Render High-Density Table View
         */
        renderTable(articles, allFiltered) {
            const state = window.Lexicon.State;
            const selected = new Set(state.selectedIds || []);
            const pool = allFiltered || articles;
            const allSelected = pool.length > 0 && pool.every(a => selected.has(a.id));

            return `
                <div class="bg-paper border border-wood rounded-xl overflow-hidden shadow-sm">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-sm text-soil border-collapse">
                            <thead>
                                <tr class="border-b border-wood bg-clay/50 text-xs font-semibold text-earth uppercase tracking-wider">
                                    <th class="py-3 px-3 w-10 text-center" scope="col">
                                        <input type="checkbox" id="table-select-all" data-action="toggle-select-all"
                                               class="w-4 h-4 rounded text-jungle focus:ring-jungle border-wood cursor-pointer"
                                               aria-label="${esc(tr('table.selectAll', 'Selecionar todos'))}"
                                               ${allSelected ? 'checked' : ''}>
                                    </th>
                                    <th class="py-3 px-3 w-28" scope="col">${esc(tr('table.colStatus', 'Status'))}</th>
                                    <th class="py-3 px-4" scope="col">${esc(tr('table.colTitle', 'Title & Details'))}</th>
                                    <th class="py-3 px-4 w-40" scope="col">${esc(tr('table.colCollection', 'Collection'))}</th>
                                    <th class="py-3 px-4 w-44" scope="col">${esc(tr('table.colFile', 'Arquivo'))}</th>
                                    <th class="py-3 px-4 w-40" scope="col">${esc(tr('table.colTags', 'Tags'))}</th>
                                    <th class="py-3 px-4 text-right w-28" scope="col">${esc(tr('table.colActions', 'Action'))}</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-wood/50">
                                ${articles.map(a => this.createTableRowHtml(a, selected)).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        },

        _tagsHtml(article, max, extraClass = '') {
            return (article.tags || []).slice(0, max).map(tag =>
                `<span data-action="filter-tag" data-tag-name="${esc(tag)}" role="button" tabindex="0"
                       class="tag-chip cursor-pointer ${extraClass}" title="${esc(tr('search.filterByTag', 'Filtrar por #{tag}', { tag }))}">#${esc(tag)}</span>`
            ).join('');
        },

        createCardHtml(article) {
            const state = window.Lexicon.State;
            const isSelected = (state.selectedIds || []).includes(article.id);
            const statusClass = this.getStatusBadgeClass(article.status);
            const statusLabel = this.getStatusLabel(article.status);
            const favTitle = esc(article.isFavorite ? tr('inspector.favoriteRemove', 'Remover dos favoritos') : tr('inspector.favoriteAdd', 'Adicionar aos favoritos'));
            const unfiledLabel = tr('folders.unfiled', 'Sem coleção');
            const id = Number(article.id);

            return `
                <div class="glass-card rounded-xl p-5 flex flex-col h-80 group relative overflow-hidden cursor-pointer ${isSelected ? 'card-selected' : ''}"
                     data-action="inspect-article" data-article-id="${id}" role="button" tabindex="0" aria-label="${esc(article.title)}">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex items-center gap-2">
                            <input type="checkbox"
                                   class="card-checkbox w-4 h-4 rounded text-jungle focus:ring-jungle border-wood cursor-pointer"
                                   ${isSelected ? 'checked' : ''} aria-label="${esc(tr('batch.selectDoc', 'Selecionar documento'))}"
                                   data-action="toggle-select" data-article-id="${id}">
                            <div class="w-8 h-8 rounded-lg bg-sand border border-wood flex items-center justify-center shrink-0">
                                <i class="ph ${fileTypeIcon(article)} text-base" aria-hidden="true"></i>
                            </div>
                            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${statusClass}">${esc(statusLabel)}</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <button type="button" data-action="toggle-favorite" data-article-id="${id}"
                                    class="p-1.5 rounded-md hover:bg-wood/50 transition-colors cursor-pointer ${article.isFavorite ? 'text-yellow-500' : 'text-wood hover:text-yellow-500'}"
                                    title="${favTitle}" aria-label="${favTitle}" aria-pressed="${!!article.isFavorite}">
                                <i class="${article.isFavorite ? 'ph-fill' : 'ph'} ph-star text-lg" aria-hidden="true"></i>
                            </button>
                        </div>
                    </div>

                    <div class="flex-1 min-h-0">
                        <h3 class="font-serif font-bold text-soil leading-snug mb-1 line-clamp-2 text-base group-hover:text-jungle transition-colors">${esc(article.title)}</h3>
                        <p class="text-xs text-earth mb-2 font-medium truncate">${disp(article.authors, tr('common.unknownAuthor', 'Autor desconhecido'))} • ${disp(article.year, 'N/A')}</p>
                        <p class="text-xs text-earth/80 line-clamp-3 leading-relaxed mb-3 font-normal">${disp(article.summary, tr('common.cardNoSummary', 'Clique para ver resumo, metadados e abrir o documento.'))}</p>
                    </div>

                    <div class="pt-2 border-t border-wood/40 flex flex-col gap-2 mt-auto">
                        <div class="flex items-center justify-between text-[11px] text-earth/70">
                            <span class="truncate flex items-center gap-1">
                                <i class="ph ph-folder text-xs" aria-hidden="true"></i>
                                <span>${disp(article.collection, unfiledLabel)}</span>
                            </span>
                            <span class="font-mono text-[10px] shrink-0 text-earth/60">${disp(article.fileSize, tr('common.noFile', 'Sem arquivo'))}</span>
                        </div>
                        <div class="flex flex-wrap gap-1 items-center overflow-hidden h-6">${this._tagsHtml(article, 3)}</div>
                    </div>

                    <div class="absolute bottom-0 left-0 w-full h-1 bg-jungle transform translate-y-1 group-hover:translate-y-0 transition-transform" aria-hidden="true"></div>
                </div>
            `;
        },

        createTableRowHtml(article, selectedSet) {
            const isSelected = selectedSet ? selectedSet.has(article.id) : (window.Lexicon.State.selectedIds || []).includes(article.id);
            const statusClass = this.getStatusBadgeClass(article.status);
            const statusLabel = this.getStatusLabel(article.status);
            const id = Number(article.id);
            const favTitle = esc(article.isFavorite ? tr('inspector.favoriteRemove', 'Remover dos favoritos') : tr('inspector.favoriteAdd', 'Adicionar aos favoritos'));

            return `
                <tr class="hover:bg-sand/60 transition-colors cursor-pointer group ${isSelected ? 'bg-jungle/10 font-medium' : ''}"
                    data-action="inspect-article" data-article-id="${id}" tabindex="0" aria-label="${esc(article.title)}">
                    <td class="py-3 px-3 text-center">
                        <input type="checkbox" class="w-4 h-4 rounded text-jungle focus:ring-jungle border-wood cursor-pointer"
                               ${isSelected ? 'checked' : ''} aria-label="${esc(tr('batch.selectDoc', 'Selecionar documento'))}"
                               data-action="toggle-select" data-article-id="${id}">
                    </td>
                    <td class="py-3 px-3">
                        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${statusClass}">${esc(statusLabel)}</span>
                    </td>
                    <td class="py-3 px-4 min-w-0">
                        <div class="flex items-center gap-3">
                            <i class="ph ${fileTypeIcon(article)} text-lg shrink-0" aria-hidden="true"></i>
                            <div class="truncate">
                                <div class="font-serif font-semibold text-soil truncate group-hover:text-jungle transition-colors">${esc(article.title)}</div>
                                <div class="text-xs text-earth/70 truncate">${disp(article.authors, tr('common.unknownAuthor', 'Autor desconhecido'))} (${disp(article.year, 'N/A')})</div>
                            </div>
                        </div>
                    </td>
                    <td class="py-3 px-4 text-xs text-earth">${disp(article.collection, '—')}</td>
                    <td class="py-3 px-4 text-xs font-mono text-earth/80 truncate max-w-[180px]" title="${esc(article.filePath || article.fileName || '')}">${disp(article.fileName, '—')}</td>
                    <td class="py-3 px-4"><div class="flex flex-wrap gap-1">${this._tagsHtml(article, 2, 'text-[10px]')}</div></td>
                    <td class="py-3 px-4 text-right">
                        <div class="flex items-center justify-end gap-1">
                            <button type="button" data-action="toggle-favorite" data-article-id="${id}"
                                    class="p-1 rounded hover:bg-wood/50 transition-colors cursor-pointer ${article.isFavorite ? 'text-yellow-500' : 'text-wood hover:text-yellow-500'}"
                                    title="${favTitle}" aria-label="${favTitle}" aria-pressed="${!!article.isFavorite}">
                                <i class="${article.isFavorite ? 'ph-fill' : 'ph'} ph-star text-base" aria-hidden="true"></i>
                            </button>
                            <button type="button" data-action="read-article" data-article-id="${id}"
                                    class="px-2 py-1 bg-jungle/10 hover:bg-jungle text-jungle hover:text-white rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                    title="${esc(tr('inspector.readTooltip', 'Abrir no leitor'))}">
                                <i class="ph ph-book-open" aria-hidden="true"></i> ${esc(tr('common.read', 'Read'))}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        },

        getStatusBadgeClass(status) {
            switch (status) {
                case 'reading': return 'badge-status-reading';
                case 'processing': return 'badge-status-processing';
                case 'archived': return 'badge-status-archived';
                default: return 'badge-status-inbox';
            }
        },

        getStatusLabel(status) {
            switch (status) {
                case 'reading': return tr('nav.reading', 'Reading');
                case 'processing': return tr('nav.processing', 'Fichamento');
                case 'archived': return tr('nav.archived', 'Archived');
                default: return tr('nav.inbox', 'Inbox');
            }
        },

        /* ------------------------------------------------------------------
           Filters
           ------------------------------------------------------------------ */
        _resetSearchUI() {
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.value = '';
        },

        filterByTag(tag) {
            if (L().Navigation) L().Navigation.recordNavigation();
            const state = window.Lexicon.State;
            state.activeTag = tag;
            state.searchQuery = '';
            state.semanticFilter = null;
            state.selectedIds = [];
            // A tag filter applies to the whole library unless we're inside a collection
            if (state.currentFilter.type === 'category' && ['stats', 'collections'].includes(state.currentFilter.value)) {
                state.currentFilter = { type: 'category', value: 'all', title: tr('nav.all', 'All Documents') };
            }
            this._resetSearchUI();
            L().Collections.render();
            this.render();
        },

        clearTagFilter() {
            if (L().Navigation) L().Navigation.recordNavigation();
            window.Lexicon.State.activeTag = null;
            this.render();
        },

        filterByCollection(name) {
            if (!name) {
                this.filterUnfiled();
                return;
            }
            L().Collections.select(name);
        },

        /** Show documents that are not in any (existing) collection */
        filterUnfiled() {
            if (L().Navigation) L().Navigation.recordNavigation();
            const state = window.Lexicon.State;
            state.currentFilter = { type: 'unfiled', value: UNFILED_KEY, title: tr('folders.unfiled', 'Sem coleção') };
            state.activeTag = null;
            state.searchQuery = '';
            state.semanticFilter = null;
            state.selectedIds = [];
            this._resetSearchUI();
            L().Collections.render();
            this.render();
        },

        setCategoryFilter(filterValue) {
            if (L().Navigation) L().Navigation.recordNavigation();
            const state = window.Lexicon.State;
            state.currentFilter = {
                type: 'category',
                value: filterValue,
                title: tr(`nav.${filterValue}`, filterValue)
            };
            state.activeTag = null;
            state.searchQuery = '';
            state.semanticFilter = null;
            state.selectedIds = [];
            this._resetSearchUI();
            L().Collections.render();
            this.render();
            if (L().Navigation) L().Navigation.updateActiveSidebarLink();
        },

        /* ------------------------------------------------------------------
           Multiple Selection & Batch Operations
           ------------------------------------------------------------------ */
        _selectedSet() {
            return new Set(window.Lexicon.State.selectedIds || []);
        },

        toggleSelect(id) {
            const state = window.Lexicon.State;
            state.selectedIds = state.selectedIds || [];
            const idx = state.selectedIds.indexOf(id);
            if (idx >= 0) state.selectedIds.splice(idx, 1);
            else state.selectedIds.push(id);
            this.render({ keepLimit: true });
        },

        toggleSelectAll(checked) {
            const state = window.Lexicon.State;
            state.selectedIds = checked ? this.getFilteredArticles().map(a => a.id) : [];
            this.render({ keepLimit: true });
        },

        clearSelection() {
            window.Lexicon.State.selectedIds = [];
            this.render({ keepLimit: true });
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
                bar.removeAttribute('aria-hidden');
                if (countEl) countEl.textContent = `${n} ${tr('batch.selected', 'selected')}`;
                if (colSelect) {
                    colSelect.innerHTML = L().Collections.optionsHtml({
                        noneValue: 'none',
                        noneLabel: tr('batch.noneCollection', '(Nenhuma / Geral)'),
                        extra: `<option value="">${esc(tr('batch.moveToCollection', 'Mover para coleção...'))}</option>` +
                               `<option value="__NEW__">${esc(tr('batch.createNewCollection', '+ Criar nova coleção...'))}</option>`
                    });
                    colSelect.value = '';
                }
            } else {
                bar.classList.add('hidden-bar');
                bar.setAttribute('aria-hidden', 'true');
            }
        },

        batchChangeStatus(status) {
            const select = document.getElementById('batch-status-select');
            if (select) select.value = '';
            if (!VALID_STATUS.includes(status)) return;
            const state = window.Lexicon.State;
            const selected = this._selectedSet();
            const count = selected.size;
            state.articles.forEach(a => { if (selected.has(a.id)) a.status = status; });
            L().Storage.save();
            L().Collections.render();
            this.render({ keepLimit: true });
            toast(status === 'archived'
                ? tr('batch.batchMarkedRead', 'Marked {count} documents as read', { count })
                : tr('batch.batchStatusUpdated', 'Status atualizado em {count} documentos', { count }), 'success');
        },

        batchSetCollection(colName) {
            const select = document.getElementById('batch-collection-select');
            if (select) select.value = '';
            if (!colName) return;
            if (colName === '__NEW__') {
                this.batchCreateCollectionPrompt();
                return;
            }

            const state = window.Lexicon.State;
            const selected = this._selectedSet();
            const count = selected.size;
            const targetCol = colName === 'none' ? null : colName;
            state.articles.forEach(a => { if (selected.has(a.id)) a.collection = targetCol; });
            L().Storage.save();
            L().Collections.render();
            this.render({ keepLimit: true });
            const colDisplay = targetCol || tr('folders.unfiled', 'General');
            toast(tr('batch.batchMoved', 'Moved {count} documents to {name}', { count, name: colDisplay }), 'success');
        },

        batchCreateCollectionPrompt() {
            const n = (window.Lexicon.State.selectedIds || []).length;
            if (n === 0) {
                toast(tr('batch.selectFirst', 'Selecione pelo menos um documento primeiro'), 'warning');
                return;
            }
            const subtitle = document.getElementById('batch-collection-modal-subtitle');
            if (subtitle) subtitle.textContent = tr('batch.modalSubtitle', 'Create a new collection and move {count} selected documents into it.', { count: n });
            const input = document.getElementById('batch-new-collection-name');
            if (input) input.value = '';
            L().UI.Modal.open('batch-collection-modal', { focus: '#batch-new-collection-name' });
        },

        submitBatchCreateCollection() {
            const input = document.getElementById('batch-new-collection-name');
            if (!input) return;
            const name = input.value.trim();
            if (!name) {
                toast(tr('collections.nameRequired', 'Please enter a collection name'), 'error');
                return;
            }
            const state = window.Lexicon.State;
            const selected = this._selectedSet();
            const count = selected.size;
            if (count === 0) {
                L().UI.Modal.close('batch-collection-modal');
                return;
            }
            const col = L().Collections.getOrCreate(name, { silent: true });
            state.articles.forEach(a => { if (selected.has(a.id)) a.collection = col.name; });
            L().Storage.save();
            L().Collections.render();
            L().Collections.populateSelects();
            this.render({ keepLimit: true });
            L().UI.Modal.close('batch-collection-modal');
            toast(tr('batch.batchMoved', 'Moved {count} documents to {name}', { count, name: col.name }), 'success');
        },

        batchAddTag() {
            const state = window.Lexicon.State;
            if (!state.selectedIds || !state.selectedIds.length) return;
            const tag = window.prompt(tr('batch.tagPrompt', 'Tag a adicionar aos documentos selecionados:'));
            if (!tag || !tag.trim()) return;
            const cleanTag = tag.trim().replace(/^#+/, '').slice(0, 40);
            if (!cleanTag) return;

            const selected = this._selectedSet();
            let updated = 0;
            state.articles.forEach(a => {
                if (!selected.has(a.id)) return;
                a.tags = a.tags || [];
                if (!a.tags.some(t => String(t).toLowerCase() === cleanTag.toLowerCase())) {
                    a.tags.push(cleanTag);
                    updated++;
                }
            });
            L().Storage.save();
            this.render({ keepLimit: true });
            toast(tr('batch.batchTagAdded', 'Added tag #{tag} to {count} documents', { tag: cleanTag, count: updated }), 'success');
        },

        batchToggleFavorite(fav) {
            const state = window.Lexicon.State;
            const selected = this._selectedSet();
            state.articles.forEach(a => { if (selected.has(a.id)) a.isFavorite = !!fav; });
            L().Storage.save();
            this.render({ keepLimit: true });
            toast(tr('batch.batchFavoritesUpdated', 'Updated favorites for {count} documents', { count: selected.size }), 'success');
        },

        async batchDelete() {
            const state = window.Lexicon.State;
            const selected = this._selectedSet();
            const count = selected.size;
            if (!count) return;

            if (!confirm(tr('batch.confirmBatchDelete', 'Are you sure you want to delete {count} selected documents from your library?', { count }))) {
                return;
            }

            if (L().Reader && L().Reader.isOpen() && selected.has(L().Reader.getCurrentArticleId())) L().Reader.close();
            if (selected.has(state.inspectedArticleId)) {
                this._skipDirtyCheck = true;
                L().UI.Modal.close('inspector-modal');
                state.inspectedArticleId = null;
            }

            await L().Storage.deleteFiles(Array.from(selected));
            state.articles = state.articles.filter(a => !selected.has(a.id));
            state.selectedIds = [];
            await L().Storage.save();
            L().Collections.render();
            this.render();
            toast(tr('batch.batchDeleted', 'Deleted {count} documents', { count }), 'info');
        },

        batchExportNotes() {
            const state = window.Lexicon.State;
            const selected = this._selectedSet();
            const selectedArticles = state.articles.filter(a => selected.has(a.id));
            if (!selectedArticles.length) return;

            const pt = !L().I18n || L().I18n.locale !== 'en-US';
            const H = pt
                ? { title: 'Síntese Consolidada de Pesquisa & Fichamentos', exported: 'Exportado', total: 'Total de documentos', authors: 'Autores', status: 'Status', collection: 'Coleção', summary: 'Resumo', unknown: 'Desconhecido', general: 'Geral' }
                : { title: 'Consolidated Research Synthesis & Notes', exported: 'Exported', total: 'Total Documents', authors: 'Authors', status: 'Status', collection: 'Collection', summary: 'Summary', unknown: 'Unknown', general: 'General' };
            const notesHeading = tr('inspector.notesTitle', 'Fichamento');

            let md = `# ${H.title}\n${H.exported}: ${new Date().toLocaleDateString(pt ? 'pt-BR' : 'en-US')}\n${H.total}: ${selectedArticles.length}\n\n---\n\n`;
            selectedArticles.forEach(a => {
                md += `## ${a.title}\n`;
                md += `**${H.authors}:** ${a.authors || H.unknown} (${a.year || 'N/A'}) | **${H.status}:** ${this.getStatusLabel(a.status)} | **${H.collection}:** ${a.collection || H.general}\n\n`;
                if (a.summary) md += `### ${H.summary}\n${a.summary}\n\n`;
                if (a.notes) md += `### ${notesHeading}\n${a.notes}\n\n`;
                md += `---\n\n`;
            });

            this._downloadText(md, `Batch_Research_Notes_${U().localDateStr()}.md`, 'text/markdown;charset=utf-8');
            toast(tr('batch.notesExported', 'Notas de {count} documentos exportadas', { count: selectedArticles.length }), 'success');
        },

        _downloadText(content, filename, type) {
            const blob = new Blob([content], { type });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1500);
        },

        toggleFavorite(id) {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === Number(id));
            if (!article) return;

            article.isFavorite = !article.isFavorite;
            L().Storage.save();
            this.render({ keepLimit: true });
            if (state.inspectedArticleId === article.id) this.updateInspectorStar(article.isFavorite);
            toast(article.isFavorite ? tr('inspector.starAdded', 'Added to favorites') : tr('inspector.starRemoved', 'Removed from favorites'), 'info');
        },

        updateInspectorStar(isFavorite) {
            const starBtn = document.getElementById('inspector-star-btn');
            if (starBtn) {
                starBtn.className = `p-2 rounded-xl transition-colors cursor-pointer ${isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-earth hover:text-soil'}`;
                starBtn.setAttribute('aria-pressed', String(!!isFavorite));
                starBtn.innerHTML = `<i class="${isFavorite ? 'ph-fill' : 'ph'} ph-star text-xl" aria-hidden="true"></i>`;
            }
        },

        /* ------------------------------------------------------------------
           Inspector
           ------------------------------------------------------------------ */
        _inspectorFieldValues() {
            const v = (id) => {
                const el = document.getElementById(id);
                return el ? el.value : null;
            };
            return {
                title: (v('inspector-title') || '').trim(),
                authors: (v('inspector-author') || '').trim(),
                year: (v('inspector-year') || '').trim(),
                publication: (v('inspector-publication') || '').trim(),
                doi: (v('inspector-doi') || '').trim(),
                status: v('inspector-status') || '',
                collection: v('inspector-collection') || '',
                summary: (v('inspector-summary') || '').trim()
            };
        },

        _articleFieldValues(article) {
            return {
                title: (article.title || '').trim(),
                authors: (article.authors || '').trim(),
                year: article.year ? String(article.year) : '',
                publication: (article.publication || '').trim(),
                doi: (article.doi || '').trim(),
                status: article.status || 'inbox',
                collection: article.collection || '',
                summary: (article.summary || '').trim()
            };
        },

        isInspectorDirty() {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article || !L().UI.Modal.isOpen('inspector-modal')) return false;
            return JSON.stringify(this._inspectorFieldValues()) !== JSON.stringify(this._articleFieldValues(article));
        },

        _setDoiLink(doi) {
            const doiLinkEl = document.getElementById('inspector-doi-link');
            if (!doiLinkEl) return;
            const href = U().doiHref(doi);
            if (href) {
                doiLinkEl.href = href;
                doiLinkEl.rel = 'noopener noreferrer';
                doiLinkEl.classList.remove('hidden');
            } else {
                doiLinkEl.removeAttribute('href');
                doiLinkEl.classList.add('hidden');
            }
        },

        /**
         * Open Document Overview & Inspector Modal
         */
        inspect(id) {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === Number(id));
            if (!article) return;

            // Switching from another open document: keep its pending notes
            this.flushNotesSave();
            if (L().UI.Modal.isOpen('inspector-modal') && state.inspectedArticleId !== article.id && this.isInspectorDirty()) {
                if (window.confirm(tr('inspector.confirmSaveOnClose', 'Salvar as alterações feitas neste documento antes de fechar?\n\nOK = salvar • Cancelar = descartar'))) {
                    this.saveInspected({ silent: true });
                }
            }

            state.inspectedArticleId = article.id;

            const set = (elId, value) => {
                const el = document.getElementById(elId);
                if (el) el.value = value;
            };
            set('inspector-title', article.title || '');
            set('inspector-author', article.authors || '');
            set('inspector-year', article.year || '');
            set('inspector-publication', article.publication || '');
            set('inspector-doi', article.doi || '');
            set('inspector-status', VALID_STATUS.includes(article.status) ? article.status : 'inbox');
            set('inspector-summary', article.summary || '');
            set('inspector-notes', article.notes || '');
            this._setDoiLink(article.doi);

            const headerTitle = document.getElementById('inspector-modal-header-title');
            if (headerTitle) {
                headerTitle.textContent = article.title || '';
                headerTitle.title = article.title || '';
            }

            if (L().Academic && typeof L().Academic.closeCiteMenu === 'function') L().Academic.closeCiteMenu();

            L().Collections.fillSelect(document.getElementById('inspector-collection'), article.collection || '');

            const fileNameEl = document.getElementById('inspector-file-name');
            const filePathEl = document.getElementById('inspector-file-path');
            const fileSizeEl = document.getElementById('inspector-file-size');
            const fileIconEl = document.getElementById('inspector-file-icon');
            if (fileNameEl) fileNameEl.textContent = article.fileName || tr('inspector.noFileAttached', 'Nenhum arquivo anexado');
            if (filePathEl) filePathEl.textContent = article.filePath || '';
            if (fileSizeEl) {
                fileSizeEl.textContent = article.fileSize || '';
                fileSizeEl.classList.toggle('hidden', !article.fileSize);
            }
            if (fileIconEl) fileIconEl.className = `ph ${fileTypeIcon(article)} text-2xl`;
            this._refreshFileStatus(article);

            const indicatorEl = document.getElementById('notes-save-indicator');
            if (indicatorEl) indicatorEl.textContent = tr('inspector.autoSaved', 'Salvo automaticamente');

            this.updateInspectorStar(article.isFavorite);
            this.renderInspectorTags(article.tags || []);

            const notesEl = document.getElementById('inspector-notes');
            if (L().Zettelkasten) {
                if (notesEl) L().Zettelkasten.attach(notesEl);
                const backlinksContainer = document.getElementById('inspector-backlinks-container');
                if (backlinksContainer) L().Zettelkasten.renderBacklinks(article, backlinksContainer);
            }

            L().UI.Modal.open('inspector-modal', { focus: '#inspector-title' });
        },

        /** Show whether a binary file is really stored for this article */
        async _refreshFileStatus(article) {
            const filePathEl = document.getElementById('inspector-file-path');
            if (!filePathEl) return;
            const has = await L().Storage.hasFile(article.id);
            if (window.Lexicon.State.inspectedArticleId !== article.id) return;
            const pathText = article.filePath ? ` — ${article.filePath}` : '';
            filePathEl.textContent = has
                ? `${tr('inspector.fileStored', 'Armazenado neste navegador')}${pathText}`
                : `${tr('inspector.fileMissing', 'Arquivo não armazenado — use "Vincular arquivo"')}${pathText}`;
            filePathEl.classList.toggle('text-terracotta', !has);
        },

        renderInspectorTags(tags) {
            const listEl = document.getElementById('inspector-tags-list');
            if (!listEl) return;
            const removeLabel = esc(tr('inspector.removeTag', 'Remover tag'));
            listEl.innerHTML = (tags || []).map(tag => `
                <span class="tag-chip inline-flex items-center gap-1.5 py-1 px-2.5 bg-clay/70 border border-wood rounded-lg text-xs font-medium">
                    #${esc(tag)}
                    <button type="button" data-action="remove-inspected-tag" data-tag-name="${esc(tag)}"
                            class="hover:text-terracotta transition-colors text-earth cursor-pointer" title="${removeLabel}" aria-label="${removeLabel} ${esc(tag)}">
                        <i class="ph ph-x text-xs" aria-hidden="true"></i>
                    </button>
                </span>
            `).join('');
        },

        addTagToInspected() {
            const input = document.getElementById('inspector-new-tag');
            if (!input || !input.value.trim()) return;
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article) return;

            const newTags = input.value.split(',').map(t => t.trim().replace(/^#+/, '').slice(0, 40)).filter(Boolean);
            article.tags = article.tags || [];
            let changed = false;
            newTags.forEach(tag => {
                if (!article.tags.some(t => String(t).toLowerCase() === tag.toLowerCase())) {
                    article.tags.push(tag);
                    changed = true;
                }
            });
            if (changed) {
                this.renderInspectorTags(article.tags);
                L().Storage.save();
                this.render({ keepLimit: true });
            }
            input.value = '';
        },

        removeTagFromInspected(tag) {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article || !article.tags) return;
            article.tags = article.tags.filter(t => t !== tag);
            this.renderInspectorTags(article.tags);
            L().Storage.save();
            this.render({ keepLimit: true });
        },

        /**
         * Save edits made inside the Inspector modal
         * @param {{silent?: boolean}} [opts]
         */
        saveInspected(opts = {}) {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article) return false;

            const f = this._inspectorFieldValues();
            const oldTitle = article.title;

            if (f.title) article.title = f.title;
            article.authors = f.authors;
            if (f.year) {
                const y = parseInt(f.year, 10);
                if (!Number.isFinite(y) || y < 1000 || y > new Date().getFullYear() + 5) {
                    toast(tr('inspector.invalidYear', 'Ano inválido: {year}', { year: f.year }), 'error');
                    return false;
                }
                article.year = y;
            } else {
                article.year = null;
            }
            article.publication = f.publication;
            article.doi = f.doi;
            this._setDoiLink(article.doi);
            if (VALID_STATUS.includes(f.status)) article.status = f.status;
            article.collection = f.collection || null;
            article.summary = f.summary;
            const notesEl = document.getElementById('inspector-notes');
            if (notesEl) article.notes = notesEl.value;

            let relinked = 0;
            if (oldTitle !== article.title && L().Zettelkasten && L().Zettelkasten.renameTitleReferences) {
                relinked = L().Zettelkasten.renameTitleReferences(oldTitle, article.title, article.id);
            }

            const headerTitle = document.getElementById('inspector-modal-header-title');
            if (headerTitle) headerTitle.textContent = article.title;

            L().Storage.save();
            L().Collections.render();
            this.render({ keepLimit: true });

            if (!opts.silent) {
                toast(tr('inspector.savedToast', 'Detalhes do documento salvos') +
                    (relinked ? ` • ${tr('inspector.linksUpdated', '{count} wikilinks atualizados', { count: relinked })}` : ''), 'success');
            }
            return true;
        },

        /** Save and close (Save button) */
        saveAndCloseInspector() {
            if (this.saveInspected()) {
                this._skipDirtyCheck = true;
                L().UI.Modal.close('inspector-modal');
            }
        },

        /** Discard changes and close (Cancel button) */
        cancelInspector() {
            this._skipDirtyCheck = true;
            L().UI.Modal.close('inspector-modal');
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

            article.notes = notesEl.value; // bound to this article now (not when the timer fires)
            if (indicatorEl) indicatorEl.textContent = tr('inspector.saving', 'Salvando...');

            clearTimeout(this._noteDebounce);
            this._noteDebounce = setTimeout(() => {
                this._noteDebounce = null;
                L().Storage.save().then(ok => {
                    if (indicatorEl) indicatorEl.textContent = ok ? tr('inspector.autoSaved', 'Salvo automaticamente') : tr('inspector.saveFailed', 'Falha ao salvar');
                });
            }, 500);
        },

        flushNotesSave() {
            if (this._noteDebounce) {
                clearTimeout(this._noteDebounce);
                this._noteDebounce = null;
                L().Storage.save();
            }
        },

        /**
         * Shared Markdown formatting helper for note textareas
         * @returns {boolean}
         */
        applyFormatting(textarea, format) {
            if (!textarea) return false;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const selection = text.substring(start, end);
            let replacement = '';
            let cursorOffset = 0;

            switch (format) {
                case 'bold':
                    replacement = `**${selection || tr('format.bold', 'texto em negrito')}**`;
                    cursorOffset = selection ? replacement.length : 2;
                    break;
                case 'italic':
                    replacement = `*${selection || tr('format.italic', 'texto em itálico')}*`;
                    cursorOffset = selection ? replacement.length : 1;
                    break;
                case 'h2':
                    replacement = `\n\n## ${selection || tr('format.heading', 'Título da seção')}\n`;
                    cursorOffset = replacement.length;
                    break;
                case 'quote':
                    replacement = `\n> "${selection || tr('format.quote', 'Citação textual do autor')}"\n`;
                    cursorOffset = replacement.length;
                    break;
                case 'bullet':
                    replacement = `\n- ${selection || tr('format.bullet', 'Ponto importante')}`;
                    cursorOffset = replacement.length;
                    break;
                case 'date':
                    replacement = ` [${U().localDateStr()}] `;
                    cursorOffset = replacement.length;
                    break;
                default:
                    return false;
            }

            textarea.value = text.substring(0, start) + replacement + text.substring(end);
            textarea.focus();
            textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
            return true;
        },

        insertNotesFormatting(format) {
            if (this.applyFormatting(document.getElementById('inspector-notes'), format)) this.autoSaveNotes();
        },

        insertQuickCitation() {
            if (L().Reader) L().Reader.insertQuickCitation();
        },

        exportConsolidatedMarkdown() {
            this.flushNotesSave();
            if (L().Academic && typeof L().Academic.exportConsolidatedMarkdown === 'function') {
                L().Academic.exportConsolidatedMarkdown();
            } else {
                this.exportNotesForInspected();
            }
        },

        /* ------------------------------------------------------------------
           Reading
           ------------------------------------------------------------------ */
        async openDocumentForReading(articleId) {
            const state = window.Lexicon.State;
            const id = Number(articleId || state.inspectedArticleId);
            const article = state.articles.find(a => a.id === id);
            if (!article) return;
            this.flushNotesSave();
            if (L().UI.Modal.isOpen('inspector-modal') && this.isInspectorDirty()) {
                this.saveInspected({ silent: true });
            }
            this._skipDirtyCheck = true;
            if (L().Reader) {
                await L().Reader.open(article.id);
                this._skipDirtyCheck = false;
                return;
            }
            this._skipDirtyCheck = false;
            this.openDocumentInExternalTab(article.id);
        },

        /**
         * Opens the document in a new browser tab (or downloads formats the browser can't show).
         * The tab is opened synchronously so popup blockers don't block it after awaits.
         */
        async openDocumentInExternalTab(articleId) {
            const state = window.Lexicon.State;
            const id = Number(articleId || state.inspectedArticleId);
            const article = state.articles.find(a => a.id === id);
            if (!article) return;

            const ext = U().fileExt(article.fileName);
            const canDisplay = !article.fileName || RENDERABLE_EXTS.includes(ext) || ext === '';
            const win = canDisplay ? window.open('about:blank', '_blank') : null;

            if (article.status === 'inbox') {
                article.status = 'reading';
                const statusEl = document.getElementById('inspector-status');
                if (statusEl && state.inspectedArticleId === article.id) statusEl.value = 'reading';
                L().Storage.save();
                L().Collections.render();
                this.render({ keepLimit: true });
            }

            const storedFile = await L().Storage.getFile(article.id);
            if (storedFile) {
                const fileExt = U().fileExt(storedFile.name || article.fileName);
                const displayable = storedFile.type === 'application/pdf' || RENDERABLE_EXTS.includes(fileExt) || /^text\/|^image\//.test(storedFile.type || '');
                const blob = (fileExt === 'txt' || fileExt === 'md')
                    ? new Blob([await storedFile.text()], { type: 'text/plain;charset=utf-8' })
                    : storedFile;
                const objectUrl = URL.createObjectURL(blob);
                if (displayable && win && fileExt !== 'epub') {
                    win.location.href = objectUrl;
                } else {
                    if (win) win.close();
                    const a = document.createElement('a');
                    a.href = objectUrl;
                    a.download = storedFile.name || article.fileName || 'document';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                }
                setTimeout(() => URL.revokeObjectURL(objectUrl), 60 * 1000);
                return;
            }

            // No binary stored: open a static, script-free summary page
            const notesTitle = tr('inspector.notesTitle', 'Fichamento');
            const href = U().doiHref(article.doi);
            const htmlContent = `<!DOCTYPE html>
<html lang="${esc((L().I18n && L().I18n.locale) || 'pt-BR')}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>${esc(article.title)}</title>
<style>
    body { font-family: Georgia, serif; line-height: 1.8; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #2D251F; background: #FCFAF8; }
    header { border-bottom: 2px solid #D1C7B7; padding-bottom: 20px; margin-bottom: 30px; }
    h1 { font-size: 28px; line-height: 1.3; color: #1B4332; margin-bottom: 8px; }
    .meta { font-family: system-ui, sans-serif; font-size: 14px; color: #4A4036; margin-bottom: 12px; }
    .file-notice { background: #E6DFD3; padding: 12px 16px; border-radius: 8px; font-family: sans-serif; font-size: 13px; margin: 20px 0; }
    .section-title { font-family: system-ui, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold; color: #2D6A4F; margin-top: 30px; margin-bottom: 8px; }
    .summary { font-size: 17px; white-space: pre-wrap; }
    .notes { background: #F4F1EA; border-left: 4px solid #2D6A4F; padding: 15px; border-radius: 0 8px 8px 0; margin-top: 15px; font-family: sans-serif; font-size: 14px; white-space: pre-wrap; }
</style>
</head>
<body>
    <header>
        <h1>${esc(article.title)}</h1>
        <div class="meta"><strong>${esc(tr('reader.authors', 'Autores'))}:</strong> ${disp(article.authors, '—')} | <strong>${esc(tr('reader.year', 'Ano'))}:</strong> ${disp(article.year, 'N/A')} | <strong>${esc(tr('reader.publication', 'Publicação'))}:</strong> ${disp(article.publication, '—')}</div>
        ${article.doi ? `<div class="meta"><strong>DOI / Link:</strong> ${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(article.doi)}</a>` : esc(article.doi)}</div>` : ''}
    </header>
    <div class="file-notice">
        <strong>${esc(tr('reader.fileReference', 'Referência do arquivo'))}:</strong> <code>${disp(article.filePath || article.fileName, tr('inspector.noFileAttached', 'Nenhum arquivo anexado'))}</code>
        <br><small>${esc(tr('reader.attachHint', 'Para ler o arquivo completo, anexe-o com "Vincular arquivo" no inspetor.'))}</small>
    </div>
    <div class="section-title">${esc(tr('reader.abstractTitle', 'Resumo / Abstract'))}</div>
    <div class="summary">${disp(article.summary, tr('reader.noSummaryShort', 'Sem resumo.'))}</div>
    ${article.notes ? `<div class="section-title">${esc(notesTitle)}</div><div class="notes">${esc(article.notes)}</div>` : ''}
</body>
</html>`;
            const tempUrl = URL.createObjectURL(new Blob([htmlContent], { type: 'text/html;charset=utf-8' }));
            if (win) win.location.href = tempUrl;
            else window.open(tempUrl, '_blank', 'noopener');
            setTimeout(() => URL.revokeObjectURL(tempUrl), 60 * 1000);
        },

        /**
         * Prompt user to attach or replace the binary file of the inspected document
         */
        async relinkFileForInspected() {
            const state = window.Lexicon.State;
            const targetId = state.inspectedArticleId;
            if (!state.articles.some(a => a.id === targetId)) return;

            const input = document.createElement('input');
            input.type = 'file';
            input.accept = SUPPORTED_EXTS.map(e => `.${e}`).join(',');
            input.onchange = async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                const article = state.articles.find(a => a.id === targetId);
                if (!article) return;

                const ok = await L().Storage.storeFile(article.id, file);
                if (!ok) return; // error already reported; keep previous metadata

                article.fileName = file.name;
                article.fileSize = U().formatBytes(file.size);
                article.filePath = file.webkitRelativePath || file.name;
                article.coverType = this.getCoverType(file.name);
                if (L().PDFExtractor) await L().PDFExtractor.invalidate(article.id);
                await L().Storage.save();

                if (state.inspectedArticleId === article.id) {
                    const fileNameEl = document.getElementById('inspector-file-name');
                    const fileSizeEl = document.getElementById('inspector-file-size');
                    const fileIconEl = document.getElementById('inspector-file-icon');
                    if (fileNameEl) fileNameEl.textContent = article.fileName;
                    if (fileSizeEl) {
                        fileSizeEl.textContent = article.fileSize;
                        fileSizeEl.classList.remove('hidden');
                    }
                    if (fileIconEl) fileIconEl.className = `ph ${fileTypeIcon(article)} text-2xl`;
                    this._refreshFileStatus(article);
                }
                if (L().Reader) await L().Reader.refreshIfShowing(article.id);
                this.render({ keepLimit: true });
                toast(tr('inspector.fileLinked', 'Arquivo vinculado! Clique em LER para abrir.'), 'success');
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
            const notesHeading = tr('inspector.notesTitle', 'Fichamento');
            const summaryHeading = tr('inspector.summaryTab', 'Abstract & Summary');
            const md = `# ${notesHeading}: ${article.title}\n\n**${tr('reader.authors', 'Autores')}:** ${article.authors || '—'}\n**${tr('reader.year', 'Ano')}:** ${article.year || 'N/A'}\n**${tr('inspector.fieldCollection', 'Collection')}:** ${article.collection || '—'}\n**${tr('reader.fileReference', 'Arquivo')}:** ${article.fileName || '—'}\n\n## ${summaryHeading}\n${article.summary || '—'}\n\n## ${notesHeading}\n${article.notes || '—'}\n`;
            const cleanTitle = U().fold(article.title || 'document').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || String(article.id);
            this._downloadText(md, `Notes_${cleanTitle}.md`, 'text/markdown;charset=utf-8');
            toast(tr('inspector.notesExported', 'Notas exportadas em Markdown'), 'success');
        },

        /**
         * Delete document from catalog and IndexedDB
         */
        async deleteInspected() {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article) return;

            if (!confirm(tr('inspector.confirmDelete', 'Remover "{title}" do acervo? O arquivo armazenado também será apagado.', { title: article.title }))) {
                return;
            }

            if (L().Reader && L().Reader.getCurrentArticleId() === article.id) L().Reader.close();
            this._skipDirtyCheck = true;
            L().UI.Modal.close('inspector-modal');

            await L().Storage.deleteFile(article.id);
            state.articles = state.articles.filter(a => a.id !== article.id);
            state.selectedIds = (state.selectedIds || []).filter(id => id !== article.id);
            state.inspectedArticleId = null;
            await L().Storage.save();
            L().Collections.render();
            this.render({ keepLimit: true });
            toast(tr('inspector.deletedToast', 'Documento removido do acervo'), 'info');
        },

        /* ------------------------------------------------------------------
           Add single document
           ------------------------------------------------------------------ */

        /** Called by the app when a file is chosen in the single-upload form */
        async prefillFromFile(file) {
            const titleInput = document.getElementById('form-title');
            const yearInput = document.getElementById('form-year');
            const authorInput = document.getElementById('form-author');
            const summaryInput = document.getElementById('form-summary');
            const fileNameDisplay = document.getElementById('selected-file-name');
            if (!file) return;

            if (fileNameDisplay) {
                fileNameDisplay.textContent = tr('upload.selectedFile', 'Selecionado: {name} ({size})', { name: file.name, size: U().formatBytes(file.size) });
            }
            const autoTitle = this.cleanTitle(file.name);
            if (titleInput && !titleInput.value.trim()) titleInput.value = autoTitle;
            const yearFromName = this.extractYear(file.name);
            if (yearInput && !yearInput.value && yearFromName) yearInput.value = yearFromName;

            formExtraction = null;
            if (U().fileExt(file.name) === 'pdf' && L().PDFExtractor) {
                try {
                    const extracted = await L().PDFExtractor.extractFromBlob(file);
                    const currentInput = document.getElementById('file-upload');
                    const stillSelected = currentInput && currentInput.files && currentInput.files[0] === file;
                    if (!extracted || (!stillSelected && this._pendingDroppedFile !== file)) return;
                    formExtraction = { file, result: extracted };
                    if (extracted.title && titleInput && (!titleInput.value.trim() || titleInput.value === autoTitle)) titleInput.value = extracted.title;
                    if (extracted.authors && authorInput && !authorInput.value.trim()) authorInput.value = extracted.authors;
                    if (extracted.year && yearInput && !yearInput.value) yearInput.value = extracted.year;
                    if (extracted.abstract && summaryInput && !summaryInput.value.trim()) summaryInput.value = extracted.abstract;
                } catch (e) {
                    console.warn('[Articles] PDF extraction error:', e);
                }
            }
        },

        resetAddForm() {
            const form = document.getElementById('add-article-form');
            if (form) form.reset();
            const fileNameDisplay = document.getElementById('selected-file-name');
            if (fileNameDisplay) fileNameDisplay.textContent = '';
            formExtraction = null;
            this._pendingDroppedFile = null;
            if (L().Academic && L().Academic.clearPendingUploadMeta) L().Academic.clearPendingUploadMeta();
        },

        async handleAddArticleSubmit() {
            const v = (id) => {
                const el = document.getElementById(id);
                return el ? String(el.value || '').trim() : '';
            };
            const fileInput = document.getElementById('file-upload');
            const submitBtn = document.getElementById('submit-article-btn');

            const title = v('form-title');
            if (!title) {
                toast(tr('upload.titleRequired', 'Informe o título do documento'), 'warning');
                const t = document.getElementById('form-title');
                if (t) t.focus();
                return;
            }
            if (this._submitting) return;
            this._submitting = true;

            const originalBtnText = submitBtn ? submitBtn.textContent : '';
            if (submitBtn) {
                submitBtn.textContent = tr('upload.registering', 'Registrando...');
                submitBtn.disabled = true;
            }

            try {
                const file = (fileInput && fileInput.files && fileInput.files[0]) || this._pendingDroppedFile || null;
                const articleId = U().newArticleId();
                const yearRaw = parseInt(v('form-year'), 10);
                const statusRaw = v('form-status');
                const colRaw = v('form-collection');

                let fileStored = false;
                if (file) {
                    fileStored = await L().Storage.storeFile(articleId, file);
                }

                const ext = file ? U().fileExt(file.name) : '';
                const newArticle = {
                    id: articleId,
                    title,
                    authors: v('form-author'),
                    year: Number.isFinite(yearRaw) ? yearRaw : null,
                    publication: v('form-pub'),
                    doi: v('form-doi'),
                    status: VALID_STATUS.includes(statusRaw) ? statusRaw : 'inbox',
                    collection: colRaw && colRaw !== 'none' ? colRaw : null,
                    tags: ext ? [ext.toUpperCase()] : [],
                    addedDate: U().localDateStr(),
                    isFavorite: false,
                    coverType: file ? this.getCoverType(file.name) : 'pdf',
                    fileName: fileStored ? file.name : '',
                    fileSize: fileStored ? U().formatBytes(file.size) : '',
                    filePath: fileStored ? (file.webkitRelativePath || file.name) : '',
                    summary: v('form-summary'),
                    notes: ''
                };

                // Extra bibliographic data fetched by DOI in the form (volume/issue/pages/type)
                const A = L().Academic;
                const pending = A && A.consumePendingUploadMeta ? A.consumePendingUploadMeta() : null;
                if (pending && (!pending.doi || !newArticle.doi || (A.normalizeDoi(newArticle.doi) === pending.doi))) {
                    ['volume', 'issue', 'pages'].forEach(k => { if (pending[k]) newArticle[k] = pending[k]; });
                    if (pending.coverType && !file) newArticle.coverType = pending.coverType;
                }

                window.Lexicon.State.articles.unshift(newArticle);
                await L().Storage.save();

                if (fileStored && formExtraction && formExtraction.file === file && formExtraction.result.fullTextSnippet) {
                    L().Storage.setExtractedText(articleId, formExtraction.result.fullTextSnippet);
                }

                L().Collections.render();
                this.render();
                L().UI.Modal.close('upload-modal');
                toast(file && !fileStored
                    ? tr('upload.addedWithoutFile', 'Documento registrado, mas o arquivo não pôde ser salvo.')
                    : tr('upload.added', 'Documento adicionado ao acervo'), file && !fileStored ? 'warning' : 'success');
                this.resetAddForm();
            } catch (err) {
                console.error('Add document failed:', err);
                toast(tr('upload.addError', 'Erro ao adicionar documento: {error}', { error: err.message }), 'error');
            } finally {
                this._submitting = false;
                if (submitBtn) {
                    submitBtn.textContent = originalBtnText;
                    submitBtn.disabled = false;
                }
            }
        },

        /* ------------------------------------------------------------------
           Upload Modal Tabs & Multi-File / Folder Import
           ------------------------------------------------------------------ */
        stagedFiles: [],

        switchUploadTab(tab) {
            const isMulti = tab === 'multi';
            const toggle = (id, hidden) => {
                const el = document.getElementById(id);
                if (el) el.classList.toggle('hidden', hidden);
            };
            toggle('upload-tab-single', isMulti);
            toggle('upload-tab-multi', !isMulti);
            toggle('submit-article-btn', isMulti);
            toggle('submit-multi-import-btn', !isMulti);
            const btnSingle = document.getElementById('tab-btn-single');
            const btnMulti = document.getElementById('tab-btn-multi');
            if (btnSingle) {
                btnSingle.classList.toggle('active', !isMulti);
                btnSingle.setAttribute('aria-selected', String(!isMulti));
            }
            if (btnMulti) {
                btnMulti.classList.toggle('active', isMulti);
                btnMulti.setAttribute('aria-selected', String(isMulti));
            }
        },

        isSupportedDocument(filename) {
            return SUPPORTED_EXTS.includes(U().fileExt(filename));
        },

        cleanTitle(filename) {
            const base = String(filename || '').replace(/\.[^/.]+$/, "");
            const cleaned = base.replace(/[-_+]/g, " ").replace(/\s+/g, " ").trim();
            return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        },

        /** Year found in the file name, or null (never invents the current year) */
        extractYear(filename) {
            const match = String(filename || '').match(/(?:^|[^0-9])(19\d{2}|20\d{2})(?![0-9])/);
            if (!match) return null;
            const y = parseInt(match[1], 10);
            return y <= new Date().getFullYear() + 1 ? y : null;
        },

        getCoverType(filename) {
            const ext = U().fileExt(filename);
            if (ext === 'epub' || ext === 'mobi') return 'book';
            if (ext === 'doc' || ext === 'docx') return 'doc';
            return 'pdf';
        },

        formatBytes(bytes) {
            return U().formatBytes(bytes);
        },

        addFilesToStaging(items) {
            let addedCount = 0;
            let skipped = 0;
            (items || []).forEach(item => {
                const file = item.file || item;
                if (!file || !file.name) return;
                if (file.name.startsWith('.') || file.name.startsWith('~') || file.name === 'Thumbs.db') return;
                if (!this.isSupportedDocument(file.name)) {
                    skipped++;
                    return;
                }

                const relativePath = item.path || file.webkitRelativePath || file.name;
                const exists = this.stagedFiles.some(s => s.file.name === file.name && s.file.size === file.size && s.path === relativePath);
                if (exists) return;

                let folder = item.folder || '';
                if (!folder && relativePath && relativePath.includes('/')) {
                    const parts = relativePath.split('/').filter(Boolean);
                    if (parts.length > 1) folder = parts[parts.length - 2];
                }

                this.stagedFiles.push({
                    file,
                    name: file.name,
                    size: file.size,
                    path: relativePath,
                    folder: String(folder || '').trim().slice(0, 120)
                });
                addedCount++;
            });

            this.renderStagedFiles();
            if (addedCount > 0) this.switchUploadTab('multi');
            if (skipped > 0) toast(tr('upload.skippedUnsupported', '{count} arquivo(s) ignorado(s): formato não suportado', { count: skipped }), 'info');
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
                listEl.innerHTML = '';
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = tr('upload.importDocuments', 'Importar documentos');
                }
                return;
            }

            container.classList.remove('hidden');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = tr('upload.importN', 'Importar {count} documento(s)', { count: n });
            }

            const folders = {};
            const noFolder = tr('upload.noFolder', 'Sem pasta');
            this.stagedFiles.forEach(f => {
                const fol = f.folder || noFolder;
                folders[fol] = (folders[fol] || 0) + 1;
            });
            const folderNames = Object.keys(folders);
            const folderBreakdown = folderNames.map(f => `${f} (${folders[f]})`).join(', ');
            countText.innerHTML = `<strong>${esc(tr('upload.stagedCount', '{count} documento(s) preparado(s)', { count: n }))}</strong> <span class="text-earth/70 font-normal">${esc(tr('upload.inFolders', 'em {count} pasta(s)', { count: folderNames.length }))}: ${esc(folderBreakdown)}</span>`;

            const removeLabel = esc(tr('upload.removeFile', 'Remover arquivo'));
            listEl.innerHTML = this.stagedFiles.map((staged, idx) => {
                const icon = fileTypeIcon({ fileName: staged.name, coverType: this.getCoverType(staged.name) });
                return `
                    <div class="staged-file-row flex items-center justify-between px-3 py-2 gap-3">
                        <div class="flex items-center gap-2.5 min-w-0 flex-1">
                            <i class="ph ${icon} text-base shrink-0" aria-hidden="true"></i>
                            <div class="min-w-0">
                                <p class="text-xs font-semibold text-soil truncate">${esc(staged.name)}</p>
                                <div class="flex items-center gap-2 text-[10px] text-earth/70 font-mono">
                                    ${staged.folder ? `<span class="bg-jungle/10 text-canopy px-1.5 py-0.5 rounded font-sans font-semibold flex items-center gap-1"><i class="ph ph-folder text-xs" aria-hidden="true"></i> ${esc(staged.folder)}</span>` : `<span class="italic font-sans">${esc(noFolder)}</span>`}
                                    <span>${esc(U().formatBytes(staged.size))}</span>
                                </div>
                            </div>
                        </div>
                        <button type="button" data-action="remove-staged-file" data-index="${idx}" class="text-earth hover:text-terracotta p-1 rounded transition-colors cursor-pointer" title="${removeLabel}" aria-label="${removeLabel}">
                            <i class="ph ph-x" aria-hidden="true"></i>
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
            ['import-multi-files-input', 'import-folder-input'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        },

        /**
         * Recursively scan DataTransferItemList for files and folder hierarchies.
         * NOTE: webkitGetAsEntry() must be called synchronously inside the drop event,
         * so entries are collected before the first await.
         */
        async scanDataTransferItems(items) {
            const results = [];
            const queue = [];

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind !== 'file') continue;
                const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                if (entry) {
                    queue.push(entry);
                } else {
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
                    entries.forEach(sub => queue.push(sub));
                }
            }

            return results;
        },

        /**
         * Execute multi-file and folder import
         */
        async executeMultiImport() {
            if (this.stagedFiles.length === 0 || this._importing) return;
            this._importing = true;

            const submitBtn = document.getElementById('submit-multi-import-btn');
            const progressContainer = document.getElementById('import-progress-container');
            const progressBar = document.getElementById('import-progress-bar');
            const progressLabel = document.getElementById('import-progress-label');
            const progressPercent = document.getElementById('import-progress-percent');

            const autoCollections = document.getElementById('import-opt-folder-collections')?.checked ?? true;
            const autoTags = document.getElementById('import-opt-folder-tags')?.checked ?? true;
            const fallbackRaw = document.getElementById('import-opt-default-collection')?.value || '';
            const fallbackCollection = fallbackRaw && fallbackRaw !== 'none' ? fallbackRaw : null;
            const statusRaw = document.getElementById('import-opt-status')?.value || 'inbox';
            const targetStatus = VALID_STATUS.includes(statusRaw) ? statusRaw : 'inbox';

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = tr('upload.importing', 'Importando...');
            }
            if (progressContainer) progressContainer.classList.remove('hidden');

            const staged = this.stagedFiles.slice();
            const total = staged.length;
            const createdCollections = new Set();
            const state = window.Lexicon.State;
            let imported = 0;
            let failed = 0;

            try {
                for (let i = 0; i < total; i++) {
                    const item = staged[i];
                    const file = item.file;
                    const articleId = U().newArticleId();

                    let collectionName = fallbackCollection;
                    if (item.folder && autoCollections) {
                        const col = L().Collections.getOrCreate(item.folder, { silent: true });
                        collectionName = col ? col.name : fallbackCollection;
                        if (col) createdCollections.add(col.name);
                    }

                    const tags = [];
                    if (item.folder && autoTags) {
                        const folderTag = item.folder.normalize('NFC').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40);
                        if (folderTag) tags.push(folderTag);
                    }
                    const ext = U().fileExt(file.name).toUpperCase();
                    if (ext) tags.push(ext);

                    if (progressLabel) progressLabel.textContent = tr('upload.importProgress', 'Importando ({current}/{total}): {name}', { current: i + 1, total, name: file.name });

                    const ok = await L().Storage.storeFile(articleId, file);
                    if (!ok) {
                        failed++;
                        // Storage is most likely full: stop instead of failing on every file
                        if (failed >= 3 && imported === 0) break;
                        continue;
                    }

                    state.articles.unshift({
                        id: articleId,
                        title: this.cleanTitle(file.name),
                        authors: '',
                        year: this.extractYear(file.name),
                        publication: '',
                        doi: '',
                        status: targetStatus,
                        collection: collectionName,
                        tags,
                        addedDate: U().localDateStr(),
                        isFavorite: false,
                        coverType: this.getCoverType(file.name),
                        fileName: file.name,
                        fileSize: U().formatBytes(file.size),
                        filePath: item.path || file.name,
                        summary: '',
                        notes: ''
                    });
                    imported++;

                    // Persist periodically so a closed tab doesn't orphan stored files
                    if (imported % 20 === 0) await L().Storage.save();

                    const pct = Math.round(((i + 1) / total) * 100);
                    if (progressBar) progressBar.style.width = `${pct}%`;
                    if (progressPercent) progressPercent.textContent = `${pct}%`;
                }
            } catch (err) {
                console.error('Multi import failed:', err);
                toast(tr('upload.importError', 'Erro na importação: {error}', { error: err.message }), 'error');
            } finally {
                await L().Storage.save();
                L().Collections.render();
                L().Collections.populateSelects();
                this.render();

                this.clearStagedFiles();
                if (progressContainer) progressContainer.classList.add('hidden');
                if (progressBar) progressBar.style.width = '0%';
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = tr('upload.importDocuments', 'Importar documentos');
                }
                this._importing = false;
            }

            if (imported > 0) L().UI.Modal.close('upload-modal');
            const colMsg = createdCollections.size > 0 ? ` • ${tr('upload.intoCollections', 'em {count} coleção(ões)', { count: createdCollections.size })}` : '';
            if (failed > 0) {
                toast(tr('upload.importPartial', '{ok} de {total} documentos importados; {failed} falharam (armazenamento cheio?).', { ok: imported, total, failed }), 'warning');
            } else {
                toast(tr('upload.importDone', '{count} documentos importados com sucesso!', { count: imported }) + colMsg, 'success');
            }
        }
    };
})();
