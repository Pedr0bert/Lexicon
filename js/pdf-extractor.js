/* ==========================================================================
   Lexicon - Real PDF Text & Metadata Extractor
   Uses PDF.js in pure local mode (zero-build, local-first)
   Extracts Title, Authors, Year, Abstract and Raw Page Text
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    // Configure PDF.js worker to use local vendored worker
    function initPDFJS() {
        if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';
        }
    }

    /**
     * Clean and normalize raw extracted text
     */
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
        
        // Pattern 1: Explicit "Abstract" or "Resumo" section
        const match = text.match(/(?:^|\n)\s*(?:abstract|resumo|executive summary)\s*[:.\-—]?\s*\n?([\s\S]{120,3500}?)(?:\n\s*(?:1[\s.]|intro|key\s*words|palavras-chave|index terms|contents|background|methods))/i);
        if (match && match[1]) {
            return match[1].replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        }

        // Pattern 2: Simpler match for abstract paragraph
        const simpleMatch = text.match(/(?:abstract|resumo)\s*[:.\-—]\s*([^\n]{80,1200})/i);
        if (simpleMatch && simpleMatch[1]) {
            return simpleMatch[1].trim();
        }

        return '';
    }

    /**
     * Clean PDF metadata strings that may have byte order marks or encoding artifacts
     */
    function cleanMetadataString(val) {
        if (!val || typeof val !== 'string') return '';
        let cleaned = val.replace(/^\uFEFF/, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
        // Discard generic file path strings or untranslated placeholders
        if (cleaned.startsWith('Untitled') || cleaned.startsWith('Microsoft Word') || cleaned.endsWith('.pdf')) {
            return '';
        }
        return cleaned;
    }

    /**
     * Parse year from PDF CreationDate (e.g. "D:20240115123000")
     */
    function extractYearFromDate(dateStr) {
        if (!dateStr) return null;
        const match = String(dateStr).match(/\b(19\d\d|20\d\d)\b/);
        return match ? parseInt(match[1], 10) : null;
    }

    window.Lexicon.PDFExtractor = {
        init() {
            initPDFJS();
        },

        isAvailable() {
            return typeof window.pdfjsLib !== 'undefined';
        },

        /**
         * Extract text and metadata from a File or Blob
         * @param {File|Blob} blob
         * @param {number} [maxPages=3]
         * @returns {Promise<{title: string, authors: string, year: number|null, abstract: string, fullTextSnippet: string, pageCount: number}>}
         */
        async extractFromBlob(blob, maxPages = 3) {
            initPDFJS();
            if (!this.isAvailable()) {
                console.warn('[PDFExtractor] PDF.js not loaded yet.');
                return null;
            }

            try {
                const arrayBuffer = await blob.arrayBuffer();
                const loadingTask = window.pdfjsLib.getDocument({
                    data: arrayBuffer,
                    disableRange: true,
                    disableStream: true
                });

                const pdfDoc = await loadingTask.promise;
                const pageCount = pdfDoc.numPages || 1;

                // 1. Extract embedded PDF metadata
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

                // 2. Extract text from the first pages (where Title, Authors, Abstract live)
                const pagesToRead = Math.min(pageCount, maxPages);
                const pageTexts = [];

                for (let i = 1; i <= pagesToRead; i++) {
                    const page = await pdfDoc.getPage(i);
                    const textContent = await page.getTextContent();
                    
                    // Group text items by vertical position to preserve line structure
                    const items = textContent.items || [];
                    const lineMap = new Map();

                    for (const item of items) {
                        if (!item.str) continue;
                        const y = Math.round(item.transform[5]);
                        if (!lineMap.has(y)) {
                            lineMap.set(y, []);
                        }
                        lineMap.get(y).push(item.str);
                    }

                    // Sort descending by y (top of page to bottom)
                    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
                    const pageLines = sortedY.map(y => lineMap.get(y).join(' '));
                    pageTexts.push(pageLines.join('\n'));
                }

                const fullTextSnippet = normalizeText(pageTexts.join('\n\n--- Page Break ---\n\n'));
                const abstract = extractAbstractFromText(fullTextSnippet);

                // If no metadata title was found, heuristically inspect first lines of page 1
                if (!metaTitle && pageTexts[0]) {
                    const firstLines = pageTexts[0]
                        .split('\n')
                        .map(l => l.trim())
                        .filter(l => l.length > 5 && !/^(arxiv|doi|issn|isbn|vol|no|page|http|https)/i.test(l));
                    
                    if (firstLines.length > 0) {
                        const candidate = firstLines[0];
                        if (candidate.length >= 10 && candidate.length <= 250) {
                            metaTitle = candidate;
                        }
                    }
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
            }
        },

        /**
         * Extract text for an existing article by looking up its stored blob in IndexedDB
         * @param {Object} article
         * @returns {Promise<string|null>}
         */
        async extractTextForArticle(article) {
            if (!article || !article.id) return null;
            if (article.extractedText) return article.extractedText;

            const storedFile = await window.Lexicon.Storage.getFile(article.id);
            if (!storedFile) return null;

            // Only process PDFs
            const isPdf = storedFile.type === 'application/pdf' || 
                          (article.fileName && article.fileName.toLowerCase().endsWith('.pdf')) ||
                          article.coverType === 'pdf';
            if (!isPdf) return null;

            const result = await this.extractFromBlob(storedFile, 3);
            if (result && result.fullTextSnippet) {
                article.extractedText = result.fullTextSnippet;
                if (!article.summary && result.abstract) {
                    article.summary = result.abstract;
                }
                window.Lexicon.Storage.save();
                return article.extractedText;
            }
            return null;
        }
    };
})();
