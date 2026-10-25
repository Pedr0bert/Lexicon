/* ==========================================================================
   Lexicon - Real PDF Text & Metadata Extractor
   Uses PDF.js (v4, vendored) in pure local mode (zero-build, local-first)
   Extracts Title, Authors, Year, Abstract and Raw Page Text
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    const MAX_PDF_BYTES = 300 * 1024 * 1024; // refuse to parse absurdly large files in the UI thread
    const failedIds = new Set();             // avoid re-parsing PDFs that already failed this session
    const inFlight = new Map();              // articleId -> Promise (dedupe concurrent extractions)

    function initPDFJS() {
        if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.mjs';
        }
    }

    function normalizeText(str) {
        if (!str) return '';
        return str
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n\s*\n\s*\n+/g, '\n\n')
            .trim();
    }

    /**
     * Heuristically extract the Abstract/Resumo from page 1/2 text
     */
    function extractAbstractFromText(text) {
        if (!text) return '';
        const match = text.match(/(?:^|\n)\s*(?:abstract|resumo|executive summary)\s*[:.\-—]?\s*\n?([\s\S]{120,3500}?)(?:\n\s*(?:1[\s.]|intro|key\s*words|palavras-chave|index terms|contents|background|methods))/i);
        if (match && match[1]) {
            return match[1].replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        }
        const simpleMatch = text.match(/(?:abstract|resumo)\s*[:.\-—]\s*([^\n]{80,1200})/i);
        if (simpleMatch && simpleMatch[1]) {
            return simpleMatch[1].trim();
        }
        return '';
    }

    function cleanMetadataString(val) {
        if (!val || typeof val !== 'string') return '';
        const cleaned = val.replace(/^\uFEFF/, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
        if (/^(untitled|microsoft word|document\d*$|title$)/i.test(cleaned) || /\.(pdf|docx?|tex|dvi)$/i.test(cleaned) || cleaned.length < 4) {
            return '';
        }
        return cleaned;
    }

    function extractYearFromDate(dateStr) {
        if (!dateStr) return null;
        const match = String(dateStr).match(/(19\d\d|20\d\d)/);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * Rebuild reading order for one page. Items are bucketed by column (based on x
     * position relative to the page middle) and then by line (y), which keeps
     * two-column papers from interleaving their columns.
     */
    function pageItemsToText(items, pageWidth) {
        const textItems = items.filter(it => it && typeof it.str === 'string' && it.str.trim() && it.transform);
        if (!textItems.length) return '';

        const mid = pageWidth / 2;
        // Detect two-column layout: enough items start right of the middle and few cross it
        const leftStarts = textItems.filter(it => it.transform[4] < mid - 10).length;
        const rightStarts = textItems.filter(it => it.transform[4] >= mid).length;
        const crossing = textItems.filter(it => it.transform[4] < mid - 10 && (it.transform[4] + (it.width || 0)) > mid + 20).length;
        const twoColumns = rightStarts > textItems.length * 0.25 && leftStarts > textItems.length * 0.25 && crossing < textItems.length * 0.15;

        const columns = twoColumns ? [[], []] : [[]];
        textItems.forEach(it => {
            const col = twoColumns && it.transform[4] >= mid ? 1 : 0;
            columns[col].push(it);
        });

        const colTexts = columns.map(colItems => {
            const lineMap = new Map();
            colItems.forEach(it => {
                const y = Math.round(it.transform[5] / 2) * 2; // tolerate tiny baseline jitter
                if (!lineMap.has(y)) lineMap.set(y, []);
                lineMap.get(y).push(it);
            });
            return Array.from(lineMap.keys())
                .sort((a, b) => b - a)
                .map(y => lineMap.get(y).sort((a, b) => a.transform[4] - b.transform[4]).map(it => it.str).join(' '))
                .join('\n');
        });
        return colTexts.join('\n');
    }

    window.Lexicon.PDFExtractor = {
        init() {
            initPDFJS();
        },

        isAvailable() {
            initPDFJS();
            return typeof window.pdfjsLib !== 'undefined' && typeof window.pdfjsLib.getDocument === 'function';
        },

        /**
         * Extract text and metadata from a File or Blob
         * @param {File|Blob} blob
         * @param {number} [maxPages=3]
         * @returns {Promise<{title: string, authors: string, year: number|null, abstract: string, fullTextSnippet: string, pageCount: number}|null>}
         */
        async extractFromBlob(blob, maxPages = 3) {
            if (!this.isAvailable()) {
                console.warn('[PDFExtractor] PDF.js not loaded (serve the app over http:// to enable it).');
                return null;
            }
            if (!blob || blob.size > MAX_PDF_BYTES) return null;

            let pdfDoc = null;
            let loadingTask = null;
            try {
                const data = new Uint8Array(await blob.arrayBuffer());
                loadingTask = window.pdfjsLib.getDocument({
                    data,
                    // Security hardening (CVE-2024-4367 class of bugs): never compile font code with eval
                    isEvalSupported: false,
                    enableXfa: false,
                    disableFontFace: true,
                    useSystemFonts: false,
                    stopAtErrors: false
                });

                pdfDoc = await loadingTask.promise;
                const pageCount = pdfDoc.numPages || 1;

                let metaTitle = '';
                let metaAuthors = '';
                let metaYear = null;

                try {
                    const metaData = await pdfDoc.getMetadata();
                    if (metaData && metaData.info) {
                        const info = metaData.info;
                        metaTitle = cleanMetadataString(info.Title);
                        metaAuthors = cleanMetadataString(info.Author);
                        metaYear = extractYearFromDate(info.CreationDate || info.ModDate);
                    }
                } catch (metaErr) {
                    console.warn('[PDFExtractor] Could not extract PDF metadata:', metaErr);
                }

                const pagesToRead = Math.min(pageCount, maxPages);
                const pageTexts = [];

                for (let i = 1; i <= pagesToRead; i++) {
                    const page = await pdfDoc.getPage(i);
                    const viewport = page.getViewport({ scale: 1 });
                    const textContent = await page.getTextContent();
                    pageTexts.push(pageItemsToText(textContent.items || [], viewport.width));
                    page.cleanup();
                }

                const fullTextSnippet = normalizeText(pageTexts.join('\n\n--- Page Break ---\n\n'));
                const abstract = extractAbstractFromText(fullTextSnippet);

                // If no metadata title was found, heuristically inspect the first lines of page 1
                if (!metaTitle && pageTexts[0]) {
                    const firstLines = pageTexts[0]
                        .split('\n')
                        .map(l => l.trim())
                        .filter(l => l.length > 5 &&
                            !/^(arxiv|doi|issn|isbn|vol\b|volume|no\.|page|http|www\.|received|accepted|published|copyright|©|journal|proceedings|preprint)/i.test(l) &&
                            !/^\d+$/.test(l));
                    const candidate = firstLines.find(l => l.length >= 10 && l.length <= 250 && /[a-zA-Zà-ÿ]/.test(l));
                    if (candidate) metaTitle = candidate;
                }

                return {
                    title: metaTitle,
                    authors: metaAuthors,
                    year: metaYear,
                    abstract: abstract,
                    fullTextSnippet: fullTextSnippet,
                    pageCount: pageCount
                };
            } catch (err) {
                console.error('[PDFExtractor] Extraction failed:', err);
                return null;
            } finally {
                // Release worker memory for this document
                try {
                    if (pdfDoc) await pdfDoc.destroy();
                    else if (loadingTask) await loadingTask.destroy();
                } catch (e) { /* ignore */ }
            }
        },

        /**
         * Extract text for an existing article from its stored blob (cached in IndexedDB).
         * @param {Object} article
         * @param {{force?: boolean}} [opts]
         * @returns {Promise<string|null>}
         */
        async extractTextForArticle(article, opts = {}) {
            if (!article || !article.id) return null;
            if (article.extractedText && !opts.force) return article.extractedText;
            if (failedIds.has(article.id) && !opts.force) return null;
            if (inFlight.has(article.id)) return inFlight.get(article.id);

            const job = (async () => {
                const storedFile = await window.Lexicon.Storage.getFile(article.id);
                if (!storedFile) return null;

                const name = (storedFile.name || article.fileName || '').toLowerCase();
                const isPdf = storedFile.type === 'application/pdf' || name.endsWith('.pdf');
                if (!isPdf) return null;

                const result = await this.extractFromBlob(storedFile, 3);
                if (result && result.fullTextSnippet) {
                    await window.Lexicon.Storage.setExtractedText(article.id, result.fullTextSnippet);
                    if (!article.summary && result.abstract) {
                        article.summary = result.abstract;
                        window.Lexicon.Storage.save();
                    }
                    return result.fullTextSnippet;
                }
                failedIds.add(article.id);
                return null;
            })();

            inFlight.set(article.id, job);
            try {
                return await job;
            } finally {
                inFlight.delete(article.id);
            }
        },

        /** Forget cached text (e.g. after a different file was linked) */
        async invalidate(articleId) {
            failedIds.delete(Number(articleId));
            await window.Lexicon.Storage.setExtractedText(articleId, null);
        }
    };
})();
