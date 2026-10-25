/* ==========================================================================
   Lexicon - Main Application Bootstrap & Controller
   Intelligent Research Library & Document Manager
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    const U = () => window.Lexicon.Utils;
    const tr = (k, f, p) => U().tr(k, f, p);
    const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

    /**
     * Resolve "Module.method" against window.Lexicon (own properties only).
     * Returns { fn, ctx } or null.
     */
    function resolveAction(path) {
        if (!path || typeof path !== 'string') return null;
        if (path === 'closeModal') return { fn: window.Lexicon.UI.Modal.close, ctx: window.Lexicon.UI.Modal };
        if (path === 'openModal') return { fn: window.Lexicon.UI.Modal.open, ctx: window.Lexicon.UI.Modal };
        const parts = path.split('.');
        let ctx = null;
        let cur = window.Lexicon;
        for (const p of parts) {
            if (FORBIDDEN_KEYS.has(p) || cur === null || cur === undefined) return null;
            if (!Object.prototype.hasOwnProperty.call(cur, p) && !(p in cur)) return null;
            ctx = cur;
            cur = cur[p];
        }
        return typeof cur === 'function' ? { fn: cur, ctx } : null;
    }

    function buildArgs(el, event) {
        const raw = el.getAttribute('data-lx-args');
        if (!raw) return [];
        let args;
        try {
            args = JSON.parse(raw);
        } catch (e) {
            console.warn('[App] invalid data-lx-args on', el, e);
            return [];
        }
        if (!Array.isArray(args)) args = [args];
        return args.map(a => {
            if (a === '$value') return el.value;
            if (a === '$checked') return el.checked;
            if (a === '$event') return event;
            if (a === '$inspectedId') return window.Lexicon.State.inspectedArticleId;
            return a;
        });
    }

    function runAction(el, attr, event) {
        const path = el.getAttribute(attr);
        const target = resolveAction(path);
        if (!target) {
            console.warn(`[App] unknown action "${path}"`);
            return;
        }
        try {
            const result = target.fn.apply(target.ctx, buildArgs(el, event));
            if (result && typeof result.catch === 'function') {
                result.catch(err => console.error(`[App] action ${path} failed:`, err));
            }
        } catch (err) {
            console.error(`[App] action ${path} failed:`, err);
        }
    }

    window.Lexicon.App = {
        async init() {
            if (this._initialized) return;
            this._initialized = true;
            console.log('Initializing Lexicon...');

            // 1. Core UI infrastructure
            window.Lexicon.UI.Modal.init();
            this.setupActionDispatcher();

            // 2. Load persisted catalog BEFORE the first render
            await window.Lexicon.Storage.load();

            // 3. i18n (translates DOM and renders once with real data)
            if (window.Lexicon.I18n) window.Lexicon.I18n.init();

            // 4. Feature modules
            if (window.Lexicon.Navigation) window.Lexicon.Navigation.init();
            if (window.Lexicon.Collections) window.Lexicon.Collections.init();
            if (window.Lexicon.Articles) window.Lexicon.Articles.init();
            if (window.Lexicon.Academic && typeof window.Lexicon.Academic.init === 'function') window.Lexicon.Academic.init();
            if (window.Lexicon.PDFExtractor) window.Lexicon.PDFExtractor.init();
            if (window.Lexicon.Zettelkasten) window.Lexicon.Zettelkasten.init();
            if (window.Lexicon.Reader) window.Lexicon.Reader.init();

            // 5. Initial render
            this.applySidebarState();
            this.updateViewModeButtons();
            window.Lexicon.Collections.render();
            window.Lexicon.Collections.populateSelects();
            window.Lexicon.Articles.render();

            // 6. Event listeners
            this.setupNavigation();
            this.setupSearch();
            this.setupSorting();
            this.setupViewModes();
            this.setupSidebarToggle();
            this.setupFileUpload();
            this.setupShortcuts();
            this.setupBackupControls();
            this.setupUnloadGuard();

            // 7. AI Librarian (non-blocking)
            if (window.Lexicon.Librarian) {
                window.Lexicon.Librarian.init().catch(err => console.warn('[App] Librarian init failed:', err));
            }

            document.documentElement.classList.add('lexicon-ready');
            console.log('Lexicon ready.');
        },

        /**
         * Declarative, CSP-friendly event wiring:
         *   data-lx-click / data-lx-change / data-lx-input / data-lx-submit / data-lx-enter
         *   data-lx-args='["arg", "$value", "$checked", "$inspectedId"]'
         *   data-lx-stop (stop click propagation), data-lx-click-target="#selector"
         */
        setupActionDispatcher() {
            if (this._dispatcherReady) return;
            this._dispatcherReady = true;

            document.addEventListener('click', (e) => {
                const stopper = e.target.closest('[data-lx-stop]');
                const proxy = e.target.closest('[data-lx-click-target]');
                if (proxy) {
                    e.preventDefault();
                    const target = document.querySelector(proxy.getAttribute('data-lx-click-target'));
                    if (target) target.click();
                    return;
                }
                const el = e.target.closest('[data-lx-click]');
                if (stopper && (!el || stopper.contains(el) === false)) {
                    e.stopPropagation();
                }
                if (!el) return;
                if (el.tagName === 'A' || el.getAttribute('type') === 'submit') e.preventDefault();
                if (el.disabled) return;
                runAction(el, 'data-lx-click', e);
            });

            document.addEventListener('change', (e) => {
                const el = e.target.closest('[data-lx-change]');
                if (el) runAction(el, 'data-lx-change', e);
            });

            document.addEventListener('input', (e) => {
                const el = e.target.closest('[data-lx-input]');
                if (el) runAction(el, 'data-lx-input', e);
            });

            document.addEventListener('submit', (e) => {
                const form = e.target.closest('[data-lx-submit]');
                if (form) {
                    e.preventDefault();
                    runAction(form, 'data-lx-submit', e);
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' || e.isComposing) return;
                const el = e.target.closest('[data-lx-enter]');
                if (el) {
                    e.preventDefault();
                    runAction(el, 'data-lx-enter', e);
                }
            });
        },

        setupNavigation() {
            const navLinks = document.querySelectorAll('#sidebar .nav-link[data-filter]');
            navLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.Lexicon.Articles.setCategoryFilter(link.dataset.filter);
                });
            });
        },

        setupSearch() {
            const searchInput = document.getElementById('search-input');
            if (!searchInput) return;

            let debounceTimer = null;
            let recordedForThisTyping = false;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const state = window.Lexicon.State;
                    const value = e.target.value.trim();
                    if (!recordedForThisTyping && window.Lexicon.Navigation) {
                        window.Lexicon.Navigation.recordNavigation();
                        recordedForThisTyping = true;
                    }
                    state.searchQuery = value;
                    state.semanticFilter = null;
                    window.Lexicon.Articles.render();
                }, 180);
            });
            searchInput.addEventListener('blur', () => { recordedForThisTyping = false; });

            // Enter => AI semantic search (falls back to text search when the AI is offline)
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.isComposing) {
                    e.preventDefault();
                    clearTimeout(debounceTimer);
                    const query = searchInput.value.trim();
                    if (query && window.Lexicon.Librarian) {
                        window.Lexicon.Librarian.executeSemanticSearch(query);
                    }
                } else if (e.key === 'Escape' && searchInput.value) {
                    e.preventDefault();
                    searchInput.value = '';
                    window.Lexicon.State.searchQuery = '';
                    window.Lexicon.State.semanticFilter = null;
                    window.Lexicon.Articles.render();
                }
            });
        },

        setupSorting() {
            const sortSelect = document.getElementById('sort-select');
            if (!sortSelect) return;
            sortSelect.value = window.Lexicon.State.sortBy || 'date-desc';
            sortSelect.addEventListener('change', (e) => {
                window.Lexicon.State.sortBy = e.target.value;
                window.Lexicon.Storage.save();
                window.Lexicon.Articles.render();
            });
        },

        setupViewModes() {
            const bind = (id, mode) => {
                const btn = document.getElementById(id);
                if (!btn) return;
                btn.addEventListener('click', () => {
                    window.Lexicon.State.viewMode = mode;
                    this.updateViewModeButtons();
                    window.Lexicon.Storage.save();
                    window.Lexicon.Articles.render();
                });
            };
            bind('btn-view-grid', 'grid');
            bind('btn-view-table', 'table');
        },

        updateViewModeButtons() {
            const state = window.Lexicon.State;
            const btnGrid = document.getElementById('btn-view-grid');
            const btnTable = document.getElementById('btn-view-table');
            if (!btnGrid || !btnTable) return;
            const active = 'p-1.5 rounded-md bg-wood/50 text-soil shadow-sm transition-all';
            const inactive = 'p-1.5 rounded-md text-earth hover:text-soil transition-all';
            const isTable = state.viewMode === 'table';
            btnTable.className = isTable ? active : inactive;
            btnGrid.className = isTable ? inactive : active;
            btnTable.setAttribute('aria-pressed', String(isTable));
            btnGrid.setAttribute('aria-pressed', String(!isTable));
        },

        handleLogoClick() {
            const state = window.Lexicon.State;
            if (state.sidebarCollapsed) {
                state.sidebarCollapsed = false;
                this.applySidebarState();
                window.Lexicon.Storage.save();
            }
        },

        setupSidebarToggle() {
            const toggleBtn = document.getElementById('toggle-sidebar');
            if (!toggleBtn) return;
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const state = window.Lexicon.State;
                state.sidebarCollapsed = !state.sidebarCollapsed;
                this.applySidebarState();
                window.Lexicon.Storage.save();
            });
        },

        applySidebarState() {
            const state = window.Lexicon.State;
            const sidebar = document.getElementById('sidebar');
            if (!sidebar) return;
            sidebar.classList.toggle('w-64', !state.sidebarCollapsed);
            sidebar.classList.toggle('sidebar-collapsed', !!state.sidebarCollapsed);
            const toggleBtn = document.getElementById('toggle-sidebar');
            if (toggleBtn) toggleBtn.setAttribute('aria-expanded', String(!state.sidebarCollapsed));
        },

        setupFileUpload() {
            const Articles = window.Lexicon.Articles;
            const dropZone = document.getElementById('drop-zone');
            const fileInput = document.getElementById('file-upload');

            const preventAndMark = (zone, active) => (e) => {
                e.preventDefault();
                e.stopPropagation();
                zone.classList.toggle('drag-active', active);
            };

            if (dropZone && fileInput) {
                dropZone.setAttribute('role', 'button');
                dropZone.setAttribute('tabindex', '0');
                dropZone.addEventListener('click', () => fileInput.click());
                dropZone.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInput.click();
                    }
                });

                fileInput.addEventListener('change', (e) => {
                    Articles._pendingDroppedFile = null;
                    if (e.target.files && e.target.files.length > 0) Articles.prefillFromFile(e.target.files[0]);
                });

                ['dragenter', 'dragover'].forEach(ev => dropZone.addEventListener(ev, preventAndMark(dropZone, true)));
                ['dragleave', 'drop'].forEach(ev => dropZone.addEventListener(ev, preventAndMark(dropZone, false)));

                dropZone.addEventListener('drop', async (e) => {
                    const dt = e.dataTransfer;
                    if (!dt) return;
                    const items = dt.items ? Array.from(dt.items) : [];
                    // Must be read synchronously inside the event handler
                    const firstEntry = items[0] && items[0].webkitGetAsEntry ? items[0].webkitGetAsEntry() : null;
                    if (items.length > 1 || (firstEntry && firstEntry.isDirectory)) {
                        const scanned = await Articles.scanDataTransferItems(dt.items);
                        Articles.addFilesToStaging(scanned);
                        return;
                    }
                    if (dt.files && dt.files.length > 0) {
                        const file = dt.files[0];
                        try {
                            fileInput.files = dt.files;
                        } catch (err) {
                            // Older browsers: keep a reference instead
                        }
                        Articles._pendingDroppedFile = file;
                        Articles.prefillFromFile(file);
                    }
                });
            }

            const dropZoneMulti = document.getElementById('drop-zone-multi');
            const multiFileInput = document.getElementById('import-multi-files-input');
            const folderInput = document.getElementById('import-folder-input');

            if (multiFileInput) {
                multiFileInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        Articles.addFilesToStaging(Array.from(e.target.files).map(f => ({ file: f, path: f.name, folder: '' })));
                    }
                });
            }

            if (folderInput) {
                folderInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        Articles.addFilesToStaging(Array.from(e.target.files).map(f => {
                            const relPath = f.webkitRelativePath || f.name;
                            const parts = relPath.split('/').filter(Boolean);
                            return { file: f, path: relPath, folder: parts.length > 1 ? parts[parts.length - 2] : '' };
                        }));
                    }
                });
            }

            if (dropZoneMulti) {
                ['dragenter', 'dragover'].forEach(ev => dropZoneMulti.addEventListener(ev, preventAndMark(dropZoneMulti, true)));
                ['dragleave', 'drop'].forEach(ev => dropZoneMulti.addEventListener(ev, preventAndMark(dropZoneMulti, false)));
                dropZoneMulti.addEventListener('drop', async (e) => {
                    const dt = e.dataTransfer;
                    if (dt && dt.items && dt.items.length > 0) {
                        Articles.addFilesToStaging(await Articles.scanDataTransferItems(dt.items));
                    } else if (dt && dt.files && dt.files.length > 0) {
                        Articles.addFilesToStaging(Array.from(dt.files).map(f => ({ file: f, path: f.name, folder: '' })));
                    }
                });
            }

            // Reset the add form whenever the upload dialog closes
            window.Lexicon.UI.Modal.onClose('upload-modal', () => {
                if (!Articles._submitting && !Articles._importing) {
                    Articles.resetAddForm();
                    Articles.clearStagedFiles();
                }
            });

            // Don't let a file dropped outside a drop zone navigate away from the app
            ['dragover', 'drop'].forEach(ev => window.addEventListener(ev, (e) => {
                if (!e.target.closest || !e.target.closest('#drop-zone, #drop-zone-multi')) e.preventDefault();
            }));
        },

        setupShortcuts() {
            document.addEventListener('keydown', (e) => {
                const el = document.activeElement;
                const tag = el ? el.tagName.toLowerCase() : '';
                const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || (el && el.isContentEditable);

                // Ctrl/Cmd + K => focus search
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                    e.preventDefault();
                    const searchInput = document.getElementById('search-input');
                    if (searchInput) {
                        searchInput.focus();
                        searchInput.select();
                    }
                    return;
                }

                // Alt + N => add document (Ctrl+N can't be intercepted in most browsers)
                if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n' && !isTyping) {
                    e.preventDefault();
                    window.Lexicon.UI.Modal.open('upload-modal');
                }
                // Escape is handled centrally by Lexicon.UI.Modal
            });
        },

        setupBackupControls() {
            const btnExport = document.getElementById('btn-export-backup');
            const fileImportInput = document.getElementById('import-file-input');

            if (btnExport) btnExport.addEventListener('click', () => window.Lexicon.Storage.exportJSON());
            if (fileImportInput) {
                fileImportInput.addEventListener('change', async (e) => {
                    const file = e.target.files && e.target.files[0];
                    fileImportInput.value = '';
                    if (file) await window.Lexicon.Storage.importJSON(file);
                });
            }
        },

        /** Warn before leaving while a save/import is still running */
        setupUnloadGuard() {
            window.addEventListener('beforeunload', (e) => {
                const A = window.Lexicon.Articles;
                if (A) A.flushNotesSave();
                if (window.Lexicon.Reader && window.Lexicon.Reader.isOpen()) window.Lexicon.Reader.flushPendingSave();
                if (A && (A._importing || A._submitting)) {
                    e.preventDefault();
                    e.returnValue = '';
                }
            });
        },

        async openSettingsModal(initialTab = 'general') {
            const Librarian = window.Lexicon.Librarian;
            if (Librarian) {
                const endpointInput = document.getElementById('librarian-endpoint-input');
                if (endpointInput) endpointInput.value = Librarian.endpoint;
                Librarian.populateModelSelect();
                Librarian.updateBadgeUI();
            }
            this.switchSettingsTab(initialTab);
            if (window.Lexicon.I18n) window.Lexicon.I18n.updateLanguageButtons();
            window.Lexicon.UI.Modal.open('librarian-settings-modal');
            this.updateStorageInfo();
        },

        /** Show browser storage usage / persistence in the backup tab */
        async updateStorageInfo() {
            const el = document.getElementById('storage-usage-info');
            if (!el) return;
            const Storage = window.Lexicon.Storage;
            const est = await Storage.getStorageEstimate();
            let persisted = false;
            try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false; } catch (e) { persisted = false; }
            const used = est && est.usage ? U().formatBytes(est.usage) : '?';
            const quota = est && est.quota ? U().formatBytes(est.quota) : '?';
            el.textContent = tr('settings.storageUsage', 'Uso de armazenamento: {used} de {quota} • {persist}', {
                used, quota,
                persist: persisted ? tr('settings.storagePersistent', 'persistente (protegido contra limpeza automática)') : tr('settings.storageNotPersistent', 'não persistente — o navegador pode apagar os dados se faltar espaço; faça backups completos')
            });
        },

        closeSettingsAndOpenReset() {
            window.Lexicon.UI.Modal.close('librarian-settings-modal');
            window.Lexicon.Storage.openResetWizard();
        },

        switchSettingsTab(tabName) {
            document.querySelectorAll('.settings-tab-btn').forEach(btn => {
                const isActive = btn.dataset.tab === tabName;
                btn.classList.toggle('border-jungle', isActive);
                btn.classList.toggle('text-jungle', isActive);
                btn.classList.toggle('border-transparent', !isActive);
                btn.classList.toggle('text-earth', !isActive);
                btn.setAttribute('aria-selected', String(isActive));
            });
            document.querySelectorAll('.settings-tab-panel').forEach(panel => {
                panel.classList.toggle('hidden', panel.id !== `settings-panel-${tabName}`);
            });
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.Lexicon.App.init().catch(err => {
            console.error('Lexicon failed to start:', err);
            const msg = document.getElementById('current-view-count');
            if (msg) msg.textContent = `Error: ${err.message}`;
        });
    });
})();
