/* ==========================================================================
   Lexicon - Storage & Local File Store Module
   Uses LocalStorage for metadata/catalog and IndexedDB for real binary documents
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    const STORAGE_KEY = 'lexicon_research_library_v2';
    const DB_NAME = 'LexiconFilesDB';
    const DB_VERSION = 2;
    const STORE_NAME = 'documents';
    const CATALOG_STORE_NAME = 'catalog_state';

    let dbPromise = null;

    /**
     * Initialize IndexedDB database for real local file storage
     */
    function getDB() {
        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                if (!window.indexedDB) {
                    console.warn('IndexedDB not supported in this browser.');
                    resolve(null);
                    return;
                }
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains(CATALOG_STORE_NAME)) {
                        db.createObjectStore(CATALOG_STORE_NAME);
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => {
                    console.error('IndexedDB open error:', e);
                    resolve(null);
                };
            });
        }
        return dbPromise;
    }

    const defaultCollections = [
        { id: "c1", name: "Ecology & Climate" },
        { id: "c2", name: "Computer Science" },
        { id: "c3", name: "Bioengineering" },
        { id: "c4", name: "Books & Monographs" }
    ];

    const defaultArticles = [
        {
            id: 1700000001,
            title: "Canopy Ecology and Systems Dynamics in Humid Tropical Forests",
            authors: "Elena Tropica, David Thorne, S. Alvarez",
            year: 2024,
            publication: "Journal of Tropical Forest Science",
            doi: "10.1016/j.jtfsci.2024.01.004",
            status: "reading",
            collection: "Ecology & Climate",
            tags: ["Ecology", "Canopy", "Amazon", "Sensors"],
            addedDate: "2024-01-15",
            isFavorite: true,
            coverType: "pdf",
            fileName: "Canopy_Ecology_Systems_Dynamics_2024.pdf",
            fileSize: "4.8 MB",
            filePath: "~/Documents/Research/Ecology/Canopy_Ecology_Systems_Dynamics_2024.pdf",
            summary: "The complexity of ecological networks in tropical rainforests presents a unique challenge for systems biology. Using longitudinal sensor networks deployed across 500 hectares of primary Amazonian rainforest, this paper demonstrates that microclimate buffering provided by intact canopy cover reduces mean daytime temperature extremes by up to 4.2°C compared to fragmented edges. Epiphyte communities act as critical moisture reservoirs during prolonged dry spells.",
            notes: "> \"Microclimate buffering provided by intact canopy cover reduced mean daytime temperature extremes by up to 4.2°C.\"\n\nKey takeaway: Forest fragmentation directly impacts epiphyte survival rates. Sensor data shows high correlation with VOC flux."
        },
        {
            id: 1700000002,
            title: "Mycelial Algorithms for Distributed Fault-Tolerant Computing",
            authors: "J. H. Fungi, Marcus Vance",
            year: 2023,
            publication: "ACM Transactions on Autonomous Systems",
            doi: "10.1145/3548902.3548921",
            status: "processing",
            collection: "Computer Science",
            tags: ["Biomimicry", "Networks", "Distributed-Systems", "Algorithms"],
            addedDate: "2023-11-02",
            isFavorite: true,
            coverType: "pdf",
            fileName: "Mycelial_Algorithms_Distributed_Systems.pdf",
            fileSize: "2.1 MB",
            filePath: "~/Dev/Playground/papers/Mycelial_Algorithms_Distributed_Systems.pdf",
            summary: "By observing the adaptive anastomoses and resource transport behavior in fungal mycelial networks, this study derives novel shortest-path heuristics for distributed cloud architectures. Experiments demonstrate a 14% latency reduction during peak load bursts while sustaining 99.98% packet delivery under random 30% node deactivation without centralized coordination.",
            notes: "> \"Decentralized biological transport systems optimize trade-offs between construction cost, transport efficiency, and fault tolerance without any centralized control mechanism.\"\n\nCompare with Dijkstra and A* algorithms for dynamic topological reconfiguration."
        },
        {
            id: 1700000003,
            title: "Designing Data-Intensive Applications: The Big Ideas Behind Reliable Systems",
            authors: "Martin Kleppmann",
            year: 2017,
            publication: "O'Reilly Media",
            doi: "978-1449373320",
            status: "reading",
            collection: "Books & Monographs",
            tags: ["Book", "Systems", "Database", "Architecture"],
            addedDate: "2023-10-10",
            isFavorite: true,
            coverType: "book",
            fileName: "Designing_Data_Intensive_Applications.pdf",
            fileSize: "18.4 MB",
            filePath: "~/Books/Tech/Designing_Data_Intensive_Applications.pdf",
            summary: "A foundational text on the principles, algorithms, and trade-offs of data storage and processing systems. Covers replication, partitioning, transactions, consensus, batch processing, and stream processing.",
            notes: "Chapter 5: Single-leader replication vs. multi-leader and leaderless replication (Dynamo-style). Note the tradeoffs in eventual consistency vs write conflicts."
        },
        {
            id: 1700000004,
            title: "Rhizosphere Microbiome Metagenomics Under Prolonged Drought Stress",
            authors: "A. Terra, Clara Kim, Robert Lang",
            year: 2023,
            publication: "Nature Microbiology Reviews",
            doi: "10.1038/s41564-023-01420-x",
            status: "inbox",
            collection: "Bioengineering",
            tags: ["Microbiome", "Soil", "Genomics", "Drought"],
            addedDate: "2023-09-20",
            isFavorite: false,
            coverType: "pdf",
            fileName: "Rhizosphere_Microbiome_Metagenomics_2023.pdf",
            fileSize: "3.7 MB",
            filePath: "~/Documents/Lab/Genomics/Rhizosphere_Microbiome_Metagenomics_2023.pdf",
            summary: "Metagenomic profiling of rhizosphere soils along progressive aridity gradients reveals a marked shift from oligotrophic communities toward actinobacteria possessing osmoprotectant biosynthesis genes, altering terrestrial carbon turnover pathways.",
            notes: ""
        }
    ];

    window.Lexicon.Storage = {
        /**
         * Store actual binary file (File / Blob) in IndexedDB
         * @param {number|string} articleId
         * @param {File|Blob} file
         */
        async storeFile(articleId, file) {
            try {
                const db = await getDB();
                if (!db) return false;
                return new Promise((resolve) => {
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    store.put({
                        id: Number(articleId),
                        file: file,
                        name: file.name,
                        type: file.type || 'application/pdf',
                        size: file.size,
                        updatedAt: Date.now()
                    });
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = (e) => {
                        console.error('Error saving file to IndexedDB:', e);
                        resolve(false);
                    };
                });
            } catch (err) {
                console.error('Failed to store file in IndexedDB:', err);
                return false;
            }
        },

        /**
         * Retrieve binary file from IndexedDB
         * @param {number|string} articleId
         * @returns {Promise<File|Blob|null>}
         */
        async getFile(articleId) {
            try {
                const db = await getDB();
                if (!db) return null;
                return new Promise((resolve) => {
                    const tx = db.transaction(STORE_NAME, 'readonly');
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.get(Number(articleId));
                    req.onsuccess = () => {
                        if (req.result && req.result.file) {
                            resolve(req.result.file);
                        } else {
                            resolve(null);
                        }
                    };
                    req.onerror = () => resolve(null);
                });
            } catch (err) {
                console.error('Error getting file from IndexedDB:', err);
                return null;
            }
        },

        /**
         * Delete stored file from IndexedDB
         * @param {number|string} articleId
         */
        async deleteFile(articleId) {
            try {
                const db = await getDB();
                if (!db) return;
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).delete(Number(articleId));
            } catch (err) {
                console.error('Error deleting file from IndexedDB:', err);
            }
        },

        /**
         * Load library catalog metadata from IndexedDB or fallback to localStorage
         */
        async load() {
            const state = window.Lexicon.State;
            try {
                const db = await getDB();
                if (db) {
                    const data = await new Promise((resolve) => {
                        const tx = db.transaction(CATALOG_STORE_NAME, 'readonly');
                        const store = tx.objectStore(CATALOG_STORE_NAME);
                        const req = store.get('main_state');
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => resolve(null);
                    });
                    
                    if (data) {
                        state.articles = Array.isArray(data.articles) ? data.articles : defaultArticles;
                        state.collections = Array.isArray(data.collections) ? data.collections : defaultCollections;
                        state.viewMode = data.viewMode || 'grid';
                        state.sortBy = data.sortBy || 'date-desc';
                        state.sidebarCollapsed = !!data.sidebarCollapsed;
                        return;
                    }
                }

                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    state.articles = Array.isArray(parsed.articles) ? parsed.articles : defaultArticles;
                    state.collections = Array.isArray(parsed.collections) ? parsed.collections : defaultCollections;
                    state.viewMode = parsed.viewMode || 'grid';
                    state.sortBy = parsed.sortBy || 'date-desc';
                    state.sidebarCollapsed = !!parsed.sidebarCollapsed;
                    
                    // Migrate to IndexedDB
                    this.save();
                    return;
                }
            } catch (err) {
                console.warn('Could not read from storage, using default catalog:', err);
            }

            // Default seed
            state.articles = structuredClone(defaultArticles);
            state.collections = structuredClone(defaultCollections);
            this.save();
        },

        /**
         * Persist current metadata catalog to IndexedDB
         */
        async save() {
            const state = window.Lexicon.State;
            const payload = {
                version: 2,
                articles: state.articles,
                collections: state.collections,
                viewMode: state.viewMode,
                sortBy: state.sortBy,
                sidebarCollapsed: state.sidebarCollapsed
            };
            
            try {
                const db = await getDB();
                if (db) {
                    await new Promise((resolve, reject) => {
                        const tx = db.transaction(CATALOG_STORE_NAME, 'readwrite');
                        const store = tx.objectStore(CATALOG_STORE_NAME);
                        const req = store.put(payload, 'main_state');
                        req.onsuccess = () => resolve();
                        req.onerror = () => reject(req.error);
                    });
                } else {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
                }
            } catch (err) {
                console.error('Failed to save state to IndexedDB:', err);
                if (window.Lexicon.UI && window.Lexicon.UI.Toast) {
                    window.Lexicon.UI.Toast.show('Storage error: ' + err.message, 'error');
                }
            }
        },

        /**
         * Export catalog and notes as a portable JSON file
         */
        exportJSON() {
            const state = window.Lexicon.State;
            const backupData = {
                app: "Lexicon Intelligent Research Library Manager",
                version: 2,
                exportedAt: new Date().toISOString(),
                collections: state.collections,
                articles: state.articles
            };

            const jsonStr = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const dateStr = new Date().toISOString().split('T')[0];
            a.href = url;
            a.download = `lexicon_catalog_backup_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.Lexicon.UI.Toast.show(window.Lexicon.I18n ? window.Lexicon.I18n.t('toast.catalogExported') : 'Catalog metadata exported successfully', 'success');
        },

        /**
         * Import catalog data from a JSON file
         * @param {File} file
         */
        async importJSON(file) {
            try {
                const text = await file.text();
                const data = JSON.parse(text);

                if (!data.articles || !Array.isArray(data.articles)) {
                    throw new Error('Invalid file format: missing articles array');
                }

                const state = window.Lexicon.State;
                state.articles = data.articles;
                if (Array.isArray(data.collections)) {
                    state.collections = data.collections;
                }

                this.save();
                window.Lexicon.Collections.render();
                window.Lexicon.Collections.populateSelects();
                window.Lexicon.Articles.render();
                window.Lexicon.UI.Toast.show(
                    window.Lexicon.I18n 
                        ? window.Lexicon.I18n.t('toast.catalogImported', { count: data.articles.length })
                        : `Imported ${data.articles.length} documents into catalog`,
                    'success'
                );
            } catch (err) {
                console.error('Failed to import JSON file:', err);
                window.Lexicon.UI.Toast.show(
                    (window.Lexicon.I18n ? window.Lexicon.I18n.t('toast.importInvalidJson') : 'Failed to import backup') + ': ' + err.message,
                    'error'
                );
            }
        },

        /**
         * Reset library to default demo catalog
         */
        resetToDefaults() {
            const state = window.Lexicon.State;
            state.articles = structuredClone(defaultArticles);
            state.collections = structuredClone(defaultCollections);
            state.selectedIds = [];
            this.save();
            window.Lexicon.Collections.render();
            window.Lexicon.Collections.populateSelects();
            window.Lexicon.Articles.render();
            window.Lexicon.UI.Toast.show(
                window.Lexicon.I18n ? window.Lexicon.I18n.t('reset.successToast') : 'Library reset to default catalog',
                'info'
            );
        },

        /* ------------------------------------------------------------------
           Multi-Step (3-Step) Reset Confirmation Wizard Flow
           ------------------------------------------------------------------ */
        currentResetStep: 1,

        openResetWizard() {
            this.currentResetStep = 1;
            const state = window.Lexicon.State;

            // Populate counts for Step 2
            const countsEl = document.getElementById('reset-summary-counts');
            if (countsEl) {
                const docLabel = window.Lexicon.I18n ? window.Lexicon.I18n.t('common.documents') : 'Documents & Books';
                const colLabel = window.Lexicon.I18n ? window.Lexicon.I18n.t('nav.collectionsHeader') : 'Collections';
                countsEl.innerHTML = `
                    <div class="bg-sand p-2 rounded-lg border border-wood/60">
                        <span class="font-bold text-soil text-sm">${state.articles.length}</span>
                        <span class="text-earth text-[11px] block">${docLabel}</span>
                    </div>
                    <div class="bg-sand p-2 rounded-lg border border-wood/60">
                        <span class="font-bold text-soil text-sm">${state.collections.length}</span>
                        <span class="text-earth text-[11px] block">${colLabel}</span>
                    </div>
                `;
            }

            const ackCheckbox = document.getElementById('reset-ack-checkbox');
            if (ackCheckbox) ackCheckbox.checked = false;

            const confirmInput = document.getElementById('reset-confirm-input');
            if (confirmInput) confirmInput.value = '';

            this.goToResetStep(1);
            window.Lexicon.UI.Modal.open('reset-modal');
        },

        goToResetStep(step) {
            this.currentResetStep = step;

            const stepIndicator = document.getElementById('reset-step-indicator');
            const step1Content = document.getElementById('reset-step-1-content');
            const step2Content = document.getElementById('reset-step-2-content');
            const step3Content = document.getElementById('reset-step-3-content');

            const dot1 = document.getElementById('reset-dot-1');
            const dot2 = document.getElementById('reset-dot-2');
            const dot3 = document.getElementById('reset-dot-3');

            const backBtn = document.getElementById('reset-back-btn');
            const step1NextBtn = document.getElementById('reset-step1-next-btn');
            const step2NextBtn = document.getElementById('reset-step2-next-btn');
            const finalExecuteBtn = document.getElementById('reset-final-execute-btn');

            // Hide all contents first
            if (step1Content) step1Content.classList.add('hidden');
            if (step2Content) step2Content.classList.add('hidden');
            if (step3Content) step3Content.classList.add('hidden');

            if (step1NextBtn) step1NextBtn.classList.add('hidden');
            if (step2NextBtn) step2NextBtn.classList.add('hidden');
            if (finalExecuteBtn) finalExecuteBtn.classList.add('hidden');

            if (step === 1) {
                if (stepIndicator) stepIndicator.textContent = window.Lexicon.I18n ? window.Lexicon.I18n.t('reset.step1Indicator') : 'Step 1 of 3: Safety Warning';
                if (step1Content) step1Content.classList.remove('hidden');
                if (step1NextBtn) step1NextBtn.classList.remove('hidden');
                if (backBtn) backBtn.classList.add('hidden');

                if (dot1) dot1.className = 'wizard-step-circle active';
                if (dot2) dot2.className = 'wizard-step-circle inactive';
                if (dot3) dot3.className = 'wizard-step-circle inactive';
            } else if (step === 2) {
                if (stepIndicator) stepIndicator.textContent = window.Lexicon.I18n ? window.Lexicon.I18n.t('reset.step2Indicator') : 'Step 2 of 3: Acknowledge Erasure';
                if (step2Content) step2Content.classList.remove('hidden');
                if (step2NextBtn) step2NextBtn.classList.remove('hidden');
                if (backBtn) backBtn.classList.remove('hidden');

                if (dot1) dot1.className = 'wizard-step-circle completed';
                if (dot2) dot2.className = 'wizard-step-circle active';
                if (dot3) dot3.className = 'wizard-step-circle inactive';

                this.updateResetStep2Button();
            } else if (step === 3) {
                if (stepIndicator) stepIndicator.textContent = window.Lexicon.I18n ? window.Lexicon.I18n.t('reset.step3Indicator') : 'Step 3 of 3: Final Confirmation';
                if (step3Content) step3Content.classList.remove('hidden');
                if (finalExecuteBtn) finalExecuteBtn.classList.remove('hidden');
                if (backBtn) backBtn.classList.remove('hidden');

                if (dot1) dot1.className = 'wizard-step-circle completed';
                if (dot2) dot2.className = 'wizard-step-circle completed';
                if (dot3) dot3.className = 'wizard-step-circle active';

                this.checkResetVerification();
                setTimeout(() => {
                    const input = document.getElementById('reset-confirm-input');
                    if (input) input.focus();
                }, 100);
            }
        },

        resetStepBack() {
            if (this.currentResetStep > 1) {
                this.goToResetStep(this.currentResetStep - 1);
            }
        },

        updateResetStep2Button() {
            const checkbox = document.getElementById('reset-ack-checkbox');
            const nextBtn = document.getElementById('reset-step2-next-btn');
            if (!checkbox || !nextBtn) return;

            if (checkbox.checked) {
                nextBtn.disabled = false;
                nextBtn.className = 'px-4 py-2 bg-terracotta hover:bg-[#c9664c] text-white rounded-xl text-xs font-semibold transition-colors shadow-sm cursor-pointer';
            } else {
                nextBtn.disabled = true;
                nextBtn.className = 'px-4 py-2 bg-terracotta/50 text-white/80 rounded-xl text-xs font-semibold transition-colors shadow-sm cursor-not-allowed';
            }
        },

        checkResetVerification() {
            const input = document.getElementById('reset-confirm-input');
            const finalBtn = document.getElementById('reset-final-execute-btn');
            if (!input || !finalBtn) return;

            const isMatch = input.value.trim().toUpperCase() === 'RESET';
            if (isMatch) {
                finalBtn.disabled = false;
                finalBtn.className = 'px-4 py-2 bg-terracotta hover:bg-[#b04b32] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer animate-pulse';
            } else {
                finalBtn.disabled = true;
                finalBtn.className = 'px-4 py-2 bg-terracotta/50 text-white/80 rounded-xl text-xs font-semibold transition-colors shadow-sm cursor-not-allowed';
            }
        },

        executeReset() {
            const input = document.getElementById('reset-confirm-input');
            if (!input || input.value.trim().toUpperCase() !== 'RESET') {
                return;
            }

            this.resetToDefaults();
            window.Lexicon.UI.Modal.close('reset-modal');
        }
    };
})();
