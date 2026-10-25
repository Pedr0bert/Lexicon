/* ==========================================================================
   Lexicon - Central State Management
   Intelligent Document & Research File Manager
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

window.Lexicon.Utils = window.Lexicon.Utils || {
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
    const state = {
        articles: [],
        collections: [],
        currentFilter: { type: 'category', value: 'all', title: 'All Documents' },
        activeTag: null,
        searchQuery: '',
        viewMode: 'grid', // 'grid' | 'table'
        sortBy: 'date-desc', // 'date-desc' | 'date-asc' | 'title-asc' | 'year-desc'
        sidebarCollapsed: false,
        sidebarCollectionsCollapsed: false, // Whether the Collections section in sidebar is reduced
        expandedSidebarCollections: [], // Collection names currently expanded in sidebar tree
        expandedFolders: [], // Collection names currently expanded in Collections view
        inspectedArticleId: null, // Currently open in Overview/Inspector modal
        editingArticleId: null,
        selectedIds: [], // Array of article IDs currently selected for batch operations
        semanticFilter: null, // AI semantic search active filter object
        librarian: {
            endpoint: 'http://localhost:11434',
            selectedModel: 'qwen2.5-coder:1.5b',
            isOnline: false,
            availableModels: [],
            busy: false
        }
    };

    window.Lexicon.State = state;
})();
