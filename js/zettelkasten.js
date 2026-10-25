/* ==========================================================================
   Lexicon - Zettelkasten & Connected Notes Module
   Handles [[Wikilinks]] autocomplete, rendering, and Reverse Citations (Backlinks)
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    let activeDropdown = null;
    let selectedIndex = 0;
    let currentMatches = [];
    let activeTextarea = null;
    let currentMatchStart = -1;

    /**
     * Create floating autocomplete container if not already in DOM
     */
    function getOrCreateDropdown() {
        let el = document.getElementById('wikilinks-autocomplete-popup');
        if (!el) {
            el = document.createElement('div');
            el.id = 'wikilinks-autocomplete-popup';
            el.className = 'fixed hidden z-[9999] w-80 max-h-60 overflow-y-auto bg-paper border border-wood rounded-xl shadow-2xl p-1.5 text-xs text-soil';
            document.body.appendChild(el);

            // Prevent mousedown on dropdown from blurring textarea
            el.addEventListener('mousedown', (e) => e.preventDefault());
        }
        return el;
    }

    /**
     * Hide autocomplete dropdown
     */
    function hideDropdown() {
        const el = document.getElementById('wikilinks-autocomplete-popup');
        if (el) {
            el.classList.add('hidden');
            el.innerHTML = '';
        }
        activeDropdown = null;
        currentMatches = [];
        selectedIndex = 0;
        activeTextarea = null;
        currentMatchStart = -1;
    }

    /**
     * Render dropdown suggestions
     */
    function renderDropdown(matches, query, textarea) {
        const el = getOrCreateDropdown();
        activeDropdown = el;
        currentMatches = matches;
        activeTextarea = textarea;

        if (matches.length === 0) {
            el.innerHTML = `
                <div class="px-3 py-2 text-earth/70 italic text-[11px]">
                    Nenhum documento encontrado para "${window.Lexicon.Utils.escapeHTML(query)}"
                </div>
            `;
        } else {
            el.innerHTML = `
                <div class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-earth/70 border-b border-wood/50 flex justify-between">
                    <span>Conectar Documento ([[Wikilink]])</span>
                    <span class="text-[9px] font-mono">↑↓ Enter</span>
                </div>
                <div class="py-1 space-y-0.5">
                    ${matches.map((art, idx) => {
                        const isSelected = idx === selectedIndex;
                        const safeTitle = window.Lexicon.Utils.escapeHTML(art.title || 'Sem título');
                        const safeAuthor = window.Lexicon.Utils.escapeHTML(art.authors ? ` • ${art.authors}` : '');
                        const safeYear = art.year ? ` (${art.year})` : '';
                        return `
                            <div class="wikilink-item px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-2 ${isSelected ? 'bg-jungle text-white font-semibold' : 'hover:bg-sand text-soil'}"
                                 data-index="${idx}">
                                <i class="ph ph-file-text text-sm shrink-0 ${isSelected ? 'text-white' : 'text-jungle'}"></i>
                                <div class="min-w-0 flex-1">
                                    <div class="truncate text-xs">${safeTitle}</div>
                                    <div class="truncate text-[10px] ${isSelected ? 'text-white/80' : 'text-earth/80'}">${safeYear}${safeAuthor}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

            // Click listener on item
            el.querySelectorAll('.wikilink-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const idx = Number(item.dataset.index);
                    insertSelectedWikilink(idx);
                });
            });
        }

        // Position popup near textarea
        positionDropdown(textarea);
        el.classList.remove('hidden');
    }

    /**
     * Approximate positioning near cursor
     */
    function positionDropdown(textarea) {
        const el = getOrCreateDropdown();
        const rect = textarea.getBoundingClientRect();
        
        let top = rect.bottom + 4;
        let left = rect.left + 10;

        // Ensure within viewport
        if (top + 220 > window.innerHeight) {
            top = Math.max(10, rect.top - 230);
        }
        if (left + 320 > window.innerWidth) {
            left = window.innerWidth - 330;
        }

        el.style.top = `${top}px`;
        el.style.left = `${left}px`;
    }

    /**
     * Insert chosen wikilink into textarea
     */
    function insertSelectedWikilink(idx) {
        if (!activeTextarea || !currentMatches[idx]) return;
        const article = currentMatches[idx];
        const textarea = activeTextarea;
        const val = textarea.value;
        const cursor = textarea.selectionStart;

        // Identify insertion start
        const prefix = val.substring(0, cursor);
        const match = prefix.match(/(?:^|\s)\[\[([^\]\n]*)$/);
        if (!match) return;

        const matchStartIndex = prefix.lastIndexOf('[[');
        const replacement = `[[${article.title}]] `;

        textarea.value = val.substring(0, matchStartIndex) + replacement + val.substring(cursor);
        const newCursorPos = matchStartIndex + replacement.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();

        // Trigger input event to fire auto-save
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        hideDropdown();
    }

    window.Lexicon.Zettelkasten = {
        init() {
            // Global click listener to close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (activeDropdown && !activeDropdown.contains(e.target) && e.target !== activeTextarea) {
                    hideDropdown();
                }
            });

            // Global click handler for rendered wikilinks
            document.addEventListener('click', (e) => {
                const badge = e.target.closest('[data-wikilink-target]');
                if (badge) {
                    e.preventDefault();
                    e.stopPropagation();
                    const target = badge.dataset.wikilinkTarget;
                    this.navigateToArticle(target);
                }
            });
        },

        /**
         * Attach autocomplete listeners to a textarea
         * @param {HTMLTextAreaElement} textarea
         */
        attach(textarea) {
            if (!textarea || textarea.dataset.wikilinksAttached) return;
            textarea.dataset.wikilinksAttached = 'true';

            textarea.addEventListener('input', (e) => {
                const val = textarea.value;
                const cursor = textarea.selectionStart;
                const prefix = val.substring(0, cursor);

                // Check for unclosed [[ before cursor
                const match = prefix.match(/(?:^|\s)\[\[([^\]\n]*)$/);
                if (match) {
                    const query = match[1].trim().toLowerCase();
                    const state = window.Lexicon.State;
                    const allArticles = state.articles || [];

                    const filtered = allArticles.filter(art => {
                        const title = (art.title || '').toLowerCase();
                        const authors = (art.authors || '').toLowerCase();
                        const idStr = String(art.id);
                        return !query || title.includes(query) || authors.includes(query) || idStr.includes(query);
                    }).slice(0, 8);

                    selectedIndex = 0;
                    renderDropdown(filtered, query, textarea);
                } else {
                    hideDropdown();
                }
            });

            textarea.addEventListener('keydown', (e) => {
                if (!activeDropdown || activeDropdown.classList.contains('hidden')) return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedIndex = (selectedIndex + 1) % Math.max(1, currentMatches.length);
                    this.updateDropdownSelection();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedIndex = (selectedIndex - 1 + currentMatches.length) % Math.max(1, currentMatches.length);
                    this.updateDropdownSelection();
                } else if (e.key === 'Enter' || e.key === 'Tab') {
                    if (currentMatches.length > 0) {
                        e.preventDefault();
                        insertSelectedWikilink(selectedIndex);
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    hideDropdown();
                }
            });

            textarea.addEventListener('blur', () => {
                // Short timeout to allow click events inside dropdown to resolve
                setTimeout(() => {
                    if (activeDropdown && !activeDropdown.matches(':hover')) {
                        hideDropdown();
                    }
                }, 200);
            });
        },

        updateDropdownSelection() {
            const el = document.getElementById('wikilinks-autocomplete-popup');
            if (!el) return;
            el.querySelectorAll('.wikilink-item').forEach((item, idx) => {
                const isSelected = idx === selectedIndex;
                if (isSelected) {
                    item.className = 'wikilink-item px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-2 bg-jungle text-white font-semibold';
                    const icon = item.querySelector('i');
                    if (icon) icon.className = 'ph ph-file-text text-sm shrink-0 text-white';
                    item.scrollIntoView({ block: 'nearest' });
                } else {
                    item.className = 'wikilink-item px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-2 hover:bg-sand text-soil';
                    const icon = item.querySelector('i');
                    if (icon) icon.className = 'ph ph-file-text text-sm shrink-0 text-jungle';
                }
            });
        },

        /**
         * Render text replacing [[Wikilinks]] with clickable badges
         * @param {string} text
         * @returns {string} HTML string with rendered badges
         */
        renderWikilinks(text) {
            if (!text) return '';
            const safe = window.Lexicon.Utils.escapeHTML(text);
            return safe.replace(/\[\[([^\]\|\n]+)(?:\|([^\]\n]+))?\]\]/g, (match, target, alias) => {
                const label = (alias || target).trim();
                const rawTarget = target.trim();
                return `<span class="wikilink-badge cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-jungle/10 hover:bg-jungle/20 text-canopy border border-jungle/30 text-xs font-medium transition-colors select-none" data-wikilink-target="${rawTarget}" title="Abrir documento: ${rawTarget}"><i class="ph ph-link-simple text-[11px] text-jungle"></i><span>${label}</span></span>`;
            });
        },

        /**
         * Find all articles citing the given target article in their notes
         * @param {Object} targetArticle
         * @returns {Array<{sourceArticle: Object, snippet: string}>}
         */
        getBacklinks(targetArticle) {
            if (!targetArticle) return [];
            const state = window.Lexicon.State;
            const all = state.articles || [];
            const targetId = String(targetArticle.id);
            const targetTitle = (targetArticle.title || '').trim().toLowerCase();

            const backlinks = [];

            for (const art of all) {
                if (art.id === targetArticle.id) continue;
                const notes = art.notes || '';
                if (!notes.includes('[[')) continue;

                // Match [[targetId]] or [[targetTitle]] or [[targetTitle|alias]]
                const regex = /\[\[([^\]\|\n]+)(?:\|[^\]\n]+)?\]\]/g;
                let match;
                let foundInArticle = false;
                let snippet = '';

                while ((match = regex.exec(notes)) !== null) {
                    const referenced = match[1].trim().toLowerCase();
                    if (referenced === targetId || (targetTitle && referenced === targetTitle) || (targetTitle && referenced.length > 5 && targetTitle.includes(referenced))) {
                        foundInArticle = true;
                        
                        // Extract surrounding sentence
                        const start = Math.max(0, match.index - 40);
                        const end = Math.min(notes.length, match.index + match[0].length + 60);
                        snippet = (start > 0 ? '...' : '') + notes.substring(start, end).replace(/\n+/g, ' ').trim() + (end < notes.length ? '...' : '');
                        break;
                    }
                }

                if (foundInArticle) {
                    backlinks.push({
                        sourceArticle: art,
                        snippet: snippet
                    });
                }
            }

            return backlinks;
        },

        /**
         * Render the Backlinks (Citações Reversas) container
         * @param {Object} article
         * @param {HTMLElement} containerEl
         */
        renderBacklinks(article, containerEl) {
            if (!containerEl) return;
            const backlinks = this.getBacklinks(article);

            if (backlinks.length === 0) {
                containerEl.innerHTML = `
                    <div class="p-3 bg-sand/50 border border-wood/60 rounded-xl text-center">
                        <p class="text-xs text-earth/80">
                            Nenhum documento cita este artigo ainda.
                        </p>
                        <p class="text-[11px] text-earth/60 mt-0.5">
                            Digite <code class="bg-wood/40 px-1 py-0.5 rounded text-soil">[[${window.Lexicon.Utils.escapeHTML(article.title || 'Título')}]]</code> nas anotações de outro artigo para conectá-los.
                        </p>
                    </div>
                `;
                return;
            }

            containerEl.innerHTML = `
                <div class="space-y-2">
                    <div class="flex items-center justify-between text-[11px] text-earth font-medium">
                        <span>Conexões ativas no seu Zettelkasten:</span>
                        <span class="px-2 py-0.5 bg-jungle/10 text-canopy rounded-full font-bold">${backlinks.length} ${backlinks.length === 1 ? 'menção' : 'menções'}</span>
                    </div>
                    <div class="space-y-1.5">
                        ${backlinks.map(b => {
                            const art = b.sourceArticle;
                            const safeTitle = window.Lexicon.Utils.escapeHTML(art.title);
                            const safeSnippet = window.Lexicon.Utils.escapeHTML(b.snippet);
                            const statusColor = art.status === 'reading' ? 'text-jungle bg-jungle/10' :
                                               art.status === 'processing' ? 'text-leaf bg-leaf/10' :
                                               art.status === 'archived' ? 'text-earth bg-wood/40' :
                                               'text-terracotta bg-terracotta/10';
                            return `
                                <div class="p-2.5 bg-sand/70 hover:bg-sand border border-wood/70 hover:border-jungle/40 rounded-xl cursor-pointer transition-all shadow-2xs group"
                                     onclick="Lexicon.Articles.inspect(${art.id})">
                                    <div class="flex items-center justify-between gap-2 mb-1">
                                        <div class="flex items-center gap-1.5 min-w-0">
                                            <i class="ph ph-arrow-bend-down-right text-jungle text-xs shrink-0 group-hover:translate-x-0.5 transition-transform"></i>
                                            <span class="text-xs font-serif font-bold text-soil truncate group-hover:text-jungle transition-colors">${safeTitle}</span>
                                        </div>
                                        <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${statusColor} shrink-0">${art.status}</span>
                                    </div>
                                    <div class="text-[11px] text-earth italic font-serif pl-4 border-l-2 border-wood/60 line-clamp-2">
                                        "${safeSnippet}"
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        },

        /**
         * Navigate to an article by target string (ID or Title)
         * @param {string} target
         */
        navigateToArticle(target) {
            if (!target) return;
            const state = window.Lexicon.State;
            const all = state.articles || [];
            const cleanTarget = target.trim().toLowerCase();

            // Try exact ID match first
            let found = all.find(a => String(a.id) === cleanTarget);

            // Try exact title match
            if (!found) {
                found = all.find(a => (a.title || '').trim().toLowerCase() === cleanTarget);
            }

            // Try partial title match
            if (!found) {
                found = all.find(a => (a.title || '').trim().toLowerCase().includes(cleanTarget));
            }

            if (found) {
                // If Split-View Reader is currently open, switch to that article in reader!
                if (window.Lexicon.Reader && window.Lexicon.Reader.isOpen()) {
                    window.Lexicon.Reader.open(found.id);
                } else {
                    window.Lexicon.Articles.inspect(found.id);
                }
            } else {
                const msg = `Artigo "${target}" referenciado no Wikilink não foi encontrado no acervo.`;
                window.Lexicon.UI.Toast.show(msg, 'error');
            }
        }
    };
})();
