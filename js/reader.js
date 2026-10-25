/* ==========================================================================
   Lexicon - Integrated Split-View Reader & EPUB Viewer Module
   PDF via the browser's native viewer in an <iframe>, EPUB via ePub.js,
   side-by-side Markdown notes with Wikilinks & AI assistants.
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    const MODAL_ID = 'reader-split-modal';
    const EPUB_LOCATIONS_MAX_BYTES = 15 * 1024 * 1024;

    let isOpen = false;
    let currentArticleId = null;
    let currentObjectUrl = null;
    let epubBook = null;
    let epubRendition = null;
    let isFullscreen = false;
    let autoSaveTimer = null;
    let openToken = 0; // invalidates stale async viewer setups

    const epubState = {
        fontSize: 16,
        fontFamily: 'serif',
        theme: 'light'
    };

    const U = () => window.Lexicon.Utils;
    const esc = (s) => U().escapeHTML(s);
    const tr = (k, f, p) => U().tr(k, f, p);
    const locale = () => (window.Lexicon.I18n && window.Lexicon.I18n.locale) || 'pt-BR';

    function getModalEl() {
        return document.getElementById(MODAL_ID);
    }

    function cleanupViewer() {
        openToken++;
        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
            currentObjectUrl = null;
        }
        if (epubRendition) {
            try { epubRendition.destroy(); } catch (e) { /* ignore */ }
            epubRendition = null;
        }
        if (epubBook) {
            try { epubBook.destroy(); } catch (e) { /* ignore */ }
            epubBook = null;
        }

        const epubContainer = document.getElementById('split-epub-container');
        if (epubContainer) epubContainer.innerHTML = '';
        const pdfFrame = document.getElementById('split-pdf-frame');
        if (pdfFrame) {
            pdfFrame.removeAttribute('srcdoc');
            pdfFrame.src = 'about:blank';
        }
    }

    /** Detect the real format of the stored file (not the catalog's "coverType") */
    function detectFormat(file, article) {
        const name = String((file && file.name) || (article && article.fileName) || '').toLowerCase();
        const type = String((file && file.type) || '').toLowerCase();
        if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
        if (type === 'application/epub+zip' || name.endsWith('.epub')) return 'epub';
        if (type.startsWith('text/') || /\.(txt|md|markdown|csv)$/.test(name)) return 'text';
        if (type.startsWith('image/')) return 'image';
        return 'unsupported';
    }

    /**
     * Structured HTML preview for items without a renderable local file.
     * Rendered in a sandboxed iframe (no scripts, opaque origin).
     */
    function generateFallbackDoc(article, notice) {
        const href = U().doiHref(article.doi);
        const extracted = article.extractedText
            ? `<div class="section-title">${esc(tr('reader.extractedText', 'Texto Extraído do Documento Original'))}</div>
               <div class="extracted">${esc(article.extractedText.slice(0, 3000))}${article.extractedText.length > 3000 ? '…' : ''}</div>`
            : '';
        return `<!DOCTYPE html>
<html lang="${esc(locale())}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<title>${esc(article.title)}</title>
<style>
    body { font-family: 'Merriweather', Georgia, serif; line-height: 1.8; max-width: 760px; margin: 40px auto; padding: 0 24px; color: #2D251F; background: #FCFAF8; }
    header { border-bottom: 2px solid #D1C7B7; padding-bottom: 24px; margin-bottom: 30px; }
    h1 { font-size: 26px; line-height: 1.35; color: #1B4332; margin-bottom: 12px; }
    .meta { font-family: system-ui, sans-serif; font-size: 13px; color: #4A4036; margin-bottom: 8px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; background: #E6DFD3; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #2D6A4F; }
    .section-title { font-family: system-ui, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; color: #2D6A4F; margin-top: 32px; margin-bottom: 10px; border-bottom: 1px solid #E6DFD3; padding-bottom: 4px; }
    .abstract { font-size: 16px; background: #F4F1EA; padding: 16px 20px; border-radius: 10px; border-left: 4px solid #2D6A4F; margin-top: 12px; white-space: pre-wrap; }
    .extracted { font-family: system-ui, sans-serif; font-size: 13px; white-space: pre-wrap; color: #4A4036; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #D1C7B7; }
    .notice { background: #F4F1EA; border: 1px dashed #D1C7B7; padding: 14px 18px; border-radius: 8px; font-family: system-ui, sans-serif; font-size: 13px; color: #4A4036; margin-top: 24px; }
    a { color: #2D6A4F; }
</style>
</head>
<body>
    <header>
        <span class="badge">${esc(article.collection || tr('reader.academicArticle', 'Artigo Acadêmico'))}</span>
        <h1>${esc(article.title)}</h1>
        <div class="meta"><strong>${esc(tr('reader.authors', 'Autores'))}:</strong> ${U().display(article.authors, tr('reader.unknownAuthor', 'Não especificado'))}</div>
        <div class="meta"><strong>${esc(tr('reader.year', 'Ano'))}:</strong> ${U().display(article.year, 'N/A')} | <strong>${esc(tr('reader.publication', 'Publicação'))}:</strong> ${U().display(article.publication, '—')}</div>
        ${article.doi ? `<div class="meta"><strong>DOI:</strong> ${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(article.doi)}</a>` : esc(article.doi)}</div>` : ''}
    </header>
    <div class="section-title">${esc(tr('reader.abstractTitle', 'Resumo / Abstract'))}</div>
    <div class="abstract">${article.summary ? esc(article.summary) : esc(tr('reader.noSummary', 'Nenhum resumo registrado ainda. Use "Resumir com IA" ou vincule o arquivo original.'))}</div>
    ${extracted}
    <div class="notice">${esc(notice || tr('reader.noFileNotice', 'Arquivo não vinculado localmente: anexe o PDF ou EPUB em "Vincular Arquivo" no inspetor para ler as páginas completas.'))}</div>
