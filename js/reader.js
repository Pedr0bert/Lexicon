/* ==========================================================================
   Lexicon - Integrated Split-View Reader & EPUB Viewer Module
   Zero-parser PDF reading via native browser engine in <iframe>
   Integrated EPUB reading via ePub.js with TOC, themes and font sizing
   Side-by-side Markdown Fichamento Editor with Wikilinks & AI Assistants
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    let isOpen = false;
    let currentArticleId = null;
    let currentObjectUrl = null;
    let epubBook = null;
    let epubRendition = null;
    let isFullscreen = false;
    let autoSaveTimer = null;

    const epubState = {
        fontSize: 16,
        fontFamily: 'serif',
        theme: 'light' // 'light' | 'sepia' | 'dark'
    };

    /**
     * Get or create the Split-View modal container
     */
    function getModalEl() {
        return document.getElementById('reader-split-modal');
    }

    /**
     * Clean up active blobs and EPUB instances
     */
    function cleanupViewer() {
        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
            currentObjectUrl = null;
        }
        if (epubRendition) {
            try {
                epubRendition.destroy();
            } catch (e) {}
            epubRendition = null;
        }
        if (epubBook) {
            try {
                epubBook.destroy();
            } catch (e) {}
            epubBook = null;
        }

        const epubContainer = document.getElementById('split-epub-container');
        if (epubContainer) epubContainer.innerHTML = '';
        const pdfFrame = document.getElementById('split-pdf-frame');
        if (pdfFrame) pdfFrame.src = 'about:blank';
    }

    /**
     * Format a structured high-fidelity HTML document for items without a local PDF file
     */
    function generateFallbackDoc(article) {
        return `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>${window.Lexicon.Utils.escapeHTML(article.title)}</title>
                <style>
                    body {
                        font-family: 'Merriweather', Georgia, serif;
                        line-height: 1.8;
                        max-width: 760px;
                        margin: 40px auto;
                        padding: 0 24px;
                        color: #2D251F;
                        background: #FCFAF8;
                    }
                    header {
                        border-bottom: 2px solid #D1C7B7;
                        padding-bottom: 24px;
                        margin-bottom: 30px;
                    }
                    h1 {
                        font-size: 26px;
                        line-height: 1.35;
                        color: #1B4332;
                        margin-bottom: 12px;
                    }
                    .meta {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        font-size: 13px;
                        color: #4A4036;
                        margin-bottom: 8px;
                    }
                    .badge {
                        display: inline-block;
                        padding: 2px 8px;
                        border-radius: 6px;
                        background: #E6DFD3;
                        font-size: 11px;
                        font-weight: 600;
                        text-transform: uppercase;
                        color: #2D6A4F;
                    }
                    .section-title {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        font-size: 12px;
                        text-transform: uppercase;
                        letter-spacing: 0.08em;
                        font-weight: 700;
                        color: #2D6A4F;
                        margin-top: 32px;
                        margin-bottom: 10px;
                        border-bottom: 1px solid #E6DFD3;
                        padding-bottom: 4px;
                    }
                    .abstract {
                        font-size: 16px;
                        color: #2D251F;
                        background: #F4F1EA;
                        padding: 16px 20px;
                        border-radius: 10px;
                        border-left: 4px solid #2D6A4F;
                        margin-top: 12px;
                    }
                    .notice {
                        background: #F4F1EA;
                        border: 1px dashed #D1C7B7;
                        padding: 14px 18px;
                        border-radius: 8px;
                        font-family: sans-serif;
                        font-size: 13px;
                        color: #4A4036;
                        margin-top: 24px;
                    }
                </style>
            </head>
            <body>
                <header>
                    <span class="badge">${window.Lexicon.Utils.escapeHTML(article.collection || 'Artigo Acadêmico')}</span>
                    <h1>${window.Lexicon.Utils.escapeHTML(article.title)}</h1>
                    <div class="meta"><strong>Autores:</strong> ${window.Lexicon.Utils.escapeHTML(article.authors || 'Não especificado')}</div>
                    <div class="meta"><strong>Ano:</strong> ${window.Lexicon.Utils.escapeHTML(String(article.year || 'N/A'))} | <strong>Publicação:</strong> ${window.Lexicon.Utils.escapeHTML(article.publication || 'Sem periódico')}</div>
                    ${article.doi ? `<div class="meta"><strong>DOI:</strong> <a href="${article.doi.startsWith('http') ? article.doi : 'https://doi.org/' + article.doi}" target="_blank" style="color:#2D6A4F;">${window.Lexicon.Utils.escapeHTML(article.doi)}</a></div>` : ''}
                </header>

                <div class="section-title">Resumo / Abstract Oficial</div>
                <div class="abstract">
                    ${article.summary ? window.Lexicon.Utils.escapeHTML(article.summary) : 'Nenhum resumo registrado ainda. Utilize o botão "Resumir com IA" no painel lateral direito ou vincule o arquivo PDF original.'}
                </div>

                ${article.extractedText ? `
                    <div class="section-title">Texto Extraído do Documento Original</div>
                    <div style="font-family: sans-serif; font-size: 13px; white-space: pre-wrap; color: #4A4036; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #D1C7B7;">
                        ${window.Lexicon.Utils.escapeHTML(article.extractedText.slice(0, 3000))}...
                    </div>
                ` : ''}

                <div class="notice">
                    <strong>Arquivo físico não vinculado localmente:</strong> Para ler as páginas completas com o leitor nativo acelerado por GPU, anexe o arquivo PDF ou EPUB clicando em <em>"Vincular Arquivo"</em> no painel de metadados.
                </div>
            </body>
            </html>
        `;
    }

    window.Lexicon.Reader = {
        init() {
            // Register Esc key to close split view when open
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && isOpen) {
                    // Check if wikilinks dropdown is open, if so let that close first
                    const autoEl = document.getElementById('wikilinks-autocomplete-popup');
                    if (autoEl && !autoEl.classList.contains('hidden')) return;

                    e.preventDefault();
                    this.close();
                }
            });
        },

        isOpen() {
            return isOpen;
        },

        getCurrentArticleId() {
            return currentArticleId;
        },

        /**
         * Open Split-View Reader for a specific article
         * @param {number|string} articleId
         */
        async open(articleId) {
            const state = window.Lexicon.State;
            const id = Number(articleId || state.inspectedArticleId);
            const article = state.articles.find(a => a.id === id);
            if (!article) {
                window.Lexicon.UI.Toast.show('Documento não encontrado para leitura', 'error');
                return;
            }

            currentArticleId = article.id;
            state.inspectedArticleId = article.id;

            // Automatically move from inbox to reading workflow status
            if (article.status === 'inbox') {
                article.status = 'reading';
                window.Lexicon.Storage.save();
                window.Lexicon.Collections.render();
                window.Lexicon.Articles.render();
            }

            // Close standard inspector modal if open
            if (window.Lexicon.UI.Modal) {
                window.Lexicon.UI.Modal.close('inspector-modal');
            }

            const modal = getModalEl();
            if (!modal) return;

            // 1. Populate Header & Metadata in Split-View
            const splitTitleEl = document.getElementById('split-title');
            if (splitTitleEl) {
                splitTitleEl.textContent = article.title || 'Documento sem título';
                splitTitleEl.title = article.title || '';
            }
            const splitAuthorYearEl = document.getElementById('split-author-year');
            if (splitAuthorYearEl) {
                splitAuthorYearEl.textContent = [
                    article.authors,
                    article.year ? `(${article.year})` : '',
                    article.publication ? `• ${article.publication}` : ''
                ].filter(Boolean).join(' ');
                splitAuthorYearEl.title = splitAuthorYearEl.textContent;
            }

            const statusSelect = document.getElementById('split-status-select');
            if (statusSelect) {
                statusSelect.value = article.status || 'reading';
            }

            const collectionSelect = document.getElementById('split-collection-select');
            if (collectionSelect) {
                collectionSelect.innerHTML = `
                    <option value="">(Sem Coleção)</option>
                    ${state.collections.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                `;
                collectionSelect.value = article.collection || '';
            }

            // 2. Summary & Notes in Right Panel
            const summaryEl = document.getElementById('split-reader-summary');
            if (summaryEl) {
                summaryEl.value = article.summary || '';
            }

            const notesEl = document.getElementById('split-reader-notes');
            if (notesEl) {
                notesEl.value = article.notes || '';
                // Attach Zettelkasten autocomplete to split-reader notes
                if (window.Lexicon.Zettelkasten) {
                    window.Lexicon.Zettelkasten.attach(notesEl);
                }
            }

            // Update Backlinks Panel
            this.renderBacklinks();

            // 3. Render Left Pane (Viewer: PDF or EPUB)
            await this.setupViewer(article);

            // 4. Show Modal
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
            }, 10);
            isOpen = true;

            window.Lexicon.UI.Toast.show(`Leitor Split-View: "${window.Lexicon.Utils.escapeHTML(article.title)}"`, 'info');
        },

        /**
         * Close Split-View Reader and sync state
         */
        close() {
            if (!isOpen) return;
            const modal = getModalEl();
            if (modal) {
                modal.classList.add('opacity-0');
                setTimeout(() => {
                    modal.classList.add('hidden');
                }, 200);
            }

            this.saveCurrentNotes();
            cleanupViewer();
            isOpen = false;
            currentArticleId = null;

            if (window.Lexicon.Articles) {
                window.Lexicon.Articles.render();
            }
        },

        /**
         * Setup Left Pane Viewer based on document type
         */
        async setupViewer(article) {
            cleanupViewer();

            const pdfFrame = document.getElementById('split-pdf-frame');
            const epubContainer = document.getElementById('split-epub-container');
            const epubToolbar = document.getElementById('split-epub-toolbar');
            const pdfToolbar = document.getElementById('split-pdf-toolbar');

            const isEpub = article.coverType === 'book' || 
                          (article.fileName && article.fileName.toLowerCase().endsWith('.epub'));

            const fileIcon = document.getElementById('split-file-icon');

            // 1. EPUB Viewer Flow
            if (isEpub) {
                if (fileIcon) fileIcon.className = 'ph ph-book-open text-base text-jungle';
                if (pdfFrame) pdfFrame.classList.add('hidden');
                if (pdfToolbar) pdfToolbar.classList.add('hidden');
                if (epubContainer) epubContainer.classList.remove('hidden');
                if (epubToolbar) epubToolbar.classList.remove('hidden');

                const storedFile = await window.Lexicon.Storage.getFile(article.id);
                if (storedFile && typeof window.ePub !== 'undefined') {
                    await this.initEpub(storedFile);
                } else {
                    // Render interactive eBook preview mode
                    this.renderEpubFallback(article);
                }
                return;
            }

            // 2. PDF / Standard Document Viewer Flow (Flush edge-to-edge top: 0)
            if (fileIcon) fileIcon.className = 'ph ph-file-pdf text-base text-terracotta';
            if (epubContainer) epubContainer.classList.add('hidden');
            if (epubToolbar) epubToolbar.classList.add('hidden');
            if (pdfFrame) pdfFrame.classList.remove('hidden');
            if (pdfToolbar) pdfToolbar.classList.add('hidden');

            const storedFile = await window.Lexicon.Storage.getFile(article.id);
            if (storedFile) {
                currentObjectUrl = URL.createObjectURL(storedFile);
                // Load into native PDF viewer iframe with zoom & toolbar
                pdfFrame.src = `${currentObjectUrl}#toolbar=1&navpanes=1&view=FitH`;
            } else {
                // Render high-fidelity structured preview
                const html = generateFallbackDoc(article);
                const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                currentObjectUrl = URL.createObjectURL(blob);
                pdfFrame.src = currentObjectUrl;
            }
        },

        /**
         * Initialize real ePub.js reader
         */
        async initEpub(fileOrBlob) {
            const container = document.getElementById('split-epub-container');
            if (!container) return;
            container.innerHTML = '';

            try {
                const arrayBuffer = await fileOrBlob.arrayBuffer();
                epubBook = window.ePub(arrayBuffer);
                epubRendition = epubBook.renderTo('split-epub-container', {
                    width: '100%',
                    height: '100%',
                    flow: 'paginated',
                    spread: 'none'
                });

                // Apply initial themes & font
                this.applyEpubTheme();

                await epubRendition.display();

                // Populate TOC (Table of Contents)
                const toc = await epubBook.loaded.navigation;
                const tocSelect = document.getElementById('split-epub-toc-select');
                if (tocSelect && toc && toc.toc) {
                    tocSelect.innerHTML = `<option value="">Sumário / Capítulos (${toc.toc.length})</option>` +
                        toc.toc.map(item => `<option value="${item.href}">${window.Lexicon.Utils.escapeHTML(item.label.trim())}</option>`).join('');
                }

                // Update location listener
                epubRendition.on('relocated', (location) => {
                    const progEl = document.getElementById('split-epub-progress');
                    if (progEl && location && location.start) {
                        const pct = epubBook.locations.percentageFromCfi(location.start.cfi);
                        if (!isNaN(pct)) {
                            progEl.textContent = `${Math.round(pct * 100)}% lido`;
                        }
                    }
                });

                // Generate locations for progress bar
                epubBook.ready.then(() => epubBook.locations.generate(1000));
            } catch (err) {
                console.error('[Reader:EPUB] Failed to parse EPUB:', err);
                this.renderEpubFallback(window.Lexicon.State.articles.find(a => a.id === currentArticleId));
            }
        },

        /**
         * Render simulated eBook view when no local binary is attached
         */
        renderEpubFallback(article) {
            const container = document.getElementById('split-epub-container');
            if (!container) return;

            container.innerHTML = `
                <div class="h-full overflow-y-auto p-8 md:p-12 flex flex-col items-center justify-center text-center bg-paper">
                    <div class="w-16 h-16 rounded-2xl bg-sand border border-wood flex items-center justify-center text-terracotta text-3xl mb-4 shadow-sm">
                        <i class="ph ph-book-bookmark"></i>
                    </div>
                    <h2 class="text-xl font-serif font-bold text-soil max-w-lg mb-2">${window.Lexicon.Utils.escapeHTML(article.title)}</h2>
                    <p class="text-xs text-earth max-w-md mb-6">${window.Lexicon.Utils.escapeHTML(article.authors || 'Autor Desconhecido')} • ${article.year || 'Edição Acadêmica'}</p>
                    
                    <div class="bg-sand/70 border border-wood rounded-xl p-5 max-w-lg text-left text-xs text-soil space-y-3 mb-6">
                        <div class="font-bold text-[11px] uppercase tracking-wider text-jungle flex items-center gap-1.5">
                            <i class="ph ph-info"></i> Formato de Livro (EPUB)
                        </div>
                        <p class="leading-relaxed">
                            O leitor de EPUB integrado está ativo com paginação, alternância de fontes, temas claro/sépia/escuro e índice de capítulos.
                        </p>
                        <p class="text-earth/80">
                            Para carregar o texto completo deste livro, anexe seu arquivo <code class="bg-wood/40 px-1 py-0.5 rounded text-soil">.epub</code>.
                        </p>
                    </div>

                    <button type="button" onclick="Lexicon.Articles.relinkFileForInspected()" 
                            class="px-4 py-2 bg-jungle text-white rounded-xl text-xs font-semibold hover:bg-canopy transition-colors flex items-center gap-2 shadow-xs cursor-pointer">
                        <i class="ph ph-upload-simple"></i>
                        <span>Anexar Arquivo .epub Real</span>
                    </button>
                </div>
            `;
        },

        /**
         * Apply theme, font and font size to EPUB rendition
         */
        applyEpubTheme() {
            if (!epubRendition) return;

            // Font size
            epubRendition.themes.fontSize(`${epubState.fontSize}px`);

            // Font family
            const fontMap = {
                'serif': "'Merriweather', Georgia, serif",
                'sans': "'Inter', system-ui, sans-serif",
                'mono': "'JetBrains Mono', monospace"
            };
            epubRendition.themes.font(fontMap[epubState.fontFamily] || fontMap.serif);

            // Register & apply color themes
            epubRendition.themes.register('light', {
                body: { color: '#2D251F !important', background: '#FCFAF8 !important', 'line-height': '1.8 !important' }
            });
            epubRendition.themes.register('sepia', {
                body: { color: '#4A4036 !important', background: '#F4F1EA !important', 'line-height': '1.8 !important' }
            });
            epubRendition.themes.register('dark', {
                body: { color: '#E6DFD3 !important', background: '#2D251F !important', 'line-height': '1.8 !important' }
            });

            epubRendition.themes.select(epubState.theme);

            // Sync container background color
            const container = document.getElementById('split-epub-container');
            if (container) {
                container.style.backgroundColor = epubState.theme === 'dark' ? '#2D251F' :
                                                  epubState.theme === 'sepia' ? '#F4F1EA' : '#FCFAF8';
            }
        },

        changeEpubFontSize(delta) {
            epubState.fontSize = Math.min(28, Math.max(12, epubState.fontSize + delta));
            this.applyEpubTheme();
            const label = document.getElementById('split-epub-font-size-label');
            if (label) label.textContent = `${epubState.fontSize}px`;
        },

        changeEpubFontFamily(family) {
            epubState.fontFamily = family;
            this.applyEpubTheme();
        },

        changeEpubTheme(theme) {
            epubState.theme = theme;
            this.applyEpubTheme();
        },

        prevEpubPage() {
            if (epubRendition) epubRendition.prev();
        },

        nextEpubPage() {
            if (epubRendition) epubRendition.next();
        },

        jumpToEpubChapter(href) {
            if (epubRendition && href) {
                epubRendition.display(href);
            }
        },

        /**
         * Toggle between standard split and fullscreen
         */
        toggleFullscreen() {
            const modal = getModalEl();
            if (!modal) return;
            isFullscreen = !isFullscreen;

            const icon = document.getElementById('split-fullscreen-icon');
            if (isFullscreen) {
                if (icon) icon.className = 'ph ph-arrows-in text-lg';
                modal.classList.add('reader-fullscreen');
            } else {
                if (icon) icon.className = 'ph ph-arrows-out text-lg';
                modal.classList.remove('reader-fullscreen');
            }
        },

        /**
         * Open current document in external browser tab
         */
        openInExternalTab() {
            if (!currentArticleId) return;
            window.Lexicon.Articles.openDocumentForReading(currentArticleId);
        },

        /**
         * Switch from Split-View to Document Inspector modal
         */
        switchToInspector() {
            const id = currentArticleId;
            this.close();
            if (id && window.Lexicon.Articles) {
                window.Lexicon.Articles.inspect(id);
            }
        },

        /**
         * Auto-save notes on input
         */
        onNotesInput() {
            const indicator = document.getElementById('split-notes-save-indicator');
            if (indicator) {
                indicator.textContent = 'Salvando...';
                indicator.className = 'text-[10px] text-terracotta italic';
            }

            clearTimeout(autoSaveTimer);
            autoSaveTimer = setTimeout(() => {
                this.saveCurrentNotes();
                if (indicator) {
                    indicator.textContent = 'Salvo automaticamente';
                    indicator.className = 'text-[10px] text-earth/70 italic';
                }
            }, 600);
        },

        /**
         * Save current notes to state and storage
         */
        saveCurrentNotes() {
            if (!currentArticleId) return;
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === currentArticleId);
            if (!article) return;

            const notesEl = document.getElementById('split-reader-notes');
            if (notesEl) {
                article.notes = notesEl.value;
            }

            const summaryEl = document.getElementById('split-reader-summary');
            if (summaryEl) {
                article.summary = summaryEl.value;
            }

            const statusEl = document.getElementById('split-status-select');
            if (statusEl) {
                article.status = statusEl.value;
            }

            const colEl = document.getElementById('split-collection-select');
            if (colEl) {
                article.collection = colEl.value;
            }

            window.Lexicon.Storage.save();
            this.renderBacklinks();
        },

        /**
         * Insert quick citation block into notes
         */
        insertQuickCitation() {
            const textarea = document.getElementById('split-reader-notes') || document.getElementById('inspector-notes');
            if (!textarea) return;

            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const selected = text.substring(start, end).trim();

            const pageNum = prompt('Digite o número da página citada (ou deixe em branco):', '1');
            if (pageNum === null) return; // Cancelled

            const now = new Date();
            const dateStr = now.toLocaleDateString('pt-BR');
            const pageRef = pageNum ? `(p. ${pageNum.trim()} - ${dateStr})` : `(${dateStr})`;

            const quoteText = selected || 'trecho citado do documento...';
            const citationBlock = `\n\n> "${quoteText}" ${pageRef}\n\n`;

            textarea.value = text.substring(0, start) + citationBlock + text.substring(end);
            const nextCursor = start + citationBlock.length;
            textarea.setSelectionRange(nextCursor, nextCursor);
            textarea.focus();

            this.onNotesInput();
            window.Lexicon.UI.Toast.show('Citação formatada inserida nas notas', 'info');
        },

        /**
         * Insert Markdown formatting into split-reader notes
         */
        insertFormatting(type) {
            const textarea = document.getElementById('split-reader-notes');
            if (!textarea) return;

            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const selected = text.substring(start, end);

            let replacement = '';
            let cursorOffset = 0;

            switch (type) {
                case 'bold':
                    replacement = `**${selected || 'texto em negrito'}**`;
                    cursorOffset = selected ? replacement.length : 2;
                    break;
                case 'italic':
                    replacement = `*${selected || 'texto em itálico'}*`;
                    cursorOffset = selected ? replacement.length : 1;
                    break;
                case 'h2':
                    replacement = `\n\n## ${selected || 'Título da Seção'}\n`;
                    cursorOffset = replacement.length;
                    break;
                case 'quote':
                    replacement = `\n> "${selected || 'Citação textual do autor'}"\n`;
                    cursorOffset = replacement.length;
                    break;
                case 'bullet':
                    replacement = `\n- ${selected || 'Ponto importante'}`;
                    cursorOffset = replacement.length;
                    break;
                case 'date':
                    const now = new Date().toLocaleDateString('pt-BR');
                    replacement = ` [${now}] `;
                    cursorOffset = replacement.length;
                    break;
            }

            textarea.value = text.substring(0, start) + replacement + text.substring(end);
            textarea.focus();
            textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
            this.onNotesInput();
        },

        /**
         * Render Backlinks in split-reader right panel
         */
        renderBacklinks() {
            const container = document.getElementById('split-reader-backlinks');
            if (!container || !currentArticleId) return;

            const article = window.Lexicon.State.articles.find(a => a.id === currentArticleId);
            if (article && window.Lexicon.Zettelkasten) {
                window.Lexicon.Zettelkasten.renderBacklinks(article, container);
            }
        },

        /**
         * Export consolidated notes in structured Markdown (.md)
         */
        exportConsolidatedMarkdown() {
            if (!currentArticleId) return;
            const article = window.Lexicon.State.articles.find(a => a.id === currentArticleId);
            if (!article) return;

            if (window.Lexicon.Academic && typeof window.Lexicon.Academic.exportConsolidatedMarkdown === 'function') {
                window.Lexicon.Academic.exportConsolidatedMarkdown(article);
            } else if (window.Lexicon.Articles && typeof window.Lexicon.Articles.exportNotesForInspected === 'function') {
                window.Lexicon.Articles.exportNotesForInspected();
            }
        }
    };
})();
