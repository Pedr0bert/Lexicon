/* ==========================================================================
   Lexicon - Academic Automation & Citation Subsystem (Fase 2)
   DOI / arXiv Lookup (CrossRef & OpenAlex), BibTeX, ABNT, APA, Chicago, RIS
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    'use strict';

    const Academic = {
        /**
         * Parses and identifies various academic identifiers:
         * Standard DOI, DOI URL, arXiv IDs (new & old), arXiv URLs, arXiv DOIs.
         * @param {string} rawInput 
         * @returns {{ type: 'doi'|'arxiv', id?: string, doi?: string, raw: string } | null}
         */
        parseIdentifier(rawInput) {
            if (!rawInput || typeof rawInput !== 'string') return null;
            const input = rawInput.trim();
            if (!input) return null;

            // 1. Check for arXiv URL (e.g. https://arxiv.org/abs/2301.12345 or /pdf/2301.12345.pdf)
            const arxivUrlMatch = input.match(/arxiv\.org\/(?:abs|pdf)\/([a-zA-Z\-]+(?:\.[a-zA-Z\-]+)?\/\d{7}|\d{4}\.\d{4,5}(?:v\d+)?)(?:\.pdf)?/i);
            if (arxivUrlMatch) {
                return { type: 'arxiv', id: arxivUrlMatch[1], raw: input };
            }

            // 2. Check for arXiv DOI (e.g. 10.48550/arXiv.2301.12345)
            const arxivDoiMatch = input.match(/(?:(?:https?:\/\/)?(?:dx\.)?doi\.org\/)?(10\.48550\/arxiv\.([a-zA-Z\-]+(?:\.[a-zA-Z\-]+)?\/\d{7}|\d{4}\.\d{4,5}(?:v\d+)?))/i);
            if (arxivDoiMatch) {
                return { type: 'arxiv', id: arxivDoiMatch[2], doi: arxivDoiMatch[1], raw: input };
            }

            // 3. Check for arXiv prefix (e.g. "arXiv:2301.12345" or "arxiv: math/0405076")
            const arxivPrefixMatch = input.match(/^arxiv:\s*([a-zA-Z\-]+(?:\.[a-zA-Z\-]+)?\/\d{7}|\d{4}\.\d{4,5}(?:v\d+)?)/i);
            if (arxivPrefixMatch) {
                return { type: 'arxiv', id: arxivPrefixMatch[1], raw: input };
            }

            // 4. Check for pure new-style arXiv ID (e.g. 2301.12345 or 2301.12345v2)
            const arxivPureNewMatch = input.match(/^(\d{4}\.\d{4,5}(?:v\d+)?)$/i);
            if (arxivPureNewMatch) {
                return { type: 'arxiv', id: arxivPureNewMatch[1], raw: input };
            }

            // 5. Check for pure old-style arXiv ID (e.g. math/0405076 or hep-th/9912012)
            const arxivPureOldMatch = input.match(/^([a-zA-Z\-]+(?:\.[a-zA-Z\-]+)?\/\d{7}(?:v\d+)?)$/i);
            if (arxivPureOldMatch) {
                return { type: 'arxiv', id: arxivPureOldMatch[1], raw: input };
            }

            // 6. Check for standard DOI URL (e.g. https://doi.org/10.1016/... or dx.doi.org/...)
            const doiUrlMatch = input.match(/(?:https?:\/\/)?(?:dx\.)?doi\.org\/(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)/i);
            if (doiUrlMatch) {
                return { type: 'doi', doi: doiUrlMatch[1].replace(/[.,;)]+$/, ''), raw: input };
            }

            // 7. Check for standard DOI string (e.g. 10.1016/j.env.2024.01.004)
            const doiMatch = input.match(/^(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)$/i);
            if (doiMatch) {
                return { type: 'doi', doi: doiMatch[1].replace(/[.,;)]+$/, ''), raw: input };
            }

            // 8. If starts with 10. and has a slash, treat as DOI
            if (/^10\.\d{4,9}\/.+/i.test(input)) {
                return { type: 'doi', doi: input.replace(/[.,;)]+$/, ''), raw: input };
            }

            return null;
        },

        /**
         * Reconstructs text from OpenAlex inverted index abstract
         * @param {Object} invertedIndex 
         * @returns {string}
         */
        reconstructInvertedAbstract(invertedIndex) {
            if (!invertedIndex || typeof invertedIndex !== 'object') return '';
            const words = [];
            for (const [word, positions] of Object.entries(invertedIndex)) {
                if (Array.isArray(positions)) {
                    for (const pos of positions) {
                        words[pos] = word;
                    }
                }
            }
            return words.filter(Boolean).join(' ');
        },

        /**
         * Removes HTML/XML tags and normalizes spaces
         * @param {string} str 
         * @returns {string}
         */
        cleanText(str) {
            if (!str) return '';
            return String(str)
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        },

        /**
         * Fetches metadata from CrossRef API
         * @param {string} doi 
         * @returns {Promise<Object|null>}
         */
        async fetchFromCrossRef(doi) {
            const cleanDoi = doi.trim();
            const url = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            try {
                const response = await fetch(url, {
                    headers: {
                        'Accept': 'application/json'
                    },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) return null;
                const data = await response.json();
                if (!data || !data.message) return null;
                const msg = data.message;

                // Title
                const rawTitle = Array.isArray(msg.title) && msg.title.length ? msg.title[0] : (msg.title || '');
                const title = this.cleanText(rawTitle);

                // Authors
                let authors = '';
                if (Array.isArray(msg.author) && msg.author.length > 0) {
                    authors = msg.author.map(a => {
                        if (a.name) return a.name;
                        const parts = [];
                        if (a.given) parts.push(a.given);
                        if (a.family) parts.push(a.family);
                        return parts.join(' ');
                    }).filter(Boolean).join(', ');
                }

                // Year
                let year = null;
                const dateParts = msg['published-print']?.['date-parts'] ||
                                  msg['published-online']?.['date-parts'] ||
                                  msg.created?.['date-parts'] ||
                                  msg.issued?.['date-parts'];
                if (dateParts && dateParts[0] && dateParts[0][0]) {
                    year = parseInt(dateParts[0][0], 10);
                }

                // Journal / Publication
                const publication = (Array.isArray(msg['container-title']) && msg['container-title'].length)
                    ? msg['container-title'][0]
                    : (msg.publisher || '');

                // Volume, Issue, Pages
                const volume = msg.volume ? String(msg.volume) : '';
                const issue = msg.issue ? String(msg.issue) : '';
                const pages = msg.page ? String(msg.page) : '';

                // Abstract
                const abstract = msg.abstract ? this.cleanText(msg.abstract) : '';

                // Document type
                const isBook = msg.type === 'book' || msg.type === 'monograph' || msg.type === 'edited-book';
                const coverType = isBook ? 'book' : 'pdf';

                return {
                    title,
                    authors,
                    year,
                    publication,
                    volume,
                    issue,
                    pages,
                    doi: msg.DOI || cleanDoi,
                    summary: abstract,
                    coverType,
                    source: 'CrossRef'
                };
            } catch (err) {
                clearTimeout(timeoutId);
                return null;
            }
        },

        /**
         * Fetches metadata from OpenAlex API (Open, fast CORS, supports DOIs and arXiv)
         * @param {string} doiOrArxivId 
         * @returns {Promise<Object|null>}
         */
        async fetchFromOpenAlex(doiOrArxivId) {
            const id = doiOrArxivId.trim();
            const encodedTarget = encodeURIComponent(id.startsWith('10.') ? `https://doi.org/${id}` : id);
            const url = `https://api.openalex.org/works/${encodedTarget}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            try {
                const response = await fetch(url, {
                    headers: { 'Accept': 'application/json' },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) return null;
                const data = await response.json();
                if (!data || !data.title) return null;

                const title = this.cleanText(data.title);
                const authors = (data.authorships || [])
                    .map(a => a.author?.display_name)
                    .filter(Boolean)
                    .join(', ');
                const year = data.publication_year || null;
                const publication = data.primary_location?.source?.display_name ||
                                    data.host_venue?.display_name ||
                                    (data.type === 'preprint' ? 'arXiv' : '');
                
                const volume = data.biblio?.volume ? String(data.biblio.volume) : '';
                const issue = data.biblio?.issue ? String(data.biblio.issue) : '';
                let pages = '';
                if (data.biblio?.first_page && data.biblio?.last_page) {
                    pages = `${data.biblio.first_page}-${data.biblio.last_page}`;
                } else if (data.biblio?.first_page) {
                    pages = String(data.biblio.first_page);
                }

                let doi = id;
                if (data.doi) {
                    doi = data.doi.replace(/^https?:\/\/doi\.org\//i, '');
                }

                const abstract = this.reconstructInvertedAbstract(data.abstract_inverted_index);
                const coverType = data.type === 'book' ? 'book' : 'pdf';

                return {
                    title,
                    authors,
                    year,
                    publication,
                    volume,
                    issue,
                    pages,
                    doi,
                    summary: abstract,
                    coverType,
                    source: 'OpenAlex'
                };
            } catch (err) {
                clearTimeout(timeoutId);
                return null;
            }
        },

        /**
         * Fetches metadata from official arXiv export API (XML via DOMParser)
         * @param {string} arxivId 
         * @returns {Promise<Object|null>}
         */
        async fetchFromArXivExport(arxivId) {
            const cleanId = arxivId.replace(/^arxiv:\s*/i, '').trim();
            const url = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(cleanId)}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            try {
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!response.ok) return null;

                const text = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, 'text/xml');
                const entry = xmlDoc.querySelector('entry');
                if (!entry) return null;

                const rawTitle = entry.querySelector('title')?.textContent || '';
                const title = this.cleanText(rawTitle);
                if (!title || title.toLowerCase() === 'error') return null;

                const authorEls = entry.querySelectorAll('author name');
                const authors = Array.from(authorEls).map(el => el.textContent.trim()).filter(Boolean).join(', ');

                const published = entry.querySelector('published')?.textContent || '';
                let year = null;
                if (published && published.length >= 4) {
                    year = parseInt(published.substring(0, 4), 10);
                }

                const summary = this.cleanText(entry.querySelector('summary')?.textContent || '');
                const arxivDoi = `10.48550/arXiv.${cleanId}`;

                return {
                    title,
                    authors,
                    year,
                    publication: 'arXiv preprint',
                    volume: '',
                    issue: '',
                    pages: '',
                    doi: arxivDoi,
                    summary,
                    coverType: 'pdf',
                    source: 'arXiv'
                };
            } catch (err) {
                clearTimeout(timeoutId);
                return null;
            }
        },

        /**
         * Comprehensive metadata lookup:
         * Intelligently resolves DOIs, arXiv IDs, and URLs with automatic fallbacks.
         * @param {string} rawInput 
         * @returns {Promise<Object|null>}
         */
        async fetchMetadata(rawInput) {
            const parsed = this.parseIdentifier(rawInput);
            if (!parsed) return null;

            if (parsed.type === 'arxiv') {
                const arxivId = parsed.id;
                const arxivDoi = parsed.doi || `10.48550/arXiv.${arxivId}`;

                // 1. Try OpenAlex by arXiv DOI
                let meta = await this.fetchFromOpenAlex(arxivDoi);
                if (meta) return meta;

                // 2. Try official arXiv Export API
                meta = await this.fetchFromArXivExport(arxivId);
                if (meta) return meta;

                // 3. Try CrossRef for arXiv DOI
                meta = await this.fetchFromCrossRef(arxivDoi);
                if (meta) return meta;

                return null;
            }

            if (parsed.type === 'doi') {
                const cleanDoi = parsed.doi;

                // 1. Try CrossRef API (official standard for DOI)
                let meta = await this.fetchFromCrossRef(cleanDoi);
                if (meta) return meta;

                // 2. Fallback to OpenAlex
                meta = await this.fetchFromOpenAlex(cleanDoi);
                if (meta) return meta;

                return null;
            }

            return null;
        },

        /**
         * UI Action: Fetches metadata for current input in Inspector Modal
         */
        async fetchInspectorMetadata() {
            const doiInput = document.getElementById('inspector-doi');
            if (!doiInput) return;
            const rawVal = doiInput.value.trim();

            if (!rawVal) {
                const warnMsg = window.Lexicon.I18n
                    ? window.Lexicon.I18n.t('inspector.promptEnterDoi')
                    : 'Please enter a DOI or arXiv ID first';
                window.Lexicon.UI.Toast.show(warnMsg, 'info');
                doiInput.focus();
                return;
            }

            const btn = document.getElementById('btn-inspector-fetch-doi');
            const icon = document.getElementById('icon-inspector-fetch-doi');
            const text = document.getElementById('text-inspector-fetch-doi');

            if (btn) btn.disabled = true;
            if (icon) icon.className = 'ph ph-spinner animate-spin text-base text-jungle';
            if (text) {
                text.textContent = window.Lexicon.I18n
                    ? window.Lexicon.I18n.t('inspector.fetchingMetadata')
                    : 'Fetching...';
            }

            try {
                const meta = await this.fetchMetadata(rawVal);
                if (!meta) {
                    const notFoundMsg = window.Lexicon.I18n
                        ? window.Lexicon.I18n.t('inspector.metadataNotFound')
                        : 'Could not find metadata for this identifier.';
                    window.Lexicon.UI.Toast.show(notFoundMsg, 'error');
                    return;
                }

                // Populate Inspector Inputs
                const titleEl = document.getElementById('inspector-title');
                const authorEl = document.getElementById('inspector-author');
                const yearEl = document.getElementById('inspector-year');
                const pubEl = document.getElementById('inspector-publication');
                const summaryEl = document.getElementById('inspector-summary');
                const doiLinkEl = document.getElementById('inspector-doi-link');

                if (titleEl && meta.title) titleEl.value = meta.title;
                if (authorEl && meta.authors) authorEl.value = meta.authors;
                if (yearEl && meta.year) yearEl.value = meta.year;
                if (pubEl && meta.publication) pubEl.value = meta.publication;
                if (doiInput && meta.doi) doiInput.value = meta.doi;

                // Update summary if currently blank or user confirms
                if (summaryEl && meta.summary) {
                    if (!summaryEl.value.trim() || confirm(
                        window.Lexicon.I18n
                            ? window.Lexicon.I18n.t('inspector.confirmOverwriteSummary')
                            : 'Update abstract/summary with official metadata?'
                    )) {
                        summaryEl.value = meta.summary;
                    }
                }

                // Update external link
                if (doiLinkEl && meta.doi) {
                    let doiUrl = meta.doi;
                    if (/arxiv/i.test(meta.doi)) {
                        const cleanArxiv = meta.doi.replace(/^arxiv:\s*/i, '').replace(/^10\.48550\/arxiv\./i, '');
                        doiUrl = `https://arxiv.org/abs/${cleanArxiv}`;
                    } else if (!doiUrl.startsWith('http')) {
                        doiUrl = `https://doi.org/${meta.doi}`;
                    }
                    doiLinkEl.href = doiUrl;
                    doiLinkEl.classList.remove('hidden');
                }

                // Also store extra biblio metadata in active article object if available
                const state = window.Lexicon.State;
                const article = state.articles.find(a => a.id === state.inspectedArticleId);
                if (article) {
                    if (meta.title) article.title = meta.title;
                    if (meta.authors) article.authors = meta.authors;
                    if (meta.year) article.year = meta.year;
                    if (meta.publication) article.publication = meta.publication;
                    if (meta.doi) article.doi = meta.doi;
                    if (meta.volume) article.volume = meta.volume;
                    if (meta.issue) article.issue = meta.issue;
                    if (meta.pages) article.pages = meta.pages;
                    if (summaryEl && summaryEl.value) article.summary = summaryEl.value;

                    window.Lexicon.Storage.save();
                    window.Lexicon.Articles.render();
                }

                const successMsg = window.Lexicon.I18n
                    ? window.Lexicon.I18n.t('inspector.metadataSuccess', { source: meta.source })
                    : `Metadata imported from ${meta.source}!`;
                window.Lexicon.UI.Toast.show(successMsg, 'success');
            } catch (err) {
                console.error('Error in fetchInspectorMetadata:', err);
                const errMsg = window.Lexicon.I18n
                    ? window.Lexicon.I18n.t('inspector.metadataError')
                    : 'Error fetching metadata.';
                window.Lexicon.UI.Toast.show(errMsg, 'error');
            } finally {
                if (btn) btn.disabled = false;
                if (icon) icon.className = 'ph ph-cloud-arrow-down text-base text-jungle';
                if (text) {
                    text.textContent = window.Lexicon.I18n
                        ? window.Lexicon.I18n.t('inspector.fetchMetadata')
                        : 'Buscar Metadados';
                }
            }
        },

        /**
         * UI Action: Fetches metadata for current input in Add Document Modal (Single Tab)
         */
        async fetchUploadFormMetadata() {
            const doiInput = document.getElementById('form-doi');
            if (!doiInput) return;
            const rawVal = doiInput.value.trim();

            if (!rawVal) {
                const warnMsg = window.Lexicon.I18n
                    ? window.Lexicon.I18n.t('inspector.promptEnterDoi')
                    : 'Please enter a DOI or arXiv ID first';
                window.Lexicon.UI.Toast.show(warnMsg, 'info');
                doiInput.focus();
                return;
            }

            const btn = document.getElementById('btn-form-fetch-doi');
            const icon = document.getElementById('icon-form-fetch-doi');
            const text = document.getElementById('text-form-fetch-doi');

            if (btn) btn.disabled = true;
            if (icon) icon.className = 'ph ph-spinner animate-spin text-base text-jungle';
            if (text) {
                text.textContent = window.Lexicon.I18n
                    ? window.Lexicon.I18n.t('inspector.fetchingMetadata')
                    : 'Fetching...';
            }

            try {
                const meta = await this.fetchMetadata(rawVal);
                if (!meta) {
                    const notFoundMsg = window.Lexicon.I18n
                        ? window.Lexicon.I18n.t('inspector.metadataNotFound')
                        : 'Could not find metadata for this identifier.';
                    window.Lexicon.UI.Toast.show(notFoundMsg, 'error');
                    return;
                }

                const titleEl = document.getElementById('form-title');
                const authorEl = document.getElementById('form-author');
                const yearEl = document.getElementById('form-year');
                const pubEl = document.getElementById('form-pub');
                const summaryEl = document.getElementById('form-summary');

                if (titleEl && meta.title) titleEl.value = meta.title;
                if (authorEl && meta.authors) authorEl.value = meta.authors;
                if (yearEl && meta.year) yearEl.value = meta.year;
                if (pubEl && meta.publication) pubEl.value = meta.publication;
                if (summaryEl && meta.summary) summaryEl.value = meta.summary;
                if (doiInput && meta.doi) doiInput.value = meta.doi;

                const successMsg = window.Lexicon.I18n
                    ? window.Lexicon.I18n.t('inspector.metadataSuccess', { source: meta.source })
                    : `Metadata imported from ${meta.source}!`;
                window.Lexicon.UI.Toast.show(successMsg, 'success');
            } catch (err) {
                console.error('Error in fetchUploadFormMetadata:', err);
                const errMsg = window.Lexicon.I18n
                    ? window.Lexicon.I18n.t('inspector.metadataError')
                    : 'Error fetching metadata.';
                window.Lexicon.UI.Toast.show(errMsg, 'error');
            } finally {
                if (btn) btn.disabled = false;
                if (icon) icon.className = 'ph ph-cloud-arrow-down text-base text-jungle';
                if (text) {
                    text.textContent = window.Lexicon.I18n
                        ? window.Lexicon.I18n.t('inspector.fetchMetadata')
                        : 'Buscar Metadados';
                }
            }
        },

        /**
         * Tokenizes and parses author strings into structured author items
         * @param {string} authorStr 
         * @returns {Array<{ raw: string, family: string, given: string, initials: string, initialsCompact: string }>}
         */
        parseAuthors(authorStr) {
            if (!authorStr || typeof authorStr !== 'string') return [];
            const cleaned = authorStr.trim();
            if (!cleaned) return [];

            let rawList = [];
            if (/\s+and\s+/i.test(cleaned)) {
                rawList = cleaned.split(/\s+and\s+/i);
            } else if (cleaned.includes(';')) {
                rawList = cleaned.split(';');
            } else if (cleaned.includes(',')) {
                const commaCount = (cleaned.match(/,/g) || []).length;
                if (commaCount === 1) {
                    // "Surname, Given"
                    rawList = [cleaned];
                } else if (/^[A-Za-zÀ-ÿ\-]+,\s*[A-ZÀ-ÿ]\.(?:\s*[A-ZÀ-ÿ]\.)?,/i.test(cleaned)) {
                    // Pattern "Surname, Initials, Surname, Initials..."
                    const parts = cleaned.split(/\s*,\s*/);
                    for (let i = 0; i < parts.length; i += 2) {
                        if (i + 1 < parts.length) {
                            rawList.push(`${parts[i]}, ${parts[i+1]}`);
                        } else {
                            rawList.push(parts[i]);
                        }
                    }
                } else {
                    rawList = cleaned.split(',');
                }
            } else {
                rawList = [cleaned];
            }

            return rawList.map(raw => {
                const item = raw.trim();
                if (!item) return null;

                let family = '';
                let given = '';

                if (item.includes(',')) {
                    const parts = item.split(',').map(s => s.trim());
                    family = parts[0] || '';
                    given = parts.slice(1).join(' ') || '';
                } else {
                    const tokens = item.split(/\s+/).filter(Boolean);
                    if (tokens.length === 1) {
                        family = tokens[0];
                        given = '';
                    } else {
                        family = tokens[tokens.length - 1];
                        given = tokens.slice(0, -1).join(' ');
                    }
                }

                const givenWords = given ? given.replace(/[.]/g, '').split(/\s+/).filter(Boolean) : [];
                const initialsWithDots = givenWords.map(w => w.charAt(0).toUpperCase() + '.').join(' ');
                const initialsCompact = givenWords.map(w => w.charAt(0).toUpperCase()).join('');

                return {
                    raw: item,
                    family,
                    given,
                    initials: initialsWithDots,
                    initialsCompact
                };
            }).filter(Boolean);
        },

        /**
         * Formats reference according to Brazilian ABNT NBR 6023 standard
         * @param {Object} article 
         * @returns {string}
         */
        formatABNT(article) {
            if (!article) return '';
            const authors = this.parseAuthors(article.authors);
            let authorText = '';

            if (authors.length === 0) {
                authorText = (article.title || 'DOCUMENTO').toUpperCase().split(/\s+/)[0];
            } else if (authors.length <= 3) {
                authorText = authors.map(a => {
                    const fam = (a.family || a.raw).toUpperCase();
                    return a.given ? `${fam}, ${a.given}` : fam;
                }).join('; ');
            } else {
                // 4 or more authors: First author et al.
                const first = authors[0];
                const fam = (first.family || first.raw).toUpperCase();
                authorText = first.given ? `${fam}, ${first.given} et al.` : `${fam} et al.`;
            }

            const authorPart = authorText.endsWith('.') ? authorText : authorText + '.';
            const title = article.title ? article.title.trim().replace(/\.+$/, '') : 'Sem título';
            const isBook = article.coverType === 'book';
            const pub = article.publication ? article.publication.trim() : '';
            const year = article.year || 's.d.';
            const doi = article.doi ? article.doi.trim() : '';

            let citation = '';
            if (isBook) {
                citation = `${authorPart} ${title}. ${pub ? pub + ', ' : ''}${year}.`;
            } else {
                const details = [];
                if (article.volume) details.push(`v. ${article.volume}`);
                if (article.issue) details.push(`n. ${article.issue}`);
                if (article.pages) details.push(`p. ${article.pages}`);
                details.push(year);
                const detailsStr = details.join(', ');

                if (pub) {
                    citation = `${authorPart} ${title}. ${pub}, ${detailsStr}.`;
                } else {
                    citation = `${authorPart} ${title}. ${year}.`;
                }
            }

            if (doi) {
                let doiUrl = doi;
                if (/arxiv/i.test(doi)) {
                    const cleanArxiv = doi.replace(/^arxiv:\s*/i, '').replace(/^10\.48550\/arxiv\./i, '');
                    doiUrl = `https://arxiv.org/abs/${cleanArxiv}`;
                } else if (!doiUrl.startsWith('http')) {
                    doiUrl = `https://doi.org/${doi}`;
                }
                citation += ` Disponível em: <${doiUrl}>.`;
            }

            return citation;
        },

        /**
         * Formats reference according to American Psychological Association (APA 7th Edition)
         * @param {Object} article 
         * @returns {string}
         */
        formatAPA(article) {
            if (!article) return '';
            const authors = this.parseAuthors(article.authors);
            let authorText = '';

            if (authors.length === 0) {
                authorText = article.title || 'Unknown';
            } else if (authors.length === 1) {
                const a = authors[0];
                authorText = a.initials ? `${a.family}, ${a.initials}` : a.family;
            } else if (authors.length === 2) {
                const a1 = authors[0].initials ? `${authors[0].family}, ${authors[0].initials}` : authors[0].family;
                const a2 = authors[1].initials ? `${authors[1].family}, ${authors[1].initials}` : authors[1].family;
                authorText = `${a1}, & ${a2}`;
            } else if (authors.length <= 20) {
                const list = authors.map(a => a.initials ? `${a.family}, ${a.initials}` : a.family);
                const last = list.pop();
                authorText = `${list.join(', ')}, & ${last}`;
            } else {
                // Over 20 authors: first 19, ..., last
                const list = authors.slice(0, 19).map(a => a.initials ? `${a.family}, ${a.initials}` : a.family);
                const last = authors[authors.length - 1];
                const lastStr = last.initials ? `${last.family}, ${last.initials}` : last.family;
                authorText = `${list.join(', ')}, ... ${lastStr}`;
            }

            const authorPart = authorText.endsWith('.') ? authorText : authorText + '.';
            const year = article.year ? `(${article.year})` : '(n.d.)';
            const title = article.title ? article.title.trim().replace(/\.+$/, '') : 'Untitled';
            const isBook = article.coverType === 'book';
            const pub = article.publication ? article.publication.trim() : '';
            const doi = article.doi ? article.doi.trim() : '';

            let citation = `${authorPart} ${year}. ${title}.`;
            if (pub) {
                let loc = pub;
                if (article.volume) {
                    loc += `, ${article.volume}`;
                    if (article.issue) loc += `(${article.issue})`;
                }
                if (article.pages) {
                    loc += `, ${article.pages}`;
                }
                citation += ` ${loc}.`;
            }

            if (doi) {
                let doiUrl = doi;
                if (/arxiv/i.test(doi)) {
                    const cleanArxiv = doi.replace(/^arxiv:\s*/i, '').replace(/^10\.48550\/arxiv\./i, '');
                    doiUrl = `https://arxiv.org/abs/${cleanArxiv}`;
                } else if (!doiUrl.startsWith('http')) {
                    doiUrl = `https://doi.org/${doi}`;
                }
                citation += ` ${doiUrl}`;
            }

            return citation;
        },

        /**
         * Formats reference according to Chicago Manual of Style (17th ed., Author-Date)
         * @param {Object} article 
         * @returns {string}
         */
        formatChicago(article) {
            if (!article) return '';
            const authors = this.parseAuthors(article.authors);
            let authorText = '';

            if (authors.length === 0) {
                authorText = article.title || 'Unknown';
            } else if (authors.length === 1) {
                authorText = authors[0].given ? `${authors[0].family}, ${authors[0].given}` : authors[0].family;
            } else if (authors.length === 2) {
                const a1 = authors[0].given ? `${authors[0].family}, ${authors[0].given}` : authors[0].family;
                const a2 = authors[1].given ? `${authors[1].given} ${authors[1].family}` : authors[1].family;
                authorText = `${a1}, and ${a2}`;
            } else if (authors.length === 3) {
                const a1 = authors[0].given ? `${authors[0].family}, ${authors[0].given}` : authors[0].family;
                const a2 = authors[1].given ? `${authors[1].given} ${authors[1].family}` : authors[1].family;
                const a3 = authors[2].given ? `${authors[2].given} ${authors[2].family}` : authors[2].family;
                authorText = `${a1}, ${a2}, and ${a3}`;
            } else {
                const first = authors[0];
                authorText = (first.given ? `${first.family}, ${first.given}` : first.family) + ', et al.';
            }

            const authorPart = authorText.endsWith('.') ? authorText : authorText + '.';
            const year = article.year || 'n.d.';
            const title = article.title ? article.title.trim().replace(/\.+$/, '') : 'Untitled';
            const isBook = article.coverType === 'book';
            const pub = article.publication ? article.publication.trim() : '';
            const doi = article.doi ? article.doi.trim() : '';

            let citation = `${authorPart} ${year}. `;
            if (isBook) {
                citation += `${title}. ${pub ? pub + '.' : ''}`;
            } else {
                citation += `"${title}." `;
                if (pub) {
                    citation += `${pub}`;
                    if (article.volume) {
                        citation += ` ${article.volume}`;
                        if (article.issue) citation += `, no. ${article.issue}`;
                    }
                    if (article.pages) {
                        citation += `: ${article.pages}`;
                    }
                    citation += '.';
                }
            }

            if (doi) {
                let doiUrl = doi;
                if (/arxiv/i.test(doi)) {
                    const cleanArxiv = doi.replace(/^arxiv:\s*/i, '').replace(/^10\.48550\/arxiv\./i, '');
                    doiUrl = `https://arxiv.org/abs/${cleanArxiv}`;
                } else if (!doiUrl.startsWith('http')) {
                    doiUrl = `https://doi.org/${doi}`;
                }
                citation += ` ${doiUrl}.`;
            }

            return citation;
        },

        /**
         * Formats reference according to Vancouver (ICMJE/NLM style)
         * @param {Object} article 
         * @returns {string}
         */
        formatVancouver(article) {
            if (!article) return '';
            const authors = this.parseAuthors(article.authors);
            let authorText = '';

            if (authors.length === 0) {
                authorText = article.title || 'Unknown';
            } else if (authors.length <= 6) {
                authorText = authors.map(a => {
                    const fam = a.family || a.raw;
                    return a.initialsCompact ? `${fam} ${a.initialsCompact}` : fam;
                }).join(', ');
            } else {
                const first6 = authors.slice(0, 6).map(a => {
                    const fam = a.family || a.raw;
                    return a.initialsCompact ? `${fam} ${a.initialsCompact}` : fam;
                }).join(', ');
                authorText = `${first6}, et al.`;
            }

            const authorPart = authorText.endsWith('.') ? authorText : authorText + '.';
            const title = article.title ? article.title.trim().replace(/\.+$/, '') : 'Untitled';
            const pub = article.publication ? article.publication.trim() : '';
            const year = article.year || '';
            const doi = article.doi ? article.doi.trim() : '';

            let citation = `${authorPart} ${title}.`;
            if (pub) {
                citation += ` ${pub}.`;
                if (year) {
                    citation += ` ${year}`;
                    if (article.volume) {
                        citation += `;${article.volume}`;
                        if (article.issue) citation += `(${article.issue})`;
                    }
                    if (article.pages) {
                        citation += `:${article.pages}`;
                    }
                    citation += '.';
                }
            } else if (year) {
                citation += ` ${year}.`;
            }

            if (doi) {
                const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, '');
                citation += ` doi:${cleanDoi}`;
            }

            return citation;
        },

        /**
         * Generates clean unique citation key for BibTeX
         * @param {Object} article 
         * @returns {string}
         */
        generateCiteKey(article) {
            const authors = this.parseAuthors(article.authors);
            let authorPart = 'doc';
            if (authors.length > 0 && authors[0].family) {
                authorPart = authors[0].family.toLowerCase().replace(/[^a-z0-9]/g, '');
            }
            const yearPart = article.year || 'nodate';
            let titleWord = '';
            if (article.title) {
                const words = article.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
                const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'of', 'and', 'for', 'to', 'with', 'by', 'at', 'from', 'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'em', 'para', 'com']);
                const significant = words.find(w => w.length > 2 && !stopWords.has(w));
                titleWord = significant || words[0] || '';
            }
            return `${authorPart}${yearPart}${titleWord}`.slice(0, 30);
        },

        /**
         * Generates standardized BibTeX string (.bib)
         * @param {Object} article 
         * @returns {string}
         */
        toBibTeX(article) {
            if (!article) return '';
            const isBook = article.coverType === 'book';
            const type = isBook ? 'book' : 'article';
            const key = this.generateCiteKey(article);

            const authors = this.parseAuthors(article.authors);
            let bibAuthors = '';
            if (authors.length > 0) {
                bibAuthors = authors.map(a => {
                    if (a.family && a.given) {
                        return `${a.family}, ${a.given}`;
                    }
                    return a.raw;
                }).join(' and ');
            } else {
                bibAuthors = article.authors || '';
            }

            const lines = [];
            lines.push(`@${type}{${key},`);
            if (article.title) lines.push(`  title = {${article.title}},`);
            if (bibAuthors) lines.push(`  author = {${bibAuthors}},`);
            if (isBook) {
                if (article.publication) lines.push(`  publisher = {${article.publication}},`);
            } else {
                if (article.publication) lines.push(`  journal = {${article.publication}},`);
            }
            if (article.year) lines.push(`  year = {${article.year}},`);
            if (article.volume) lines.push(`  volume = {${article.volume}},`);
            if (article.issue) lines.push(`  number = {${article.issue}},`);
            if (article.pages) lines.push(`  pages = {${article.pages}},`);
            if (article.doi) {
                const cleanDoi = article.doi.replace(/^https?:\/\/doi\.org\//i, '');
                lines.push(`  doi = {${cleanDoi}},`);
                const url = article.doi.startsWith('http') ? article.doi : `https://doi.org/${cleanDoi}`;
                lines.push(`  url = {${url}},`);
            }
            if (article.summary) {
                const cleanSummary = article.summary.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
                lines.push(`  abstract = {${cleanSummary}},`);
            }
            if (article.tags && Array.isArray(article.tags) && article.tags.length > 0) {
                lines.push(`  keywords = {${article.tags.join(', ')}},`);
            }

            // Remove trailing comma from last property
            const lastIdx = lines.length - 1;
            if (lines[lastIdx].endsWith(',')) {
                lines[lastIdx] = lines[lastIdx].slice(0, -1);
            }
            lines.push('}');
            return lines.join('\n');
        },

        /**
         * Generates standardized RIS file format (.ris) for Zotero, Mendeley, EndNote
         * @param {Object} article 
         * @returns {string}
         */
        toRIS(article) {
            if (!article) return '';
            const isBook = article.coverType === 'book';
            const type = isBook ? 'BOOK' : 'JOUR';
            const lines = [];

            lines.push(`TY  - ${type}`);
            if (article.title) lines.push(`TI  - ${article.title}`);

            const authors = this.parseAuthors(article.authors);
            if (authors.length > 0) {
                authors.forEach(a => {
                    if (a.family && a.given) {
                        lines.push(`AU  - ${a.family}, ${a.given}`);
                    } else {
                        lines.push(`AU  - ${a.raw}`);
                    }
                });
            } else if (article.authors) {
                lines.push(`AU  - ${article.authors}`);
            }

            if (isBook) {
                if (article.publication) lines.push(`PB  - ${article.publication}`);
            } else {
                if (article.publication) lines.push(`T2  - ${article.publication}`);
            }

            if (article.year) lines.push(`PY  - ${article.year}`);
            if (article.volume) lines.push(`VL  - ${article.volume}`);
            if (article.issue) lines.push(`IS  - ${article.issue}`);
            if (article.pages) {
                const pParts = String(article.pages).split(/[-–]/);
                if (pParts.length > 1) {
                    lines.push(`SP  - ${pParts[0].trim()}`);
                    lines.push(`EP  - ${pParts[1].trim()}`);
                } else {
                    lines.push(`SP  - ${String(article.pages).trim()}`);
                }
            }
            if (article.doi) {
                const cleanDoi = article.doi.replace(/^https?:\/\/doi\.org\//i, '');
                lines.push(`DO  - ${cleanDoi}`);
                const url = article.doi.startsWith('http') ? article.doi : `https://doi.org/${cleanDoi}`;
                lines.push(`UR  - ${url}`);
            }
            if (article.summary) {
                lines.push(`AB  - ${article.summary.replace(/\s+/g, ' ').trim()}`);
            }
            if (Array.isArray(article.tags)) {
                article.tags.forEach(tag => {
                    lines.push(`KW  - ${tag}`);
                });
            }
            lines.push('ER  - ');
            return lines.join('\r\n') + '\r\n';
        },

        /**
         * Safely copies text to clipboard with fallback for non-HTTPS / restricted contexts
         * @param {string} text 
         * @returns {Promise<boolean>}
         */
        async copyToClipboard(text) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(text);
                    return true;
                } catch (err) {
                    console.warn('navigator.clipboard write failed, using fallback:', err);
                }
            }
            // Fallback for document.execCommand
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '-9999px';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textarea);
                return successful;
            } catch (err) {
                document.body.removeChild(textarea);
                return false;
            }
        },

        /**
         * Downloads text content as a file
         * @param {string} content 
         * @param {string} filename 
         * @param {string} mimeType 
         */
        downloadFile(content, filename, mimeType) {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        },

        /**
         * Copies formatted academic citation for inspected document
         * @param {'abnt'|'apa'|'chicago'|'vancouver'} format 
         */
        async copyCitationForInspected(format) {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article) return;

            this.closeCiteMenu();

            let citation = '';
            let formatName = '';

            switch (format) {
                case 'abnt':
                    citation = this.formatABNT(article);
                    formatName = 'ABNT';
                    break;
                case 'apa':
                    citation = this.formatAPA(article);
                    formatName = 'APA 7';
                    break;
                case 'chicago':
                    citation = this.formatChicago(article);
                    formatName = 'Chicago';
                    break;
                case 'vancouver':
                    citation = this.formatVancouver(article);
                    formatName = 'Vancouver';
                    break;
                default:
                    citation = this.formatABNT(article);
                    formatName = 'ABNT';
            }

            const success = await this.copyToClipboard(citation);
            if (success) {
                const toastMsg = window.Lexicon.I18n
                    ? window.Lexicon.I18n.t('inspector.copiedCitation', { format: formatName })
                    : `Reference copied in ${formatName} format!`;
                window.Lexicon.UI.Toast.show(toastMsg, 'success');
            } else {
                window.Lexicon.UI.Toast.show('Error copying to clipboard', 'error');
            }
        },

        /**
         * Copies BibTeX entry for inspected document to clipboard
         */
        async copyBibTeXForInspected() {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article) return;

            this.closeCiteMenu();
            const bibtex = this.toBibTeX(article);
            const success = await this.copyToClipboard(bibtex);

            if (success) {
                const toastMsg = window.Lexicon.I18n
                    ? window.Lexicon.I18n.t('inspector.copiedBibtex')
                    : 'BibTeX entry copied to clipboard!';
                window.Lexicon.UI.Toast.show(toastMsg, 'success');
            } else {
                window.Lexicon.UI.Toast.show('Error copying to clipboard', 'error');
            }
        },

        /**
         * Downloads individual .bib file for inspected document
         */
        downloadBibTeXForInspected() {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article) return;

            this.closeCiteMenu();
            const bibtex = this.toBibTeX(article);
            const key = this.generateCiteKey(article);
            this.downloadFile(bibtex, `${key}.bib`, 'application/x-bibtex');

            const toastMsg = window.Lexicon.I18n
                ? window.Lexicon.I18n.t('inspector.downloadedBibtex')
                : 'BibTeX file (.bib) downloaded!';
            window.Lexicon.UI.Toast.show(toastMsg, 'success');
        },

        /**
         * Downloads individual .ris file for inspected document
         */
        downloadRISForInspected() {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article) return;

            this.closeCiteMenu();
            const ris = this.toRIS(article);
            const key = this.generateCiteKey(article);
            this.downloadFile(ris, `${key}.ris`, 'application/x-research-info-systems');

            const toastMsg = window.Lexicon.I18n
                ? window.Lexicon.I18n.t('inspector.downloadedRis')
                : 'RIS file (.ris) downloaded for Zotero/Mendeley!';
            window.Lexicon.UI.Toast.show(toastMsg, 'success');
        },

        /**
         * Batch export of selected articles as a consolidated .bib file
         */
        batchExportBibTeX() {
            const state = window.Lexicon.State;
            const selectedArticles = state.articles.filter(a => state.selectedIds.includes(a.id));
            if (!selectedArticles.length) {
                window.Lexicon.UI.Toast.show('No documents selected', 'info');
                return;
            }

            const header = `% Lexicon Research Library - Consolidated BibTeX Export\n% Exported: ${new Date().toISOString()}\n% Total Entries: ${selectedArticles.length}\n\n`;
            const entries = selectedArticles.map(a => this.toBibTeX(a)).join('\n\n');
            const fullContent = header + entries + '\n';

            const filename = `Lexicon_Export_${new Date().toISOString().split('T')[0]}.bib`;
            this.downloadFile(fullContent, filename, 'application/x-bibtex');

            const toastMsg = window.Lexicon.I18n
                ? window.Lexicon.I18n.t('batch.exportedBibtex', { count: selectedArticles.length })
                : `Exported ${selectedArticles.length} citations as BibTeX (.bib)`;
            window.Lexicon.UI.Toast.show(toastMsg, 'success');
        },

        /**
         * Batch export of selected articles as a consolidated .ris file
         */
        batchExportRIS() {
            const state = window.Lexicon.State;
            const selectedArticles = state.articles.filter(a => state.selectedIds.includes(a.id));
            if (!selectedArticles.length) {
                window.Lexicon.UI.Toast.show('No documents selected', 'info');
                return;
            }

            const entries = selectedArticles.map(a => this.toRIS(a)).join('\r\n');
            const filename = `Lexicon_Export_${new Date().toISOString().split('T')[0]}.ris`;
            this.downloadFile(entries, filename, 'application/x-research-info-systems');

            const toastMsg = window.Lexicon.I18n
                ? window.Lexicon.I18n.t('batch.exportedRis', { count: selectedArticles.length })
                : `Exported ${selectedArticles.length} references as RIS (.ris)`;
            window.Lexicon.UI.Toast.show(toastMsg, 'success');
        },

        /**
         * Exports a consolidated, structured Markdown note (.md) ready for Obsidian, Notion, Logseq
         * Includes full YAML frontmatter, formatted citations, abstract, notes and backlinks
         * @param {Object} [articleParam]
         */
        exportConsolidatedMarkdown(articleParam) {
            const state = window.Lexicon.State;
            const article = articleParam || state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article) {
                window.Lexicon.UI.Toast.show('Nenhum documento selecionado para exportação', 'error');
                return;
            }

            const abnt = this.formatABNT(article);
            const apa = this.formatAPA(article);
            const chicago = this.formatChicago(article);
            const bibtex = this.toBibTeX(article);

            // Fetch backlinks if Zettelkasten is available
            let backlinksSection = '';
            if (window.Lexicon.Zettelkasten) {
                const backlinks = window.Lexicon.Zettelkasten.getBacklinks(article);
                if (backlinks.length > 0) {
                    backlinksSection = backlinks.map(b => `- [[${b.sourceArticle.title}]] (${b.sourceArticle.year || 'N/A'}): "${b.snippet}"`).join('\n');
                } else {
                    backlinksSection = '_Nenhuma nota externa cita este documento até o momento._';
                }
            }

            const yamlTags = (article.tags || []).map(t => `"${t}"`).join(', ');

            const mdContent = [
                '---',
                `title: "${(article.title || 'Sem título').replace(/"/g, '\\"')}"`,
                `authors: "${(article.authors || '').replace(/"/g, '\\"')}"`,
                `year: ${article.year || 'null'}`,
                `publication: "${(article.publication || '').replace(/"/g, '\\"')}"`,
                `doi: "${article.doi || ''}"`,
                `collection: "${(article.collection || '').replace(/"/g, '\\"')}"`,
                `tags: [${yamlTags}]`,
                `status: "${article.status || 'inbox'}"`,
                `date_added: "${article.addedDate || ''}"`,
                'exported_from: "Lexicon Research Manager"',
                '---',
                '',
                `# ${article.title || 'Fichamento de Pesquisa'}`,
                '',
                '## 📚 Referências Bibliográficas Formatadas',
                '',
                `- **ABNT NBR 6023:** ${abnt}`,
                `- **APA 7ª edição:** ${apa}`,
                `- **Chicago 17ª ed.:** ${chicago}`,
                '',
                '### BibTeX',
                '```bibtex',
                bibtex,
                '```',
                '',
                '---',
                '',
                '## 📄 Resumo Executivo / Abstract',
                '',
                article.summary || '_Nenhum resumo registrado._',
                '',
                '---',
                '',
                '## 📝 Fichamento & Anotações de Leitura',
                '',
                article.notes || '_Nenhum fichamento registrado._',
                '',
                '---',
                '',
                '## 🔗 Citações Reversas & Backlinks (Zettelkasten)',
                '',
                backlinksSection,
                ''
            ].join('\n');

            const safeName = (article.title || 'artigo')
                .toLowerCase()
                .replace(/[^a-z0-9]+/gi, '_')
                .substring(0, 40)
                .replace(/^_+|_+$/g, '');

            const fileName = `fichamento_${safeName || article.id}.md`;
            this.downloadFile(mdContent, fileName, 'text/markdown;charset=utf-8');

            const toastMsg = window.Lexicon.I18n
                ? (window.Lexicon.I18n.t('inspector.exportedNotesSuccess') || `Fichamento estruturado exportado (.md)!`)
                : `Fichamento estruturado exportado (.md)!`;
            window.Lexicon.UI.Toast.show(toastMsg, 'success');
        },

        /**
         * Toggles the Cite dropdown in Document Inspector
         * @param {Event} event 
         */
        toggleCiteMenu(event) {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
            const dropdown = document.getElementById('inspector-cite-dropdown');
            if (!dropdown) return;
            dropdown.classList.toggle('hidden');
        },

        /**
         * Closes the Cite dropdown menu
         */
        closeCiteMenu() {
            const dropdown = document.getElementById('inspector-cite-dropdown');
            if (dropdown) dropdown.classList.add('hidden');
        },

        /**
         * Initializes listeners for document clicks to close dropdowns
         */
        init() {
            document.addEventListener('click', (e) => {
                const container = document.getElementById('inspector-cite-menu-container');
                if (container && !container.contains(e.target)) {
                    this.closeCiteMenu();
                }
            });

            // Allow pressing Enter in DOI inputs to trigger metadata fetch
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    if (e.target && e.target.id === 'inspector-doi') {
                        e.preventDefault();
                        this.fetchInspectorMetadata();
                    } else if (e.target && e.target.id === 'form-doi') {
                        e.preventDefault();
                        this.fetchUploadFormMetadata();
                    }
                }
            });
        }
    };

    window.Lexicon.Academic = Academic;
    window.Lexicon.Citation = Academic; // Alias for backward/spec compatibility
})();
