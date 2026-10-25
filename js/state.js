/* ==========================================================================
   Lexicon - Central State Management & Shared Utilities
   Intelligent Document & Research File Manager
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    const pad2 = (n) => String(n).padStart(2, '0');
    let lastIssuedId = 0;

    window.Lexicon.Utils = {
        /**
         * Escape a value for safe interpolation into HTML text AND quoted attributes.
         */
        escapeHTML(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/`/g, '&#96;');
        },

        /**
         * Display helper: returns escaped value, or the (escaped) fallback when the
         * value is null/undefined/empty. Avoids rendering "undefined"/"null".
         */
        display(value, fallback = '') {
            if (value === null || value === undefined) return this.escapeHTML(fallback);
            const s = String(value).trim();
            if (!s || s === 'undefined' || s === 'null') return this.escapeHTML(fallback);
            return this.escapeHTML(s);
        },

        /**
         * i18n lookup with fallback text (I18n.t returns the key itself when missing).
         */
        tr(key, fallback, params) {
            const I = window.Lexicon.I18n;
            if (I && typeof I.t === 'function') {
                const v = I.t(key, params);
                if (typeof v === 'string' && v !== key) return v;
            }
            return String(fallback === undefined ? key : fallback)
                .replace(/\{(\w+)\}/g, (_, k) => (params && params[k] !== undefined) ? params[k] : `{${k}}`);
        },

        /** Local calendar date as YYYY-MM-DD (never UTC-shifted). */
        localDateStr(d = new Date()) {
            return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
        },

        /** Parse 'YYYY-MM-DD' as a LOCAL date; other formats parsed natively. */
        parseLocalDate(value) {
            if (!value) return null;
            const m = String(value).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
            return isNaN(d.getTime()) ? null : d;
        },

        /**
         * Unique, monotonically increasing numeric document ID.
         * Never collides with existing articles nor with IDs issued earlier in this session.
         */
        newArticleId() {
            const state = window.Lexicon.State;
            let maxExisting = 0;
            if (state && Array.isArray(state.articles)) {
                for (const a of state.articles) {
                    const n = Number(a && a.id);
                    if (Number.isFinite(n) && n > maxExisting) maxExisting = n;
                }
            }
            const id = Math.max(Date.now(), lastIssuedId + 1, maxExisting + 1);
            lastIssuedId = id;
            return id;
        },

        /** Unique collection ID */
        newCollectionId() {
            const rnd = (window.crypto && crypto.randomUUID) ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
            return `c_${Date.now()}_${rnd}`;
        },

        /**
         * Returns a safe http(s) URL or '' (blocks javascript:, data:, etc.).
         */
        safeUrl(url) {
            if (!url) return '';
            try {
                const u = new URL(String(url).trim(), window.location.href);
                return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '';
            } catch (e) {
                return '';
            }
        },

        /** Resolvable link for a DOI / arXiv id / URL stored in the "doi" field. */
        doiHref(doi) {
            if (!doi) return '';
            const A = window.Lexicon.Academic;
            if (A && typeof A.doiToUrl === 'function') return this.safeUrl(A.doiToUrl(doi));
            const raw = String(doi).trim();
            if (/^https?:\/\//i.test(raw)) return this.safeUrl(raw);
            if (/arxiv/i.test(raw) || /^\d{4}\.\d{4,5}/.test(raw)) {
                return this.safeUrl(`https://arxiv.org/abs/${raw.replace(/^arxiv:\s*/i, '').replace(/^10\.48550\/arxiv\./i, '')}`);
            }
            return this.safeUrl('https://doi.org/' + encodeURI(raw));
        },

        /** Human readable file size */
        formatBytes(bytes) {
            const n = Number(bytes);
            if (!Number.isFinite(n) || n <= 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.min(sizes.length - 1, Math.floor(Math.log(n) / Math.log(k)));
            return parseFloat((n / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        },

        /** Lowercase + strip diacritics, for accent-insensitive search */
        fold(str) {
            return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        },

        /** Lowercased file extension without dot */
        fileExt(name) {
            const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
            return m ? m[1] : '';
        }
    };

    const state = {
        articles: [],
        collections: [],
        currentFilter: { type: 'category', value: 'all', title: 'All Documents' },
        activeTag: null,
        searchQuery: '',
        viewMode: 'grid', // 'grid' | 'table'
        sortBy: 'date-desc', // 'date-desc' | 'date-asc' | 'title-asc' | 'year-desc'
        sidebarCollapsed: false,
        sidebarCollectionsCollapsed: false,
        expandedSidebarCollections: [],
        expandedFolders: null, // null = not initialised yet (all expanded on first visit)
        inspectedArticleId: null,
        editingArticleId: null,
        selectedIds: [],
        semanticFilter: null
    };

    window.Lexicon.State = state;
})();