</body>
</html>`;
    }

    window.Lexicon.Reader = {
        init() {
            if (this._initialized) return;
            this._initialized = true;
            const Modal = window.Lexicon.UI.Modal;
            // Every way of closing the dialog (Esc, close button, backdrop) runs the same cleanup
            Modal.beforeClose(MODAL_ID, () => {
                this._teardown();
                return true;
            });

            document.addEventListener('keydown', (e) => {
                if (!isOpen || !epubRendition) return;
                const tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
                if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
                if (e.key === 'ArrowLeft') { e.preventDefault(); this.prevEpubPage(); }
                if (e.key === 'ArrowRight') { e.preventDefault(); this.nextEpubPage(); }
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
         */
        async open(articleId) {
            const state = window.Lexicon.State;
            const id = Number(articleId || state.inspectedArticleId);
            const article = state.articles.find(a => a.id === id);
            if (!article) {
                window.Lexicon.UI.Toast.show(tr('reader.notFound', 'Documento não encontrado para leitura'), 'error');
                return;
            }

            // Switching documents while open: flush pending edits of the previous one first
            if (isOpen && currentArticleId !== null) {
                this.flushPendingSave();
            }

            currentArticleId = article.id;
            state.inspectedArticleId = article.id;

            if (article.status === 'inbox') {
                article.status = 'reading';
                window.Lexicon.Storage.save();
                window.Lexicon.Collections.render();
                window.Lexicon.Articles.render();
            }

            const Modal = window.Lexicon.UI.Modal;
            if (Modal.isOpen('inspector-modal')) Modal.close('inspector-modal');

            const modal = getModalEl();
            if (!modal) return;

            const splitTitleEl = document.getElementById('split-title');
            if (splitTitleEl) {
                splitTitleEl.textContent = article.title || tr('reader.untitled', 'Documento sem título');
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
            if (statusSelect) statusSelect.value = article.status || 'reading';

            window.Lexicon.Collections.fillSelect(document.getElementById('split-collection-select'), article.collection || '',
                { noneLabel: tr('reader.noCollection', '(Sem Coleção)') });

            const summaryEl = document.getElementById('split-reader-summary');
            if (summaryEl) summaryEl.value = article.summary || '';

            const notesEl = document.getElementById('split-reader-notes');
            if (notesEl) {
                notesEl.value = article.notes || '';
                if (window.Lexicon.Zettelkasten) window.Lexicon.Zettelkasten.attach(notesEl);
            }
            this.setSaveIndicator('saved');
            this.renderBacklinks();

            if (!isOpen) {
                Modal.open(MODAL_ID, { focus: false });
                isOpen = true;
            }

            await this.setupViewer(article);
        },

        /** Close the reader (all close paths end up in _teardown via the modal hook) */
        close() {
            if (!isOpen) return;
            window.Lexicon.UI.Modal.close(MODAL_ID);
        },

        _teardown() {
            if (!isOpen) return;
            this.flushPendingSave();
            cleanupViewer();
            isOpen = false;
            currentArticleId = null;
            if (isFullscreen) this.toggleFullscreen();
            if (window.Lexicon.Articles) window.Lexicon.Articles.render();
        },

        /** Re-render the viewer if the given article is currently shown (e.g. after relinking a file) */
        async refreshIfShowing(articleId) {
            if (!isOpen || currentArticleId !== Number(articleId)) return;
            const article = window.Lexicon.State.articles.find(a => a.id === currentArticleId);
            if (article) await this.setupViewer(article);
        },

        async setupViewer(article) {
            cleanupViewer();
            const token = openToken;

            const pdfFrame = document.getElementById('split-pdf-frame');
            const epubContainer = document.getElementById('split-epub-container');
            const epubToolbar = document.getElementById('split-epub-toolbar');
            const fileIcon = document.getElementById('split-file-icon');

            const storedFile = await window.Lexicon.Storage.getFile(article.id);
            if (token !== openToken) return; // another document was opened meanwhile

            const format = storedFile ? detectFormat(storedFile, article) : null;
            const showFrame = () => {
                if (epubContainer) epubContainer.classList.add('hidden');
                if (epubToolbar) epubToolbar.classList.add('hidden');
                if (pdfFrame) pdfFrame.classList.remove('hidden');
            };

            if (format === 'epub') {
                if (fileIcon) fileIcon.className = 'ph ph-book-open text-base text-jungle';
                if (pdfFrame) pdfFrame.classList.add('hidden');
                if (epubContainer) epubContainer.classList.remove('hidden');
                if (epubToolbar) epubToolbar.classList.remove('hidden');
                if (typeof window.ePub !== 'undefined') {
                    await this.initEpub(storedFile, token);
                } else {
                    this.renderEpubFallback(article);
                }
                return;
            }

            showFrame();
            if (!pdfFrame) return;
            if (fileIcon) fileIcon.className = article.coverType === 'book'
                ? 'ph ph-book-bookmark text-base text-terracotta'
                : 'ph ph-file-pdf text-base text-terracotta';

            if (format === 'pdf' || format === 'image') {
                // Native viewer; the browser PDF viewer does not work inside sandboxed frames
                pdfFrame.removeAttribute('sandbox');
                currentObjectUrl = URL.createObjectURL(storedFile);
                pdfFrame.src = format === 'pdf' ? `${currentObjectUrl}#toolbar=1&navpanes=1&view=FitH` : currentObjectUrl;
                return;
            }

            if (format === 'text') {
                pdfFrame.setAttribute('sandbox', '');
                const text = await storedFile.text();
                if (token !== openToken) return;
                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                currentObjectUrl = URL.createObjectURL(blob);
                pdfFrame.src = currentObjectUrl;
                return;
            }

            // No file, or a format the browser cannot display (doc/docx/mobi/djvu)
            const notice = format === 'unsupported'
                ? tr('reader.unsupportedFormat', 'Este formato ({ext}) não pode ser exibido no navegador. Use "Abrir em aba externa" para baixá-lo e abri-lo no aplicativo padrão.', { ext: (U().fileExt(storedFile.name || article.fileName) || '?').toUpperCase() })
                : null;
            pdfFrame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
            pdfFrame.removeAttribute('src');
            pdfFrame.srcdoc = generateFallbackDoc(article, notice);
        },

        async initEpub(fileOrBlob, token) {
            const container = document.getElementById('split-epub-container');
            if (!container) return;
            container.innerHTML = '';

            try {
                const arrayBuffer = await fileOrBlob.arrayBuffer();
                if (token !== openToken) return;
                const book = window.ePub(arrayBuffer);
                epubBook = book;
                epubRendition = book.renderTo('split-epub-container', {
                    width: '100%',
                    height: '100%',
                    flow: 'paginated',
                    spread: 'none',
                    allowScriptedContent: false
                });

                this.applyEpubTheme();
                await epubRendition.display();
                if (token !== openToken) return;

                const toc = await book.loaded.navigation;
                const tocSelect = document.getElementById('split-epub-toc-select');
                if (tocSelect && toc && Array.isArray(toc.toc)) {
                    tocSelect.textContent = '';
                    const first = document.createElement('option');
                    first.value = '';
                    first.textContent = tr('reader.chaptersCount', 'Sumário / Capítulos ({count})', { count: toc.toc.length });
                    tocSelect.appendChild(first);
                    toc.toc.forEach(item => {
                        const opt = document.createElement('option');
                        opt.value = item.href;
                        opt.textContent = String(item.label || '').trim();
                        tocSelect.appendChild(opt);
                    });
                }

                epubRendition.on('relocated', (location) => {
                    const progEl = document.getElementById('split-epub-progress');
                    if (!progEl || !location || !location.start || epubBook !== book) return;
                    let pct = NaN;
                    try {
                        if (book.locations && book.locations.length()) pct = book.locations.percentageFromCfi(location.start.cfi);
                    } catch (e) { pct = NaN; }
                    if (!isNaN(pct) && pct !== null) {
                        progEl.textContent = tr('reader.percentRead', '{pct}% lido', { pct: Math.round(pct * 100) });
                    } else if (location.start.displayed) {
                        progEl.textContent = `${location.start.displayed.page}/${location.start.displayed.total}`;
                    }
                });

                // Location generation is CPU heavy: only for reasonably sized books, when idle
                if (fileOrBlob.size <= EPUB_LOCATIONS_MAX_BYTES) {
                    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 500));
                    idle(() => {
                        if (epubBook === book) book.ready.then(() => book.locations.generate(1600)).catch(() => {});
                    });
                }
            } catch (err) {
                console.error('[Reader:EPUB] Failed to parse EPUB:', err);
                if (token === openToken) {
                    this.renderEpubFallback(window.Lexicon.State.articles.find(a => a.id === currentArticleId));
                }
            }
        },

        renderEpubFallback(article) {
            const container = document.getElementById('split-epub-container');
            if (!container || !article) return;

            container.innerHTML = `
                <div class="h-full overflow-y-auto p-8 md:p-12 flex flex-col items-center justify-center text-center bg-paper">
                    <div class="w-16 h-16 rounded-2xl bg-sand border border-wood flex items-center justify-center text-terracotta text-3xl mb-4 shadow-sm">
                        <i class="ph ph-book-bookmark" aria-hidden="true"></i>
                    </div>
                    <h2 class="text-xl font-serif font-bold text-soil max-w-lg mb-2">${esc(article.title)}</h2>
                    <p class="text-xs text-earth max-w-md mb-6">${U().display(article.authors, tr('reader.unknownAuthor', 'Autor desconhecido'))} • ${U().display(article.year, '—')}</p>
                    <div class="bg-sand/70 border border-wood rounded-xl p-5 max-w-lg text-left text-xs text-soil space-y-3 mb-6">
                        <div class="font-bold text-[11px] uppercase tracking-wider text-jungle flex items-center gap-1.5">
                            <i class="ph ph-info" aria-hidden="true"></i> ${esc(tr('reader.epubFormat', 'Formato de Livro (EPUB)'))}
                        </div>
                        <p class="leading-relaxed">${esc(tr('reader.epubCouldNotOpen', 'Não foi possível abrir o arquivo EPUB deste livro. Ele pode estar corrompido ou não ter sido anexado.'))}</p>
                    </div>
                    <button type="button" data-lx-click="Articles.relinkFileForInspected"
                            class="px-4 py-2 bg-jungle text-white rounded-xl text-xs font-semibold hover:bg-canopy transition-colors flex items-center gap-2 shadow-xs cursor-pointer">
                        <i class="ph ph-upload-simple" aria-hidden="true"></i>
                        <span>${esc(tr('reader.attachEpub', 'Anexar arquivo .epub'))}</span>
                    </button>
                </div>
            `;
        },

        applyEpubTheme() {
            if (!epubRendition) return;

            epubRendition.themes.fontSize(`${epubState.fontSize}px`);
            const fontMap = {
                'serif': "'Merriweather', Georgia, serif",
                'sans': "'Inter', system-ui, sans-serif",
                'mono': "'JetBrains Mono', monospace"
            };
            epubRendition.themes.font(fontMap[epubState.fontFamily] || fontMap.serif);

            if (!epubRendition._lexiconThemes) {
                epubRendition.themes.register('light', { body: { color: '#2D251F !important', background: '#FCFAF8 !important', 'line-height': '1.8 !important' } });
                epubRendition.themes.register('sepia', { body: { color: '#4A4036 !important', background: '#F4F1EA !important', 'line-height': '1.8 !important' } });
                epubRendition.themes.register('dark', { body: { color: '#E6DFD3 !important', background: '#2D251F !important', 'line-height': '1.8 !important' } });
                epubRendition._lexiconThemes = true;
            }
            epubRendition.themes.select(epubState.theme);

            const container = document.getElementById('split-epub-container');
            if (container) {
                container.style.backgroundColor = epubState.theme === 'dark' ? '#2D251F' :
                                                  epubState.theme === 'sepia' ? '#F4F1EA' : '#FCFAF8';
            }
        },

        changeEpubFontSize(delta) {
            epubState.fontSize = Math.min(28, Math.max(12, epubState.fontSize + Number(delta || 0)));
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
            if (epubRendition && href) epubRendition.display(href);
        },

        toggleFullscreen() {
            const modal = getModalEl();
            if (!modal) return;
            isFullscreen = !isFullscreen;
            const icon = document.getElementById('split-fullscreen-icon');
            if (icon) icon.className = isFullscreen ? 'ph ph-arrows-in text-sm' : 'ph ph-arrows-out text-sm';
            modal.classList.toggle('reader-fullscreen', isFullscreen);
        },

        openInExternalTab() {
            if (!currentArticleId) return;
            window.Lexicon.Articles.openDocumentInExternalTab(currentArticleId);
        },

        switchToInspector() {
            const id = currentArticleId;
            this.close();
            if (id && window.Lexicon.Articles) {
                setTimeout(() => window.Lexicon.Articles.inspect(id), 0);
            }
        },

        setSaveIndicator(stateName) {
            const indicator = document.getElementById('split-notes-save-indicator');
            if (!indicator) return;
            if (stateName === 'saving') {
                indicator.textContent = tr('reader.saving', 'Salvando...');
                indicator.className = 'text-[10px] text-terracotta italic';
            } else {
                indicator.textContent = tr('reader.autoSaved', 'Salvo automaticamente');
                indicator.className = 'text-[10px] text-earth/70 italic';
            }
        },

        onNotesInput() {
            this.setSaveIndicator('saving');
            // Capture the target article now: if the user switches documents before the
            // debounce fires, the edit must go to the article it was typed in.
            const articleId = currentArticleId;
            this._pendingFor = articleId;
            clearTimeout(autoSaveTimer);
            autoSaveTimer = setTimeout(() => {
                autoSaveTimer = null;
                if (currentArticleId === articleId) {
                    this.saveCurrentNotes();
                    this.setSaveIndicator('saved');
                }
            }, 600);
        },

        /** Save immediately if a debounced save is pending */
        flushPendingSave() {
            if (autoSaveTimer) {
                clearTimeout(autoSaveTimer);
                autoSaveTimer = null;
                if (this._pendingFor === currentArticleId) this.saveCurrentNotes();
            }
        },

        /** Save notes/summary/status/collection of the article currently shown */
        saveCurrentNotes() {
            if (!currentArticleId) return;
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === currentArticleId);
            if (!article) return;

            const notesEl = document.getElementById('split-reader-notes');
            const summaryEl = document.getElementById('split-reader-summary');
            const statusEl = document.getElementById('split-status-select');
            const colEl = document.getElementById('split-collection-select');
            const before = `${article.status}|${article.collection}`;

            if (notesEl) article.notes = notesEl.value;
            if (summaryEl) article.summary = summaryEl.value;
            if (statusEl && ['inbox', 'reading', 'processing', 'archived'].includes(statusEl.value)) article.status = statusEl.value;
            if (colEl) article.collection = colEl.value || null;

            window.Lexicon.Storage.save();
            this.renderBacklinks();
            if (before !== `${article.status}|${article.collection}`) {
                window.Lexicon.Collections.render();
            }
        },

        insertQuickCitation() {
            const textarea = isOpen ? document.getElementById('split-reader-notes') : document.getElementById('inspector-notes');
            if (!textarea) return;

            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const selected = text.substring(start, end).trim();

            const pageNum = window.prompt(tr('reader.pagePrompt', 'Digite o número da página citada (ou deixe em branco):'), '');
            if (pageNum === null) return;

            const dateStr = new Date().toLocaleDateString(locale());
            const pageRef = pageNum.trim() ? `(p. ${pageNum.trim()} - ${dateStr})` : `(${dateStr})`;
            const quoteText = selected || tr('reader.quotePlaceholder', 'trecho citado do documento...');
            const citationBlock = `\n\n> "${quoteText}" ${pageRef}\n\n`;

            textarea.value = text.substring(0, start) + citationBlock + text.substring(end);
            const nextCursor = start + citationBlock.length;
            textarea.setSelectionRange(nextCursor, nextCursor);
            textarea.focus();

            if (isOpen) this.onNotesInput();
            else if (window.Lexicon.Articles) window.Lexicon.Articles.autoSaveNotes();
            window.Lexicon.UI.Toast.show(tr('reader.citationInserted', 'Citação formatada inserida nas notas'), 'info');
        },

        insertFormatting(type) {
            const textarea = document.getElementById('split-reader-notes');
            if (!textarea) return;
            const result = window.Lexicon.Articles.applyFormatting(textarea, type);
            if (result) this.onNotesInput();
        },

        renderBacklinks() {
            const container = document.getElementById('split-reader-backlinks');
            if (!container || !currentArticleId) return;
            const article = window.Lexicon.State.articles.find(a => a.id === currentArticleId);
            if (article && window.Lexicon.Zettelkasten) {
                window.Lexicon.Zettelkasten.renderBacklinks(article, container);
            }
        },

        exportConsolidatedMarkdown() {
            if (!currentArticleId) return;
            this.flushPendingSave();
            const article = window.Lexicon.State.articles.find(a => a.id === currentArticleId);
            if (!article) return;
            if (window.Lexicon.Academic && typeof window.Lexicon.Academic.exportConsolidatedMarkdown === 'function') {
                window.Lexicon.Academic.exportConsolidatedMarkdown(article);
            }
        }
    };
})();
