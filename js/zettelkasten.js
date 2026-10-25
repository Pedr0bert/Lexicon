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

    const U = () => window.Lexicon.Utils;
    const esc = (v) => U().escapeHTML(v);
    const tr = (k, f, p) => U().tr(k, f, p);
    const WIKILINK_RE = /\[\[([^\]\|\n]+)(?:\|([^\]\n]+))?\]\]/g;

    /** Wikilink text for an article: [[Title]] or [[id|Title]] when the title has special chars */
    function wikilinkFor(article) {
        const title = String(article.title || '').replace(/\s+/g, ' ').trim();
        if (!title || /[\[\]|]/.test(title)) {
            const label = title.replace(/[\[\]|]/g, ' ').replace(/\s+/g, ' ').trim() || String(article.id);
            return `[[${article.id}|${label}]]`;
        }
        return `[[${title}]]`;
    }

    /** Does a wikilink target refer to the article (by id or exact title)? */
    function refersTo(target, article) {
        const ref = String(target || '').trim().toLowerCase();
        if (!ref) return false;
        if (ref === String(article.id)) return true;
        const title = String(article.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return !!title && ref === title;
    }

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
                    ${esc(tr('zettelkasten.noMatch', 'Nenhum documento encontrado para "{query}"', { query }))}
                </div>
            `;
        } else {
            el.innerHTML = `
                <div class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-earth/70 border-b border-wood/50 flex justify-between">
                    <span>${esc(tr('zettelkasten.connectHeader', 'Conectar Documento ([[Wikilink]])'))}</span>
                    <span class="text-[9px] font-mono">↑↓ Enter</span>
                </div>
                <div class="py-1 space-y-0.5">
                    ${matches.map((art, idx) => {
                        const isSelected = idx === selectedIndex;
                        const safeTitle = window.Lexicon.Utils.escapeHTML(art.title || 'Sem título');
                        const safeAuthor = window.Lexicon.Utils.escapeHTML(art.authors ? ` • ${art.authors}` : '');
                        const safeYear = art.year ? ` (${esc(art.year)})` : '';
                        return `
                            <div role="option" aria-selected="${isSelected}" class="wikilink-item px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-2 ${isSelected ? 'bg-jungle text-white font-semibold' : 'hover:bg-sand text-soil'}"
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
        const replacement = `${wikilinkFor(article)} `;

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
            if (this._initialized) return;
            this._initialized = true;
            document.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.closest && e.target.closest('[data-zk-open]')) {
                    e.preventDefault();
                    e.target.closest('[data-zk-open]').click();
                }
            });
            // Global click listener to close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (activeDropdown && !activeDropdown.contains(e.target) && e.target !== activeTextarea) {
                    hideDropdown();
                }
            });

            // Global click handler for rendered wikilinks and backlink cards
            document.addEventListener('click', (e) => {
                const card = e.target.closest('[data-zk-open]');
                if (card) {
                    e.preventDefault();
                    const id = Number(card.dataset.zkOpen);
                    if (id) this.openArticle(id);
                    return;
                }
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
                    // preventDefault tells the modal manager this Escape was consumed
                    e.preventDefault();
                    e.stopPropagation();
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
            return safe.replace(WIKILINK_RE, (match, target, alias) => {
                const label = (alias || target).trim();
                const rawTarget = target.trim();
                return `<span class="wikilink-badge cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-jungle/10 hover:bg-jungle/20 text-canopy border border-jungle/30 text-xs font-medium transition-colors select-none" data-wikilink-target="${rawTarget}" role="link" tabindex="0" title="${esc(tr('zettelkasten.openDoc', 'Abrir documento'))}: ${rawTarget}"><i class="ph ph-link-simple text-[11px] text-jungle"></i><span>${label}</span></span>`;
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
            const backlinks = [];

            for (const art of all) {
                if (art.id === targetArticle.id) continue;
                const notes = art.notes || '';
                if (!notes.includes('[[')) continue;

                const regex = new RegExp(WIKILINK_RE.source, 'g');
                let match;
                while ((match = regex.exec(notes)) !== null) {
                    if (refersTo(match[1], targetArticle)) {
                        const start = Math.max(0, match.index - 40);
                        const end = Math.min(notes.length, match.index + match[0].length + 60);
                        const snippet = (start > 0 ? '...' : '') + notes.substring(start, end).replace(/\n+/g, ' ').trim() + (end < notes.length ? '...' : '');
                        backlinks.push({ sourceArticle: art, snippet });
                        break;
                    }
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
            if (!containerEl || !article) return;
            const backlinks = this.getBacklinks(article);

            if (backlinks.length === 0) {
                containerEl.innerHTML = `
                    <div class="p-3 bg-sand/50 border border-wood/60 rounded-xl text-center">
                        <p class="text-xs text-earth/80">${esc(tr('zettelkasten.noBacklinks', 'Nenhum documento cita este artigo ainda.'))}</p>
                        <p class="text-[11px] text-earth/60 mt-0.5">
                            ${esc(tr('zettelkasten.howToLinkPrefix', 'Digite'))} <code class="bg-wood/40 px-1 py-0.5 rounded text-soil">${esc(wikilinkFor(article))}</code> ${esc(tr('zettelkasten.howToLinkSuffix', 'nas anotações de outro artigo para conectá-los.'))}
                        </p>
                    </div>
                `;
                return;
            }

            const mentionWord = backlinks.length === 1
                ? tr('zettelkasten.mention', 'menção')
                : tr('zettelkasten.mentions', 'menções');
            const Articles = window.Lexicon.Articles;

            containerEl.innerHTML = `
                <div class="space-y-2">
                    <div class="flex items-center justify-between text-[11px] text-earth font-medium">
                        <span>${esc(tr('zettelkasten.activeConnections', 'Conexões ativas no seu Zettelkasten:'))}</span>
                        <span class="px-2 py-0.5 bg-jungle/10 text-canopy rounded-full font-bold">${backlinks.length} ${esc(mentionWord)}</span>
                    </div>
                    <div class="space-y-1.5">
                        ${backlinks.map(b => {
                            const art = b.sourceArticle;
                            const statusColor = art.status === 'reading' ? 'text-jungle bg-jungle/10' :
                                               art.status === 'processing' ? 'text-leaf bg-leaf/10' :
                                               art.status === 'archived' ? 'text-earth bg-wood/40' :
                                               'text-terracotta bg-terracotta/10';
                            const statusLabel = Articles && Articles.getStatusLabel ? Articles.getStatusLabel(art.status) : art.status;
                            return `
                                <div class="p-2.5 bg-sand/70 hover:bg-sand border border-wood/70 hover:border-jungle/40 rounded-xl cursor-pointer transition-all shadow-2xs group"
                                     data-zk-open="${Number(art.id)}" role="button" tabindex="0">
                                    <div class="flex items-center justify-between gap-2 mb-1">
                                        <div class="flex items-center gap-1.5 min-w-0">
                                            <i class="ph ph-arrow-bend-down-right text-jungle text-xs shrink-0 group-hover:translate-x-0.5 transition-transform" aria-hidden="true"></i>
                                            <span class="text-xs font-serif font-bold text-soil truncate group-hover:text-jungle transition-colors">${esc(art.title)}</span>
                                        </div>
                                        <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${statusColor} shrink-0">${esc(statusLabel)}</span>
                                    </div>
                                    <div class="text-[11px] text-earth italic font-serif pl-4 border-l-2 border-wood/60 line-clamp-2">
                                        "${esc(b.snippet)}"
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        },

        /** Open an article in the reader (if open) or the inspector */
        openArticle(id) {
            const L = window.Lexicon;
            if (L.Reader && L.Reader.isOpen()) {
                L.Reader.open(id);
            } else if (L.Articles) {
                L.Articles.inspect(id);
            }
        },

        /**
         * Navigate to an article by target string (ID or Title)
         * @param {string} target
         */
        navigateToArticle(target) {
            if (!target) return;
            const all = window.Lexicon.State.articles || [];
            const cleanTarget = String(target).trim().toLowerCase();

            let found = all.find(a => refersTo(cleanTarget, a));
            if (!found) {
                // Only accept a partial title match when it is unambiguous
                const partial = all.filter(a => (a.title || '').trim().toLowerCase().includes(cleanTarget));
                if (partial.length === 1) found = partial[0];
            }

            if (found) {
                this.openArticle(found.id);
            } else {
                window.Lexicon.UI.Toast.show(
                    tr('zettelkasten.notFound', 'Artigo "{target}" referenciado no Wikilink não foi encontrado no acervo.', { target }),
                    'error');
            }
        },

        /**
         * Keep [[Old Title]] links working after a document is renamed.
         * @returns {number} number of notes updated
         */
        renameTitleReferences(oldTitle, newTitle, articleId) {
            const oldT = String(oldTitle || '').replace(/\s+/g, ' ').trim();
            if (!oldT || oldT === String(newTitle || '').trim()) return 0;
            const replacementTarget = wikilinkFor({ id: articleId, title: newTitle });
            let updated = 0;
            (window.Lexicon.State.articles || []).forEach(art => {
                if (!art.notes || !art.notes.includes('[[')) return;
                const next = art.notes.replace(new RegExp(WIKILINK_RE.source, 'g'), (m, target, alias) => {
                    if (String(target).trim().toLowerCase() !== oldT.toLowerCase()) return m;
                    if (alias) return `[[${articleId}|${alias}]]`;
                    return replacementTarget;
                });
                if (next !== art.notes) {
                    art.notes = next;
                    updated++;
                }
            });
            return updated;
        },

        wikilinkFor
    };
})();
