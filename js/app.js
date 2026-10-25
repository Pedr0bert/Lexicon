/* ==========================================================================
   Lexicon - Main Application Bootstrap & Controller
   Intelligent Research Library & Document Manager
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

window.Lexicon.Utils = {
    escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};

(function() {
    window.Lexicon.App = {
        async init() {
            console.log('Initializing Lexicon Intelligent Document Manager v2...');

            // 1. Initialize UI & i18n Handlers
            window.Lexicon.UI.Modal.init();
            if (window.Lexicon.I18n) {
                window.Lexicon.I18n.init();
            }
            if (window.Lexicon.Navigation) {
                window.Lexicon.Navigation.init();
            }
            if (window.Lexicon.Collections && typeof window.Lexicon.Collections.init === 'function') {
                window.Lexicon.Collections.init();
            }
            if (window.Lexicon.Articles && typeof window.Lexicon.Articles.init === 'function') {
                window.Lexicon.Articles.init();
            }
            if (window.Lexicon.Academic && typeof window.Lexicon.Academic.init === 'function') {
                window.Lexicon.Academic.init();
            }

            // 2. Load Persisted Catalog
            await window.Lexicon.Storage.load();

            // 3. Render Initial State
            this.applySidebarState();
            this.updateViewModeButtons();
            window.Lexicon.Collections.render();
            window.Lexicon.Collections.populateSelects();
            window.Lexicon.Articles.render();

            // 4. Setup Event Listeners
            this.setupNavigation();
            this.setupSearch();
            this.setupSorting();
            this.setupViewModes();
            this.setupSidebarToggle();
            this.setupFileUpload();
            this.setupShortcuts();
            this.setupBackupControls();

            // 5. Initialize AI Librarian (Ollama Agent)
            if (window.Lexicon.Librarian) {
                window.Lexicon.Librarian.init();
            }

            // 6. Initialize Phase 3 Modules (PDFExtractor, Zettelkasten, Reader)
            if (window.Lexicon.PDFExtractor) window.Lexicon.PDFExtractor.init();
            if (window.Lexicon.Zettelkasten) window.Lexicon.Zettelkasten.init();
            if (window.Lexicon.Reader) window.Lexicon.Reader.init();

            console.log('Lexicon v5 with Phase 3 Ready.');
        },

        setupNavigation() {
            const navLinks = document.querySelectorAll('#sidebar .nav-link[data-filter]');
            navLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();

                    if (window.Lexicon.Navigation) {
                        window.Lexicon.Navigation.recordNavigation();
                    }

                    navLinks.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');

                    const filterValue = link.dataset.filter;
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

                    const state = window.Lexicon.State;
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

                    // Refresh collections UI to unselect active collection
                    window.Lexicon.Collections.render();
                    window.Lexicon.Articles.render();
                });
            });
        },

        setupSearch() {
            const searchInput = document.getElementById('search-input');
            if (!searchInput) return;

            let debounceTimer = null;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const state = window.Lexicon.State;
                    state.searchQuery = e.target.value.trim();
                    if (state.semanticFilter) state.semanticFilter = null;
                    window.Lexicon.Articles.render();
                }, 150);
            });

            // Enter key triggers AI Semantic Search through the Librarian
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    clearTimeout(debounceTimer);
                    const query = searchInput.value.trim();
                    if (query && window.Lexicon.Librarian) {
                        window.Lexicon.Librarian.executeSemanticSearch(query);
                    }
                }
            });
        },

        setupSorting() {
            const sortSelect = document.getElementById('sort-select');
            if (!sortSelect) return;

            sortSelect.value = window.Lexicon.State.sortBy || 'date-desc';
            sortSelect.addEventListener('change', (e) => {
                const state = window.Lexicon.State;
                state.sortBy = e.target.value;
                window.Lexicon.Storage.save();
                window.Lexicon.Articles.render();
            });
        },

        setupViewModes() {
            const btnGrid = document.getElementById('btn-view-grid');
            const btnTable = document.getElementById('btn-view-table');

            if (btnGrid) {
                btnGrid.addEventListener('click', () => {
                    window.Lexicon.State.viewMode = 'grid';
                    this.updateViewModeButtons();
                    window.Lexicon.Storage.save();
                    window.Lexicon.Articles.render();
                });
            }

            if (btnTable) {
                btnTable.addEventListener('click', () => {
                    window.Lexicon.State.viewMode = 'table';
                    this.updateViewModeButtons();
                    window.Lexicon.Storage.save();
                    window.Lexicon.Articles.render();
                });
            }
        },

        updateViewModeButtons() {
            const state = window.Lexicon.State;
            const btnGrid = document.getElementById('btn-view-grid');
            const btnTable = document.getElementById('btn-view-table');

            if (btnGrid && btnTable) {
                if (state.viewMode === 'table') {
                    btnTable.className = 'p-1.5 rounded-md bg-wood/50 text-soil shadow-sm transition-all';
                    btnGrid.className = 'p-1.5 rounded-md text-earth hover:text-soil transition-all';
                } else {
                    btnGrid.className = 'p-1.5 rounded-md bg-wood/50 text-soil shadow-sm transition-all';
                    btnTable.className = 'p-1.5 rounded-md text-earth hover:text-soil transition-all';
                }
            }
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

            if (state.sidebarCollapsed) {
                sidebar.classList.remove('w-64');
                sidebar.classList.add('sidebar-collapsed');
            } else {
                sidebar.classList.remove('sidebar-collapsed');
                sidebar.classList.add('w-64');
            }
        },

        setupFileUpload() {
            // --- Single File Dropzone & Input ---
            const dropZone = document.getElementById('drop-zone');
            const fileInput = document.getElementById('file-upload');
            const fileNameDisplay = document.getElementById('selected-file-name');
            const titleInput = document.getElementById('form-title');
            const yearInput = document.getElementById('form-year');

            const handleSingleFile = (file) => {
                if (!file) return;

                const sizeStr = file.size > 1024 * 1024 
                    ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
                    : `${(file.size / 1024).toFixed(1)} KB`;

                if (fileNameDisplay) {
                    fileNameDisplay.textContent = `Selected: ${file.name} (${sizeStr})`;
                }

                // Auto-fill title if empty
                if (titleInput && !titleInput.value.trim()) {
                    titleInput.value = window.Lexicon.Articles.cleanTitle(file.name);
                }

                // Try to infer year from filename
                if (yearInput && !yearInput.value) {
                    yearInput.value = window.Lexicon.Articles.extractYear(file.name);
                }

                // Real PDF Text & Metadata Extraction (Item 3.2)
                if (file.name.toLowerCase().endsWith('.pdf') && window.Lexicon.PDFExtractor) {
                    window.Lexicon.PDFExtractor.extractFromBlob(file).then(extracted => {
                        if (!extracted) return;
                        if (extracted.title && (!titleInput.value.trim() || titleInput.value === window.Lexicon.Articles.cleanTitle(file.name))) {
                            titleInput.value = extracted.title;
                        }
                        const authorInput = document.getElementById('form-author');
                        if (extracted.authors && authorInput && !authorInput.value.trim()) {
                            authorInput.value = extracted.authors;
                        }
                        if (extracted.year && yearInput && !yearInput.value) {
                            yearInput.value = extracted.year;
                        }
                        const summaryInput = document.getElementById('form-summary');
                        if (extracted.abstract && summaryInput && !summaryInput.value.trim()) {
                            summaryInput.value = extracted.abstract;
                        }
                    }).catch(e => console.warn('[App] PDF extraction background error:', e));
                }
            };

            if (dropZone && fileInput) {
                dropZone.addEventListener('click', () => fileInput.click());

                fileInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        handleSingleFile(e.target.files[0]);
                    }
                });

                ['dragenter', 'dragover'].forEach(event => {
                    dropZone.addEventListener(event, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dropZone.classList.add('drag-active');
                    });
                });

                ['dragleave', 'drop'].forEach(event => {
                    dropZone.addEventListener(event, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dropZone.classList.remove('drag-active');
                    });
                });

                dropZone.addEventListener('drop', async (e) => {
                    if (e.dataTransfer && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                        // Check if multiple files or folder dropped on single dropzone
                        const firstEntry = e.dataTransfer.items[0].webkitGetAsEntry ? e.dataTransfer.items[0].webkitGetAsEntry() : null;
                        if (e.dataTransfer.items.length > 1 || (firstEntry && firstEntry.isDirectory)) {
                            const scanned = await window.Lexicon.Articles.scanDataTransferItems(e.dataTransfer.items);
                            window.Lexicon.Articles.addFilesToStaging(scanned);
                            return;
                        }

                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                            fileInput.files = e.dataTransfer.files;
                            handleSingleFile(e.dataTransfer.files[0]);
                        }
                    }
                });
            }

            // --- Multi-File & Folder Import Controls ---
            const dropZoneMulti = document.getElementById('drop-zone-multi');
            const multiFileInput = document.getElementById('import-multi-files-input');
            const folderInput = document.getElementById('import-folder-input');

            if (multiFileInput) {
                multiFileInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        const fileList = Array.from(e.target.files).map(f => ({ file: f, path: f.name, folder: '' }));
                        window.Lexicon.Articles.addFilesToStaging(fileList);
                    }
                });
            }

            if (folderInput) {
                folderInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        const fileList = Array.from(e.target.files).map(f => {
                            const relPath = f.webkitRelativePath || f.name;
                            const parts = relPath.split('/').filter(Boolean);
                            const folder = parts.length > 1 ? parts[parts.length - 2] : '';
                            return { file: f, path: relPath, folder: folder };
                        });
                        window.Lexicon.Articles.addFilesToStaging(fileList);
                    }
                });
            }

            if (dropZoneMulti) {
                ['dragenter', 'dragover'].forEach(event => {
                    dropZoneMulti.addEventListener(event, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dropZoneMulti.classList.add('drag-active');
                    });
                });

                ['dragleave', 'drop'].forEach(event => {
                    dropZoneMulti.addEventListener(event, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dropZoneMulti.classList.remove('drag-active');
                    });
                });

                dropZoneMulti.addEventListener('drop', async (e) => {
                    if (e.dataTransfer && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                        const scanned = await window.Lexicon.Articles.scanDataTransferItems(e.dataTransfer.items);
                        window.Lexicon.Articles.addFilesToStaging(scanned);
                    } else if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const fileList = Array.from(e.dataTransfer.files).map(f => ({ file: f, path: f.name, folder: '' }));
                        window.Lexicon.Articles.addFilesToStaging(fileList);
                    }
                });
            }
        },

        setupShortcuts() {
            document.addEventListener('keydown', (e) => {
                const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
                const isTyping = activeTag === 'input' || activeTag === 'textarea';

                // Cmd/Ctrl + K => Focus Search
                if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                    e.preventDefault();
                    const searchInput = document.getElementById('search-input');
                    if (searchInput) {
                        searchInput.focus();
                        searchInput.select();
                    }
                }

                // Cmd/Ctrl + N => Add Document Modal (when not typing in form)
                if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !e.shiftKey && !isTyping) {
                    e.preventDefault();
                    window.Lexicon.UI.Modal.open('upload-modal');
                }

                // Esc => Close active modal
                if (e.key === 'Escape') {
                    const openModal = document.querySelector('.modal-overlay:not(.hidden)');
                    if (openModal) {
                        window.Lexicon.UI.Modal.close(openModal.id);
                    }
                }
            });
        },

        setupBackupControls() {
            const btnExport = document.getElementById('btn-export-backup');
            const fileImportInput = document.getElementById('import-file-input');

            if (btnExport) {
                btnExport.addEventListener('click', () => {
                    window.Lexicon.Storage.exportJSON();
                });
            }

            if (fileImportInput) {
                fileImportInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        window.Lexicon.Storage.importJSON(e.target.files[0]);
                        fileImportInput.value = '';
                    }
                });
            }
        },

        openSettingsModal(initialTab = 'general') {
            if (window.Lexicon.Librarian) {
                const endpointInput = document.getElementById('librarian-endpoint-input');
                if (endpointInput) endpointInput.value = window.Lexicon.Librarian.endpoint;
                window.Lexicon.Librarian.populateModelSelect();
                window.Lexicon.Librarian.updateBadgeUI();
            }
            this.switchSettingsTab(initialTab);
            if (window.Lexicon.I18n) {
                window.Lexicon.I18n.updateLanguageButtons();
            }
            window.Lexicon.UI.Modal.open('librarian-settings-modal');
        },

        switchSettingsTab(tabName) {
            document.querySelectorAll('.settings-tab-btn').forEach(btn => {
                const isActive = btn.dataset.tab === tabName;
                if (isActive) {
                    btn.classList.add('border-jungle', 'text-jungle');
                    btn.classList.remove('border-transparent', 'text-earth');
                } else {
                    btn.classList.remove('border-jungle', 'text-jungle');
                    btn.classList.add('border-transparent', 'text-earth');
                }
            });

            document.querySelectorAll('.settings-tab-panel').forEach(panel => {
                if (panel.id === `settings-panel-${tabName}`) {
                    panel.classList.remove('hidden');
                } else {
                    panel.classList.add('hidden');
                }
            });
        }
    };

    // Auto-bootstrap on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        window.Lexicon.App.init();
    });
})();
