/* ==========================================================================
   Lexicon - Storage & Local File Store Module
   IndexedDB holds the catalog, extracted text and the real binary documents.
   localStorage is only used as a fallback when IndexedDB is unavailable.
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    const STORAGE_KEY = 'lexicon_research_library_v2';
    const DB_NAME = 'LexiconFilesDB';
    const DB_VERSION = 3;
    const STORE_NAME = 'documents';
    const CATALOG_STORE_NAME = 'catalog_state';
    const TEXT_STORE_NAME = 'extracted_text';
    const CATALOG_KEY = 'main_state';
    const CHANNEL_NAME = 'lexicon-sync';
    const ORPHAN_GRACE_MS = 60 * 60 * 1000; // never purge files younger than 1h (multi-tab safety)

    const VALID_STATUS = ['inbox', 'reading', 'processing', 'archived'];
    const PLACEHOLDER_SUMMARIES = [/^Registered document\.?$/i, /^Imported document\.?$/i, /^Imported from folder ".*"\.?$/i];
    const PLACEHOLDER_AUTHORS = /^(unknown|desconhecido|unknown author)$/i;

    const U = () => window.Lexicon.Utils;
    const tr = (k, f, p) => U().tr(k, f, p);
    const toast = (msg, type) => {
        const UI = window.Lexicon.UI;
        if (UI && UI.Toast) UI.Toast.show(msg, type);
    };

    let dbPromise = null;
    let channel = null;
    const tabId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random());

    // Save coordination
    let saveChain = Promise.resolve();
    let savePending = false;
    let knownRev = 0;                // catalog revision this tab last loaded/saved
    let snapshot = new Map();        // id -> JSON of article as last loaded/saved
    let collectionsSnapshot = '[]';  // JSON of collections as last loaded/saved

    /* ------------------------------------------------------------------
       IndexedDB helpers
       ------------------------------------------------------------------ */
    function getDB() {
        if (!dbPromise) {
            dbPromise = new Promise((resolve) => {
                if (!window.indexedDB) {
                    console.warn('IndexedDB not supported in this browser.');
                    resolve(null);
                    return;
                }
                let request;
                try {
                    request = indexedDB.open(DB_NAME, DB_VERSION);
                } catch (e) {
                    console.error('IndexedDB open threw:', e);
                    resolve(null);
                    return;
                }
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    if (!db.objectStoreNames.contains(CATALOG_STORE_NAME)) db.createObjectStore(CATALOG_STORE_NAME);
                    if (!db.objectStoreNames.contains(TEXT_STORE_NAME)) db.createObjectStore(TEXT_STORE_NAME);
                };
                request.onsuccess = () => {
                    const db = request.result;
                    db.onversionchange = () => {
                        db.close();
                        dbPromise = null;
                        toast(tr('storage.versionChange', 'Lexicon foi atualizado em outra aba. Recarregue esta página.'), 'warning');
                    };
                    resolve(db);
                };
                request.onblocked = () => {
                    toast(tr('storage.blocked', 'Feche outras abas do Lexicon para concluir a atualização do banco de dados.'), 'warning');
                };
                request.onerror = (e) => {
                    console.error('IndexedDB open error:', e);
                    resolve(null);
                };
            });
        }
        return dbPromise;
    }

    /**
     * Run a transaction and resolve with the value of `work(stores)` once the
     * transaction COMPLETES. Rejects on error AND abort (e.g. QuotaExceededError).
     */
    async function runTx(storeNames, mode, work) {
        const db = await getDB();
        if (!db) throw new Error('IndexedDB unavailable');
        return new Promise((resolve, reject) => {
            let tx;
            try {
                tx = db.transaction(storeNames, mode);
            } catch (e) {
                reject(e);
                return;
            }
            const names = Array.isArray(storeNames) ? storeNames : [storeNames];
            const stores = names.map(n => tx.objectStore(n));
            let result;
            try {
                result = work(...stores);
            } catch (e) {
                try { tx.abort(); } catch (_) { /* ignore */ }
                reject(e);
                return;
            }
            tx.oncomplete = () => {
                if (typeof IDBRequest !== 'undefined' && result instanceof IDBRequest) {
                    resolve(result.result);
                } else {
                    resolve(result);
                }
            };
            tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction error'));
            tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
        });
    }

    function describeStorageError(err) {
        if (err && (err.name === 'QuotaExceededError' || /quota/i.test(err.message || ''))) {
            return tr('storage.quotaExceeded', 'Espaço de armazenamento do navegador esgotado. Libere espaço ou remova documentos.');
        }
        return (err && err.message) || String(err);
    }

    /* ------------------------------------------------------------------
       Data hygiene
       ------------------------------------------------------------------ */
    const str = (v) => (v === null || v === undefined) ? '' : String(v);

    function sanitizeArticle(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const a = Object.assign({}, raw);
        const idNum = Number(a.id);
        a.id = Number.isFinite(idNum) && idNum > 0 ? idNum : null;
        a.title = str(a.title).trim() || tr('academic.untitled', 'Sem título');
        a.authors = str(a.authors).trim();
        if (PLACEHOLDER_AUTHORS.test(a.authors)) a.authors = '';
        const y = parseInt(a.year, 10);
        a.year = Number.isFinite(y) && y > 0 && y < 3000 ? y : null;
        a.publication = str(a.publication).trim();
        a.doi = str(a.doi).trim();
        ['volume', 'issue', 'pages'].forEach(k => { a[k] = str(a[k]).trim(); });
        a.status = VALID_STATUS.includes(a.status) ? a.status : 'inbox';
        a.collection = (typeof a.collection === 'string' && a.collection.trim() && a.collection !== 'none') ? a.collection.trim() : null;
        a.tags = Array.isArray(a.tags)
            ? Array.from(new Set(a.tags.filter(t => typeof t === 'string' || typeof t === 'number').map(t => String(t).trim().replace(/^#/, '')).filter(Boolean)))
            : [];
        a.isFavorite = !!a.isFavorite;
        a.coverType = ['pdf', 'book', 'doc'].includes(a.coverType) ? a.coverType : 'pdf';
        a.fileName = str(a.fileName);
        a.fileSize = str(a.fileSize);
        a.filePath = str(a.filePath);
        a.summary = str(a.summary);
        if (PLACEHOLDER_SUMMARIES.some(re => re.test(a.summary.trim()))) a.summary = '';
        a.notes = str(a.notes);
        a.addedDate = /^\d{4}-\d{2}-\d{2}/.test(str(a.addedDate)) ? str(a.addedDate).slice(0, 10) : U().localDateStr();
        if (typeof a.extractedText !== 'string') delete a.extractedText;
        return a;
    }

    function sanitizeCollections(list) {
        const out = [];
        const seen = new Set();
        (Array.isArray(list) ? list : []).forEach(c => {
            const name = c && typeof c.name === 'string' ? c.name.trim() : (typeof c === 'string' ? c.trim() : '');
            if (!name || seen.has(name.toLowerCase())) return;
            seen.add(name.toLowerCase());
            out.push({ id: (c && typeof c.id === 'string' && c.id) ? c.id : U().newCollectionId(), name });
        });
        return out;
    }

    /** Sanitizes articles, resolves duplicate IDs, makes sure every used collection exists */
    function normalizeLibrary(articles, collections) {
        const cleanCols = sanitizeCollections(collections);
        const colNames = new Map(cleanCols.map(c => [c.name.toLowerCase(), c.name]));
        const seenIds = new Set();
        const out = [];
        let maxId = 0;
        const list = (Array.isArray(articles) ? articles : []).map(sanitizeArticle).filter(Boolean);
        list.forEach(a => { if (a.id && a.id > maxId) maxId = a.id; });
        list.forEach(a => {
            if (!a.id || seenIds.has(a.id)) {
                maxId = Math.max(maxId + 1, Date.now());
                a.id = maxId;
                a._fileDetached = true; // duplicate: its binary (if any) belongs to the first one
            }
            seenIds.add(a.id);
            if (a.collection) {
                const existing = colNames.get(a.collection.toLowerCase());
                if (existing) {
                    a.collection = existing;
                } else {
                    cleanCols.push({ id: U().newCollectionId(), name: a.collection });
                    colNames.set(a.collection.toLowerCase(), a.collection);
                }
            }
            out.push(a);
        });
        return { articles: out, collections: cleanCols };
    }

    /** Article as persisted in the catalog (extracted text lives in its own store) */
    function persistable(a) {
        const copy = Object.assign({}, a);
        delete copy.extractedText;
        delete copy._fileDetached;
        return copy;
    }

    const articleJSON = (a) => JSON.stringify(persistable(a));

    function takeSnapshot() {
        const state = window.Lexicon.State;
        snapshot = new Map(state.articles.map(a => [a.id, articleJSON(a)]));
        collectionsSnapshot = JSON.stringify(state.collections);
    }

    /**
     * 3-way merge: stored (written by another tab) + our local changes since `snapshot`.
     * Local additions/edits/deletions win for the articles we touched; everything else
     * comes from storage. Returns { articles, collections, changedFromRemote }.
     */
    function mergeWithStored(stored) {
        const state = window.Lexicon.State;
        const localById = new Map(state.articles.map(a => [a.id, a]));
        const storedArticles = Array.isArray(stored.articles) ? stored.articles : [];
        const result = [];
        const handled = new Set();
        let changedFromRemote = false;

        storedArticles.forEach(sa => {
            const id = sa.id;
            handled.add(id);
            const local = localById.get(id);
            const snap = snapshot.get(id);
            if (!local) {
                if (snap !== undefined) return; // deleted locally
                result.push(sa);                 // added remotely
                changedFromRemote = true;
                return;
            }
            const localJson = articleJSON(local);
            if (snap !== undefined && localJson !== snap) {
                // edited locally -> keep local (preserve in-memory extractedText)
                result.push(local);
            } else {
                if (JSON.stringify(sa) !== localJson) changedFromRemote = true;
                if (local.extractedText) sa.extractedText = local.extractedText;
                result.push(sa);
            }
        });

        // Local additions (not in snapshot, not in storage)
        state.articles.forEach(a => {
            if (!handled.has(a.id) && !snapshot.has(a.id)) result.push(a);
            else if (!handled.has(a.id) && snapshot.has(a.id)) changedFromRemote = true; // deleted remotely
        });

        const localColsJson = JSON.stringify(state.collections);
        let collections;
        if (localColsJson !== collectionsSnapshot) {
            // union: local list + any remote-only names
            const names = new Set(state.collections.map(c => c.name.toLowerCase()));
            collections = state.collections.slice();
            (stored.collections || []).forEach(c => {
                if (c && c.name && !names.has(c.name.toLowerCase())) {
                    collections.push(c);
                    names.add(c.name.toLowerCase());
                }
            });
        } else {
            collections = Array.isArray(stored.collections) ? stored.collections : state.collections;
            if (JSON.stringify(collections) !== localColsJson) changedFromRemote = true;
        }

        // Keep original ordering preference: newest first is done by sorting at render time
        return { articles: result, collections, changedFromRemote };
    }

    function rerenderAll() {
        const L = window.Lexicon;
        if (L.Collections) { L.Collections.render(); L.Collections.populateSelects(); }
        if (L.Articles) L.Articles.render();
    }

    async function readStoredCatalog() {
        const db = await getDB();
        if (!db) return null;
        try {
            return await runTx(CATALOG_STORE_NAME, 'readonly', store => store.get(CATALOG_KEY));
        } catch (e) {
            console.warn('Could not read catalog:', e);
            return null;
        }
    }

    async function loadAllTexts() {
        try {
            const db = await getDB();
            if (!db) return new Map();
            const [keys, values] = await Promise.all([
                runTx(TEXT_STORE_NAME, 'readonly', s => s.getAllKeys()),
                runTx(TEXT_STORE_NAME, 'readonly', s => s.getAll())
            ]);
            const map = new Map();
            (keys || []).forEach((k, i) => map.set(Number(k), values[i]));
            return map;
        } catch (e) {
            console.warn('Could not load extracted texts:', e);
            return new Map();
        }
    }

    function cloneDefaults() {
        return normalizeLibrary(structuredClone(defaultArticles), structuredClone(defaultCollections));
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
            authors: "Elena Tropica; David Thorne; S. Alvarez",
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
            authors: "J. H. Fungi; Marcus Vance",
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
            doi: "",
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
            authors: "A. Terra; Clara Kim; Robert Lang",
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

    function applyLibrary(lib, prefs) {
        const state = window.Lexicon.State;
        state.articles = lib.articles;
        state.collections = lib.collections;
        if (prefs) {
            state.viewMode = prefs.viewMode === 'table' ? 'table' : 'grid';
            state.sortBy = ['date-desc', 'date-asc', 'title-asc', 'year-desc'].includes(prefs.sortBy) ? prefs.sortBy : 'date-desc';
            state.sidebarCollapsed = !!prefs.sidebarCollapsed;
        }
    }

    window.Lexicon.Storage = {
        /* ------------------------------------------------------------------
           Binary files
           ------------------------------------------------------------------ */

        /**
         * Store a binary File/Blob. Resolves true on success, false on failure
         * (quota exceeded, IndexedDB missing...). Never hangs.
         */
        async storeFile(articleId, file) {
            try {
                await runTx(STORE_NAME, 'readwrite', store => store.put({
                    id: Number(articleId),
                    file: file,
                    name: file.name || 'document',
                    type: file.type || 'application/octet-stream',
                    size: file.size,
                    updatedAt: Date.now()
                }));
                this.requestPersistence();
                return true;
            } catch (err) {
                console.error('Failed to store file in IndexedDB:', err);
                toast(tr('storage.fileSaveError', 'Não foi possível salvar o arquivo "{name}": {error}', { name: file && file.name, error: describeStorageError(err) }), 'error');
                return false;
            }
        },

        async getFile(articleId) {
            try {
                const rec = await runTx(STORE_NAME, 'readonly', store => store.get(Number(articleId)));
                return rec && rec.file ? rec.file : null;
            } catch (err) {
                console.error('Error getting file from IndexedDB:', err);
                return null;
            }
        },

        async hasFile(articleId) {
            try {
                const key = await runTx(STORE_NAME, 'readonly', store => store.getKey(Number(articleId)));
                return key !== undefined;
            } catch (e) {
                return false;
            }
        },

        async deleteFile(articleId) {
            return this.deleteFiles([articleId]);
        },

        /** Deletes binaries and extracted texts for the given IDs (awaits completion) */
        async deleteFiles(ids) {
            const list = (ids || []).map(Number).filter(Number.isFinite);
            if (!list.length) return true;
            try {
                await runTx([STORE_NAME, TEXT_STORE_NAME], 'readwrite', (files, texts) => {
                    list.forEach(id => { files.delete(id); texts.delete(id); });
                });
                return true;
            } catch (err) {
                console.error('Error deleting files from IndexedDB:', err);
                return false;
            }
        },

        /** Persist extracted PDF text outside of the catalog */
        async setExtractedText(articleId, text) {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === Number(articleId));
            if (article) {
                if (text) article.extractedText = text;
                else delete article.extractedText;
            }
            try {
                await runTx(TEXT_STORE_NAME, 'readwrite', store => {
                    if (text) store.put(text, Number(articleId));
                    else store.delete(Number(articleId));
                });
            } catch (err) {
                console.warn('Could not persist extracted text:', err);
            }
        },

        /** Removes stored binaries that no longer belong to any article */
        async purgeOrphanFiles() {
            try {
                const db = await getDB();
                if (!db) return 0;
                const state = window.Lexicon.State;
                const valid = new Set(state.articles.map(a => Number(a.id)));
                const now = Date.now();
                let removed = 0;
                await runTx([STORE_NAME, TEXT_STORE_NAME], 'readwrite', (files, texts) => {
                    const cursorReq = files.openCursor();
                    cursorReq.onsuccess = () => {
                        const cursor = cursorReq.result;
                        if (!cursor) return;
                        const rec = cursor.value || {};
                        if (!valid.has(Number(cursor.key)) && (now - (rec.updatedAt || 0)) > ORPHAN_GRACE_MS) {
                            cursor.delete();
                            removed++;
                        }
                        cursor.continue();
                    };
                    const textReq = texts.openKeyCursor ? texts.openKeyCursor() : texts.openCursor();
                    textReq.onsuccess = () => {
                        const cursor = textReq.result;
                        if (!cursor) return;
                        if (!valid.has(Number(cursor.key))) texts.delete(cursor.key);
                        cursor.continue();
                    };
                });
                if (removed) console.info(`[Storage] Purged ${removed} orphan file(s).`);
                return removed;
            } catch (e) {
                console.warn('Orphan purge failed:', e);
                return 0;
            }
        },

        /** Ask the browser not to evict our data under storage pressure */
        async requestPersistence() {
            try {
                if (!navigator.storage || !navigator.storage.persist) return false;
                if (await navigator.storage.persisted()) return true;
                return await navigator.storage.persist();
            } catch (e) {
                return false;
            }
        },

        async getStorageEstimate() {
            try {
                if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate();
            } catch (e) { /* ignore */ }
            return null;
        },

        /* ------------------------------------------------------------------
           Catalog
           ------------------------------------------------------------------ */

        async load() {
            let loaded = false;
            try {
                const data = await readStoredCatalog();
                if (data && Array.isArray(data.articles)) {
                    applyLibrary(normalizeLibrary(data.articles, data.collections), data);
                    knownRev = Number(data.rev) || 0;
                    loaded = true;

                    // Hydrate extracted texts; migrate legacy inline texts out of the catalog
                    const texts = await loadAllTexts();
                    const legacy = [];
                    window.Lexicon.State.articles.forEach(a => {
                        if (a.extractedText) legacy.push([a.id, a.extractedText]);
                        else if (texts.has(a.id)) a.extractedText = texts.get(a.id);
                    });
                    for (const [id, text] of legacy) await this.setExtractedText(id, text);
                } else {
                    let stored = null;
                    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { stored = null; }
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        applyLibrary(normalizeLibrary(parsed.articles, parsed.collections), parsed);
                        loaded = true;
                    }
                }
            } catch (err) {
                console.warn('Could not read from storage, using default catalog:', err);
                toast(tr('storage.loadError', 'Não foi possível ler o acervo salvo: {error}', { error: describeStorageError(err) }), 'error');
            }

            if (!loaded) {
                applyLibrary(cloneDefaults(), null);
            }

            takeSnapshot();
            snapshot = new Map(); // force first save to write everything
            collectionsSnapshot = '';
            await this.save();

            this.setupSync();
            this.requestPersistence();
            // Clean up binaries left behind by older versions (deferred, non-blocking)
            setTimeout(() => this.purgeOrphanFiles(), 3000);
        },

        /**
         * Persist the catalog. Calls are serialized and coalesced; concurrent changes
         * from other tabs are merged instead of overwritten.
         * @returns {Promise<boolean>}
         */
        save() {
            if (savePending) return saveChain;
            savePending = true;
            saveChain = saveChain.then(async () => {
                savePending = false;
                return this._saveNow();
            });
            return saveChain;
        },

        async _saveNow() {
            const state = window.Lexicon.State;
            try {
                const db = await getDB();
                if (!db) {
                    const payload = {
                        version: 3,
                        articles: state.articles.map(persistable),
                        collections: state.collections,
                        viewMode: state.viewMode,
                        sortBy: state.sortBy,
                        sidebarCollapsed: state.sidebarCollapsed
                    };
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
                    takeSnapshot();
                    return true;
                }

                let mergedRemote = false;
                await runTx(CATALOG_STORE_NAME, 'readwrite', store => {
                    const getReq = store.get(CATALOG_KEY);
                    getReq.onsuccess = () => {
                        const stored = getReq.result;
                        const storedRev = stored ? (Number(stored.rev) || 0) : 0;
                        if (stored && storedRev > knownRev && Array.isArray(stored.articles)) {
                            const merged = mergeWithStored(stored);
                            state.articles = merged.articles;
                            state.collections = merged.collections;
                            mergedRemote = merged.changedFromRemote;
                        }
                        const rev = Math.max(storedRev, knownRev) + 1;
                        store.put({
                            version: 3,
                            rev,
                            savedAt: Date.now(),
                            savedBy: tabId,
                            articles: state.articles.map(persistable),
                            collections: state.collections,
                            viewMode: state.viewMode,
                            sortBy: state.sortBy,
                            sidebarCollapsed: state.sidebarCollapsed
                        }, CATALOG_KEY);
                        knownRev = rev;
                    };
                });
                takeSnapshot();
                if (channel) channel.postMessage({ type: 'catalog-saved', rev: knownRev, from: tabId });
                if (mergedRemote) rerenderAll();
                return true;
            } catch (err) {
                console.error('Failed to save catalog:', err);
                toast(tr('storage.saveError', 'Erro ao salvar o acervo: {error}', { error: describeStorageError(err) }), 'error');
                return false;
            }
        },

        /** Listen for saves from other tabs and merge them in */
        setupSync() {
            if (channel || typeof BroadcastChannel === 'undefined') return;
            try {
                channel = new BroadcastChannel(CHANNEL_NAME);
            } catch (e) {
                return;
            }
            channel.onmessage = async (ev) => {
                const msg = ev.data || {};
                if (msg.type !== 'catalog-saved' || msg.from === tabId || (msg.rev || 0) <= knownRev) return;
                const stored = await readStoredCatalog();
                if (!stored || !Array.isArray(stored.articles)) return;
                const merged = mergeWithStored(stored);
                const state = window.Lexicon.State;
                const hadLocalChanges = state.articles.some(a => snapshot.get(a.id) !== articleJSON(a)) ||
                    JSON.stringify(state.collections) !== collectionsSnapshot;
                state.articles = merged.articles;
                state.collections = merged.collections;
                knownRev = Number(stored.rev) || knownRev;
                if (hadLocalChanges) {
                    this.save(); // push our pending local edits on top
                } else {
                    takeSnapshot();
                }
                // Drop selections that no longer exist
                const ids = new Set(state.articles.map(a => a.id));
                state.selectedIds = (state.selectedIds || []).filter(id => ids.has(id));
                if (merged.changedFromRemote) rerenderAll();
            };
        },

        /* ------------------------------------------------------------------
           Backup / Restore
           ------------------------------------------------------------------ */

        _backupPayload() {
            const state = window.Lexicon.State;
            return {
                app: "Lexicon Intelligent Research Library Manager",
                version: 3,
                exportedAt: new Date().toISOString(),
                collections: state.collections,
                articles: state.articles.map(persistable)
            };
        },

        _download(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1500);
        },

        /** Catalog-only backup (metadata, notes, tags, collections) */
        exportJSON() {
            const jsonStr = JSON.stringify(this._backupPayload(), null, 2);
            this._download(new Blob([jsonStr], { type: "application/json" }), `lexicon_catalog_backup_${U().localDateStr()}.json`);
            toast(tr('toast.catalogExported', 'Catalog metadata exported successfully'), 'success');
        },

        /** Full backup: catalog + every stored binary document, as a .zip */
        async exportFullBackup() {
            if (typeof window.JSZip === 'undefined') {
                toast(tr('storage.zipUnavailable', 'Biblioteca ZIP indisponível; exportando apenas o catálogo.'), 'warning');
                this.exportJSON();
                return;
            }
            const state = window.Lexicon.State;
            toast(tr('storage.fullBackupStarted', 'Preparando backup completo...'), 'info');
            try {
                const zip = new window.JSZip();
                const payload = this._backupPayload();
                const fileIndex = {};
                for (const a of state.articles) {
                    const file = await this.getFile(a.id);
                    if (!file) continue;
                    const safe = String(file.name || a.fileName || 'document').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 120);
                    const path = `files/${a.id}_${safe}`;
                    zip.file(path, file);
                    fileIndex[a.id] = { path, name: file.name || a.fileName || safe, type: file.type || '' };
                }
                payload.files = fileIndex;
                zip.file('catalog.json', JSON.stringify(payload, null, 2));
                const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
                this._download(blob, `lexicon_full_backup_${U().localDateStr()}.zip`);
                toast(tr('storage.fullBackupDone', 'Backup completo exportado ({count} arquivos).', { count: Object.keys(fileIndex).length }), 'success');
            } catch (err) {
                console.error('Full backup failed:', err);
                toast(tr('storage.fullBackupError', 'Falha no backup completo: {error}', { error: describeStorageError(err) }), 'error');
            }
        },

        /**
         * Import a catalog (.json) or full backup (.zip). Offers merge (default) or replace.
         * @param {File} file
         */
        async importJSON(file) {
            const state = window.Lexicon.State;
            try {
                let data;
                let zip = null;
                const isZip = /\.zip$/i.test(file.name) || file.type === 'application/zip';
                if (isZip) {
                    if (typeof window.JSZip === 'undefined') throw new Error('JSZip not loaded');
                    zip = await window.JSZip.loadAsync(file);
                    const catalogEntry = zip.file('catalog.json');
                    if (!catalogEntry) throw new Error(tr('storage.zipNoCatalog', 'catalog.json não encontrado no backup'));
                    data = JSON.parse(await catalogEntry.async('string'));
                } else {
                    data = JSON.parse(await file.text());
                }

                if (!data || !Array.isArray(data.articles)) {
                    throw new Error(tr('storage.invalidBackup', 'Formato inválido: lista de artigos ausente'));
                }

                const incoming = normalizeLibrary(data.articles, data.collections);
                const n = incoming.articles.length;

                const merge = window.confirm(tr('storage.importMergeConfirm',
                    'Importar {count} documentos MESCLANDO com o acervo atual?\n\nOK = mesclar (mantém seus documentos atuais)\nCancelar = outras opções',
                    { count: n }));
                let replace = false;
                if (!merge) {
                    replace = window.confirm(tr('storage.importReplaceConfirm',
                        'SUBSTITUIR todo o acervo atual ({current} documentos) pelo backup?\nEsta ação apaga os documentos atuais e seus arquivos.',
                        { current: state.articles.length }));
                    if (!replace) return;
                }

                // Map of old (backup) id -> new local id
                const idMap = new Map();
                let finalArticles;
                let finalCollections;

                if (replace) {
                    await this.deleteFiles(state.articles.map(a => a.id));
                    state.articles = [];
                    incoming.articles.forEach(a => {
                        const oldId = a.id;
                        a.id = U().newArticleId();
                        idMap.set(oldId, a.id);
                        state.articles.push(a);
                    });
                    finalArticles = state.articles;
                    finalCollections = incoming.collections;
                } else {
                    const existingByKey = new Map(state.articles.map(a => [`${a.title.toLowerCase()}|${a.year || ''}|${(a.doi || '').toLowerCase()}`, a]));
                    finalArticles = state.articles.slice();
                    incoming.articles.forEach(a => {
                        const key = `${a.title.toLowerCase()}|${a.year || ''}|${(a.doi || '').toLowerCase()}`;
                        const existing = existingByKey.get(key);
                        if (existing) {
                            idMap.set(a.id, null); // duplicate: keep local copy
                            return;
                        }
                        const oldId = a.id;
                        a.id = U().newArticleId();
                        idMap.set(oldId, a.id);
                        finalArticles.push(a);
                        state.articles = finalArticles; // keeps newArticleId monotonic
                    });
                    const names = new Set(state.collections.map(c => c.name.toLowerCase()));
                    finalCollections = state.collections.slice();
                    incoming.collections.forEach(c => {
                        if (!names.has(c.name.toLowerCase())) {
                            finalCollections.push(c);
                            names.add(c.name.toLowerCase());
                        }
                    });
                }

                // Restore binaries from a full backup
                let restored = 0;
                if (zip && data.files && typeof data.files === 'object') {
                    for (const [oldId, info] of Object.entries(data.files)) {
                        const newId = idMap.get(Number(oldId));
                        if (!newId || !info || !info.path) continue;
                        const entry = zip.file(info.path);
                        if (!entry) continue;
                        const blob = await entry.async('blob');
                        const restoredFile = new File([blob], info.name || 'document', { type: info.type || '' });
                        if (await this.storeFile(newId, restoredFile)) restored++;
                    }
                }

                const lib = normalizeLibrary(finalArticles, finalCollections);
                state.articles = lib.articles;
                state.collections = lib.collections;
                state.selectedIds = [];
                state.inspectedArticleId = null;
                state.activeTag = null;
                state.semanticFilter = null;

                await this.save();
                rerenderAll();
                const added = Array.from(idMap.values()).filter(Boolean).length;
                toast(tr('toast.catalogImported', 'Imported {count} documents into catalog', { count: added }) +
                    (restored ? ` • ${tr('storage.filesRestored', '{count} arquivos restaurados', { count: restored })}` : ''), 'success');
            } catch (err) {
                console.error('Failed to import backup:', err);
                toast(tr('toast.importInvalidJson', 'Failed to import backup') + ': ' + describeStorageError(err), 'error');
            }
        },

        /**
         * Reset library to the default demo catalog (also wipes stored files)
         */
        async resetToDefaults() {
            const state = window.Lexicon.State;
            try {
                await runTx([STORE_NAME, TEXT_STORE_NAME], 'readwrite', (files, texts) => { files.clear(); texts.clear(); });
            } catch (e) {
                console.warn('Could not clear stored files:', e);
            }
            const lib = cloneDefaults();
            state.articles = lib.articles;
            state.collections = lib.collections;
            state.selectedIds = [];
            state.inspectedArticleId = null;
            state.activeTag = null;
            state.semanticFilter = null;
            state.searchQuery = '';
            await this.save();
            rerenderAll();
            toast(tr('reset.successToast', 'Library reset to default catalog'), 'info');
        },

        /* ------------------------------------------------------------------
           Multi-Step (3-Step) Reset Confirmation Wizard Flow
           ------------------------------------------------------------------ */
        currentResetStep: 1,

        openResetWizard() {
            this.currentResetStep = 1;
            const state = window.Lexicon.State;

            const countsEl = document.getElementById('reset-summary-counts');
            if (countsEl) {
                const docLabel = U().escapeHTML(tr('common.documents', 'Documents & Books'));
                const colLabel = U().escapeHTML(tr('nav.collectionsHeader', 'Collections'));
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
            const contents = [1, 2, 3].map(i => document.getElementById(`reset-step-${i}-content`));
            const dots = [1, 2, 3].map(i => document.getElementById(`reset-dot-${i}`));

            const backBtn = document.getElementById('reset-back-btn');
            const step1NextBtn = document.getElementById('reset-step1-next-btn');
            const step2NextBtn = document.getElementById('reset-step2-next-btn');
            const finalExecuteBtn = document.getElementById('reset-final-execute-btn');

            contents.forEach(c => c && c.classList.add('hidden'));
            [step1NextBtn, step2NextBtn, finalExecuteBtn].forEach(b => b && b.classList.add('hidden'));

            const indicatorText = {
                1: tr('reset.step1Indicator', 'Step 1 of 3: Safety Warning'),
                2: tr('reset.step2Indicator', 'Step 2 of 3: Acknowledge Erasure'),
                3: tr('reset.step3Indicator', 'Step 3 of 3: Final Confirmation')
            };
            if (stepIndicator) stepIndicator.textContent = indicatorText[step];
            if (contents[step - 1]) contents[step - 1].classList.remove('hidden');
            if (backBtn) backBtn.classList.toggle('hidden', step === 1);

            dots.forEach((dot, i) => {
                if (!dot) return;
                const n = i + 1;
                dot.className = 'wizard-step-circle ' + (n < step ? 'completed' : n === step ? 'active' : 'inactive');
            });

            if (step === 1 && step1NextBtn) step1NextBtn.classList.remove('hidden');
            if (step === 2) {
                if (step2NextBtn) step2NextBtn.classList.remove('hidden');
                this.updateResetStep2Button();
            }
            if (step === 3) {
                if (finalExecuteBtn) finalExecuteBtn.classList.remove('hidden');
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

        async executeReset() {
            const input = document.getElementById('reset-confirm-input');
            if (!input || input.value.trim().toUpperCase() !== 'RESET') {
                return;
            }
            window.Lexicon.UI.Modal.close('reset-modal');
            await this.resetToDefaults();
        }
    };

    // Internal hooks exposed for tests
    window.Lexicon.Storage._internal = { sanitizeArticle, normalizeLibrary, mergeWithStored };
})();
