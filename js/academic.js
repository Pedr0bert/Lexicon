/* ==========================================================================
   Lexicon - Academic Automation & Citation Subsystem (Fase 2)
   DOI / arXiv Lookup (CrossRef & OpenAlex), BibTeX, ABNT, APA, Chicago, RIS
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    'use strict';

    /* ----------------------------------------------------------------------
       Module-level helpers
       ---------------------------------------------------------------------- */

    /**
     * i18n lookup with a safe local fallback (I18n.t returns the key itself when missing)
     */
    const tr = (key, fallback, params) => {
        const I = window.Lexicon.I18n;
        if (I && typeof I.t === 'function') {
            const v = I.t(key, params);
            if (typeof v === 'string' && v !== key) return v;
        }
        return String(fallback).replace(/\{(\w+)\}/g, (_, k) => params && params[k] !== undefined ? params[k] : `{${k}}`);
    };

    const toast = (msg, type) => {
        const UI = window.Lexicon.UI;
        if (UI && UI.Toast && typeof UI.Toast.show === 'function') UI.Toast.show(msg, type);
    };

    const pad2 = (n) => String(n).padStart(2, '0');

    /** Local calendar date as YYYY-MM-DD (never UTC-shifted) */
    const localDateStr = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

    /** Removes combining diacritics (NFD) */
    const stripDiacritics = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    /** Collapses CR/LF and repeated whitespace into single spaces */
    const oneLine = (s) => String(s === null || s === undefined ? '' : s).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

    /** Appends a period unless the text already ends with terminal punctuation */
    const endPunct = (s) => {
        const str = String(s || '').trim();
        if (!str) return '';
        return /[.?!]$/.test(str) ? str : str + '.';
    };

    /** Cleans a title for citation use (trims and removes trailing periods) */
    const cleanTitle = (s) => oneLine(s).replace(/\.+$/, '');

    // --- HTML entity decoding (single pass, no double-decoding) ---
    const NAMED_ENTITIES = {
        amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
        ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’',
        ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', copy: '©', reg: '®',
        trade: '™', deg: '°', plusmn: '±', times: '×', divide: '÷', middot: '·',
        bull: '•', prime: '′', Prime: '″', minus: '−', le: '≤', ge: '≥', ne: '≠',
        alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', mu: 'μ', pi: 'π', sigma: 'σ',
        shy: '', zwj: '', zwnj: '', szlig: 'ß', aelig: 'æ', AElig: 'Æ', oslash: 'ø', Oslash: 'Ø', ordf: 'ª', ordm: 'º'
    };
    // Accented Latin letters: &aacute; &atilde; &ccedil; &ouml; ... (composed via NFC)
    (function addAccentEntities() {
        const marks = { acute: '\u0301', grave: '\u0300', circ: '\u0302', tilde: '\u0303', uml: '\u0308', ring: '\u030A', cedil: '\u0327' };
        'aeiouycnAEIOUYCN'.split('').forEach(letter => {
            Object.keys(marks).forEach(name => {
                const composed = (letter + marks[name]).normalize('NFC');
                if (composed.length === 1) NAMED_ENTITIES[letter + name] = composed;
            });
        });
    })();

    function decodeNamedEntityFallback(entity) {
        try {
            if (typeof DOMParser !== 'undefined') {
                // Only the isolated entity is parsed (no markup), so this is inert.
                const doc = new DOMParser().parseFromString(`<!doctype html><body>${entity}`, 'text/html');
                const out = doc && doc.body ? doc.body.textContent : null;
                if (out && out !== entity) return out;
            }
        } catch (e) { /* ignore */ }
        return entity;
    }

    function decodeEntities(str) {
        return String(str).replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body) => {
            if (body[0] === '#') {
                const code = (body[1] === 'x' || body[1] === 'X') ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
                if (!isNaN(code) && code > 0 && code <= 0x10FFFF) {
                    try { return String.fromCodePoint(code); } catch (e) { return m; }
                }
                return m;
            }
            if (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body)) return NAMED_ENTITIES[body];
            return decodeNamedEntityFallback(m);
        });
    }

    // --- DOI helpers ---

    /** Strips doi.org / dx.doi.org URL prefixes and a "doi:" label */
    function normalizeDoi(doi) {
        if (!doi) return '';
        return String(doi).trim()
            .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
            .replace(/^(?:dx\.)?doi\.org\//i, '')
            .replace(/^doi:\s*/i, '')
            .trim();
    }

    /** Removes trailing punctuation picked up from prose; ')' only when unbalanced */
    function stripTrailingDoiPunct(doi) {
        let s = String(doi || '');
        let changed = true;
        while (changed && s) {
            changed = false;
            if (/[.,;:]$/.test(s)) {
                s = s.slice(0, -1);
                changed = true;
            } else if (s.endsWith(')')) {
                const opens = (s.match(/\(/g) || []).length;
                const closes = (s.match(/\)/g) || []).length;
                if (closes > opens) {
                    s = s.slice(0, -1);
                    changed = true;
                }
            }
        }
        return s;
    }

    function isArxivDoi(doi) {
        return /^(?:arxiv:|10\.48550\/arxiv\.)/i.test(normalizeDoi(doi));
    }

    function arxivIdFromDoi(doi) {
        return normalizeDoi(doi).replace(/^arxiv:\s*/i, '').replace(/^10\.48550\/arxiv\./i, '');
    }

    /** Is the stored "doi" value really a DOI (and not some other URL)? */
    function isRealDoi(doi) {
        return /^10\.\d{4,9}\/\S+$/i.test(normalizeDoi(doi));
    }

    /** Builds a resolvable URL from a DOI (arXiv DOIs resolve to arxiv.org) */
    function doiToUrl(doi) {
        if (!doi) return '';
        const raw = String(doi).trim();
        if (isArxivDoi(raw)) return `https://arxiv.org/abs/${arxivIdFromDoi(raw)}`;
        const clean = normalizeDoi(raw);
        if (/^https?:\/\//i.test(clean)) return clean; // some other URL stored in the DOI field
        return 'https://doi.org/' + encodeURI(clean).replace(/#/g, '%23').replace(/\?/g, '%3F');
    }

    // --- BibTeX / YAML escaping ---

    const TEX_MAP = {
        '\\': '\\textbackslash{}', '&': '\\&', '%': '\\%', '$': '\\$', '#': '\\#', '_': '\\_',
        '{': '\\{', '}': '\\}', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}'
    };
    const texEscape = (s) => oneLine(s).replace(/[\\&%$#_{}~^]/g, ch => TEX_MAP[ch]);
    /** URL/DOI-safe escaping for BibTeX (only characters that break \url / comments) */
    const texUrlEscape = (s) => String(s || '').replace(/[\s{}\\]/g, '').replace(/([%#])/g, '\\$1');

    /** Double-quoted YAML scalar */
    const yamlStr = (v) => '"' + String(v === null || v === undefined ? '' : v)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/[\r\n]+/g, ' ') + '"';

    // --- Author parsing vocabulary ---

    const PARTICLES = new Set(['da', 'de', 'do', 'dos', 'das', 'van', 'von', 'der', 'den', 'del', 'della', 'delle', 'di', 'du', 'le', 'la', 'bin', 'ibn', 'ten', 'ter', 'zu', "d'"]);
    const NAME_SUFFIXES = new Set(['filho', 'neto', 'sobrinho', 'júnior', 'junior', 'jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv']);
    // Organization keywords (Unicode-aware boundaries so "Organização" etc. match)
    const ORG_WORD_RE = /(?:^|[^\p{L}])(?:Universit(?:y|é|à|ät)|Universidade|Universidad|Organi[sz]ation|Organização|Organización|Institute|Instituto|Institut|Association|Associação|Asociación|Group|Grupo|Consortium|Consórcio|Committee|Comitê|Comité|Council|Conselho|Agency|Agência|Ministry|Ministério|Ministerio|Society|Sociedade|Sociedad|Foundation|Fundação|Fundación|Center|Centre|Centro|Department|Departamento|Bank|Banco|Program|Programme|Programa|Collaboration|Alliance|Commission|Comissão|Corporation|Inc\.?|Ltd\.?)(?=$|[^\p{L}])/iu;
    // Well-known acronyms are matched case-sensitively
    const ORG_ACRONYM_RE = /(?:^|[^\p{L}])(?:WHO|IPCC|UNESCO|UNICEF|OECD|IBGE|OMS|ONU|UN|NASA|FAO|IMF|IEEE|ACM)(?=$|[^\p{L}])/u;
    const PLACEHOLDER_RE = /^(?:unknown(?:\s+author)?|desconhecido|autor\s+desconhecido|n\/a|s\/a)$/i;

    const isParticle = (w) => PARTICLES.has(String(w).toLowerCase());
    const isOrgName = (s) => {
        const str = String(s || '').trim();
        if (!str) return false;
        if (ORG_WORD_RE.test(str) || ORG_ACRONYM_RE.test(str)) return true;
        // Whole name is a single all-caps acronym such as "CAPES" or "CNPQ"
        return /^\p{Lu}[\p{Lu}0-9&\-]{1,}$/u.test(str);
    };

    /** "J.", "A. B.", "J.-P.", "AB", "J" */
    const isInitials = (s) => {
        const str = String(s || '').trim();
        if (!str) return false;
        if (/^(?:\p{Lu}\.?\s*(?:-\s*)?)+$/u.test(str)) {
            const letters = str.replace(/[^\p{L}]/gu, '');
            const max = str.includes('.') ? 4 : 3;
            return letters.length >= 1 && letters.length <= max;
        }
        return false;
    };

    /** Single surname, optionally with particles/suffix: "Smith", "da Silva", "van der Berg", "Silva Filho" */
    const isSurnameLike = (s) => {
        const tokens = String(s || '').trim().split(/\s+/).filter(Boolean);
        if (!tokens.length || isInitials(s)) return false;
        const core = tokens.filter(w => !isParticle(w) && !NAME_SUFFIXES.has(w.toLowerCase()));
        return core.length === 1;
    };

    /** Splits a comma-containing chunk into raw author strings */
    function splitCommaChunk(chunk) {
        const parts = chunk.split(/\s*,\s*/).map(p => p.trim()).filter(Boolean);
        if (parts.length <= 1) return parts;

        if (parts.length === 2) {
            const [a, b] = parts;
            if (isInitials(b)) {
                return [`${a}, ${b}`];
            }
            const bWords = b.split(/\s+/).filter(Boolean);
            const hasOrgKeyword = (s) => ORG_WORD_RE.test(s) || ORG_ACRONYM_RE.test(s);
            if (isSurnameLike(a) && bWords.length <= 3 && !hasOrgKeyword(a) && !hasOrgKeyword(b)) {
                // "Smith, John" / "Silva, João Pedro" / "Sartre, Jean-Paul"
                return [`${a}, ${b}`];
            }
            return parts; // "John Smith, Jane Doe"
        }

        // 3+ parts: pair "Family, Initials" greedily; everything else is a standalone name
        const out = [];
        for (let i = 0; i < parts.length; i++) {
            const cur = parts[i];
            const next = parts[i + 1];
            if (next !== undefined && isSurnameLike(cur) && isInitials(next)) {
                out.push(`${cur}, ${next}`);
                i++;
            } else {
                out.push(cur);
            }
        }
        return out;
    }

    /** Builds initials from a given-name string: "Jean-Paul" -> "J.-P.", "A.B." -> "A. B." */
    function buildInitials(given) {
        const prepared = String(given || '')
            .replace(/\.(?=\p{L})/gu, '. ')
            .trim();
        let words = prepared.split(/\s+/).filter(Boolean).filter(w => !isParticle(w));
        // Compact all-caps initials such as "AB"
        if (words.length === 1 && /^\p{Lu}{2,3}$/u.test(words[0])) words = words[0].split('');
        const dotted = [];
        const compact = [];
        words.forEach(w => {
            const pieces = w.split('-').map(p => p.replace(/[.']/g, '')).filter(Boolean);
            if (!pieces.length) return;
            dotted.push(pieces.map(p => p.charAt(0).toUpperCase() + '.').join('-'));
            compact.push(pieces.map(p => p.charAt(0).toUpperCase()).join(''));
        });
        return { initials: dotted.join(' '), initialsCompact: compact.join('') };
    }

    /** Parses a single raw author string into a structured name */
    function parseSingleAuthor(raw) {
        const item = String(raw || '').trim().replace(/^[,;]+|[,;]+$/g, '').trim();
        if (!item || PLACEHOLDER_RE.test(item) || /^et\.?\s*al\.?$/i.test(item)) return null;

        if (!item.includes(',') && isOrgName(item)) {
            return { raw: item, family: item, familyCore: item, particle: '', given: '', initials: '', initialsCompact: '', isOrg: true };
        }

        let family = '';
        let given = '';

        if (item.includes(',')) {
            const idx = item.indexOf(',');
            family = item.slice(0, idx).trim();
            given = item.slice(idx + 1).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
        } else {
            let tokens = item.split(/\s+/).filter(Boolean);
            if (tokens.length === 1) {
                family = tokens[0];
            } else if (/^\p{Lu}{1,3}$/u.test(tokens[tokens.length - 1]) && !/^\p{Lu}+$/u.test(tokens[0])) {
                // Vancouver style without comma: "Smith AB"
                family = tokens.slice(0, -1).join(' ');
                given = tokens[tokens.length - 1].split('').join('. ') + '.';
            } else {
                let start = tokens.length - 1;
                // Keep suffixes (Filho, Neto, Jr.) attached to the family name
                if (start > 1 && NAME_SUFFIXES.has(tokens[start].toLowerCase())) start--;
                // Walk back over particles (da, van der, ...), keeping at least one given token
                while (start - 1 > 0 && isParticle(tokens[start - 1])) start--;
                family = tokens.slice(start).join(' ');
                given = tokens.slice(0, start).join(' ');
            }
        }

        // Separate leading particles in the family name ("da Silva" -> particle "da", core "Silva")
        const famTokens = family.split(/\s+/).filter(Boolean);
        let p = 0;
        while (p < famTokens.length - 1 && isParticle(famTokens[p])) p++;
        let particle = famTokens.slice(0, p).join(' ');
        const familyCore = famTokens.slice(p).join(' ');

        // Trailing particles written in the given part ("Silva, João da")
        if (!particle && given) {
            const gTokens = given.split(/\s+/);
            let q = gTokens.length;
            while (q > 1 && isParticle(gTokens[q - 1])) q--;
            if (q < gTokens.length) {
                particle = gTokens.slice(q).join(' ');
                given = gTokens.slice(0, q).join(' ');
                family = `${particle} ${familyCore}`;
            }
        }

        const { initials, initialsCompact } = buildInitials(given);

        return {
            raw: item,
            family,
            familyCore: familyCore || family,
            particle,
            given,
            initials,
            initialsCompact,
            isOrg: false
        };
    }

    const MONTHS_ABNT = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
    const abntAccessDate = (d = new Date()) => `${d.getDate()} ${MONTHS_ABNT[d.getMonth()]} ${d.getFullYear()}`;

    /** ABNT entry by title when there is no author: first word (plus a leading article) uppercased */
    function abntTitleHead(title) {
        const words = String(title || '').trim().split(/\s+/).filter(Boolean);
        if (!words.length) return '';
        const articles = new Set(['a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'the', 'an', 'el', 'la', 'los', 'las', 'le', 'les', 'il', 'lo']);
        let n = 1;
        if (words.length > 1 && articles.has(stripDiacritics(words[0]).toLowerCase())) n = 2;
        return [...words.slice(0, n).map(w => w.toLocaleUpperCase('pt-BR')), ...words.slice(n)].join(' ');
    }

    // In-flight guards and pending (hidden) upload-form metadata
    let inspectorFetchInFlight = false;
    let formFetchInFlight = false;
    let pendingUploadMeta = null;
    let initialized = false;

    const Academic = {
        // Exposed helpers (useful for other modules and tests)
        normalizeDoi,
        doiToUrl,
        texEscape,
        yamlStr,
        endPunct,

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

            const ARXIV_ID = '([a-zA-Z\\-]+(?:\\.[a-zA-Z\\-]+)?\\/\\d{7}(?:v\\d+)?|\\d{4}\\.\\d{4,5}(?:v\\d+)?)';

            // 1. arXiv URL (e.g. https://arxiv.org/abs/2301.12345 or /pdf/2301.12345.pdf)
            const arxivUrlMatch = input.match(new RegExp(`arxiv\\.org\\/(?:abs|pdf)\\/${ARXIV_ID}(?:\\.pdf)?`, 'i'));
            if (arxivUrlMatch) {
                return { type: 'arxiv', id: arxivUrlMatch[1], raw: input };
            }

            // 2. arXiv DOI (e.g. 10.48550/arXiv.2301.12345)
            const arxivDoiMatch = input.match(new RegExp(`(?:(?:https?:\\/\\/)?(?:dx\\.)?doi\\.org\\/)?10\\.48550\\/arxiv\\.${ARXIV_ID}`, 'i'));
            if (arxivDoiMatch) {
                const baseId = arxivDoiMatch[1].replace(/v\d+$/i, '');
                return { type: 'arxiv', id: arxivDoiMatch[1], doi: `10.48550/arXiv.${baseId}`, raw: input };
            }

            // 3. arXiv prefix ("arXiv:2301.12345" or "arxiv: math/0405076")
            const arxivPrefixMatch = input.match(new RegExp(`^arxiv:\\s*${ARXIV_ID}`, 'i'));
            if (arxivPrefixMatch) {
                return { type: 'arxiv', id: arxivPrefixMatch[1], raw: input };
            }

            // 4/5. Pure arXiv IDs (new and old style)
            const arxivPureMatch = input.match(new RegExp(`^${ARXIV_ID}$`, 'i'));
            if (arxivPureMatch) {
                return { type: 'arxiv', id: arxivPureMatch[1], raw: input };
            }

            // 6. DOI URL (doi.org or dx.doi.org) — no whitespace allowed in the DOI
            const doiUrlMatch = input.match(/(?:https?:\/\/)?(?:dx\.)?doi\.org\/(10\.\d{4,9}\/\S+)/i);
            if (doiUrlMatch) {
                let doi = doiUrlMatch[1];
                try { doi = decodeURIComponent(doi); } catch (e) { /* keep raw */ }
                if (!/\s/.test(doi)) {
                    return { type: 'doi', doi: stripTrailingDoiPunct(doi), raw: input };
                }
            }

            // 7. Bare DOI, optionally prefixed with "doi:"
            const bare = input.replace(/^doi:\s*/i, '');
            const doiMatch = bare.match(/^(10\.\d{4,9}\/\S+)$/i);
            if (doiMatch) {
                return { type: 'doi', doi: stripTrailingDoiPunct(doiMatch[1]), raw: input };
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
         * Removes HTML/XML tags, decodes HTML entities and normalizes spaces
         * @param {string} str 
         * @returns {string}
         */
        cleanText(str) {
            if (!str) return '';
            const noTags = String(str).replace(/<[^>]+>/g, ' ');
            return decodeEntities(noTags)
                .replace(/\u00a0/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        },

        /**
         * Cleans an abstract (JATS/HTML) and strips a leading "Abstract"/"Resumo" heading
         * @param {string} str
         * @returns {string}
         */
        cleanAbstract(str) {
            if (!str) return '';
            const withoutHeading = String(str).replace(
                /^\s*<(?:jats:)?title[^>]*>\s*(?:abstract|resumo|summary|resumen|résumé)\s*[:.]?\s*<\/(?:jats:)?title>/i, ' ');
            return this.cleanText(withoutHeading)
                .replace(/^(?:abstract|resumo|summary|resumen|résumé)\s*[:.\-–—]?\s+(?=\S)/i, '')
                .trim();
        },

        /**
         * Fetches metadata from CrossRef API
         * @param {string} doi 
         * @returns {Promise<Object|null>}
         */
        async fetchFromCrossRef(doi) {
            const cleanDoi = normalizeDoi(doi);
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

                // Authors ("Given Family", comma-separated; organizations by name)
                let authors = '';
                if (Array.isArray(msg.author) && msg.author.length > 0) {
                    authors = msg.author.map(a => {
                        if (a.name) return this.cleanText(a.name);
                        const parts = [];
                        if (a.given) parts.push(this.cleanText(a.given));
                        if (a.family) parts.push(this.cleanText(a.family));
                        return parts.join(' ');
                    }).filter(Boolean).join(', ');
                }

                // Year: issued > published-print > published-online > created
                let year = null;
                const candidates = [msg.issued, msg['published-print'], msg['published-online'], msg.created];
                for (const c of candidates) {
                    const dp = c && c['date-parts'];
                    if (dp && dp[0] && dp[0][0]) {
                        year = parseInt(dp[0][0], 10);
                        if (!isNaN(year)) break;
                        year = null;
                    }
                }

                // Journal / Publication
                const publication = this.cleanText((Array.isArray(msg['container-title']) && msg['container-title'].length)
                    ? msg['container-title'][0]
                    : (msg.publisher || ''));

                // Volume, Issue, Pages
                const volume = msg.volume ? String(msg.volume) : '';
                const issue = msg.issue ? String(msg.issue) : '';
                const pages = msg.page ? String(msg.page) : '';

                // Abstract
                const abstract = msg.abstract ? this.cleanAbstract(msg.abstract) : '';

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
                    doi: normalizeDoi(msg.DOI || cleanDoi),
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
            const id = normalizeDoi(doiOrArxivId);
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
                    .map(n => this.cleanText(n))
                    .join(', ');
                const year = data.publication_year || null;
                const publication = this.cleanText(data.primary_location?.source?.display_name ||
                                    data.host_venue?.display_name ||
                                    (data.type === 'preprint' ? 'arXiv' : ''));
                
                const volume = data.biblio?.volume ? String(data.biblio.volume) : '';
                const issue = data.biblio?.issue ? String(data.biblio.issue) : '';
                let pages = '';
                if (data.biblio?.first_page && data.biblio?.last_page && data.biblio.first_page !== data.biblio.last_page) {
                    pages = `${data.biblio.first_page}-${data.biblio.last_page}`;
                } else if (data.biblio?.first_page) {
                    pages = String(data.biblio.first_page);
                }

                let doi = id;
                if (data.doi) {
                    doi = normalizeDoi(data.doi);
                }

                const abstract = this.cleanAbstract(this.reconstructInvertedAbstract(data.abstract_inverted_index));
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
            const baseId = cleanId.replace(/v\d+$/i, '');
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

                const summary = this.cleanAbstract(entry.querySelector('summary')?.textContent || '');
                // DataCite DOIs for arXiv never carry the version suffix
                const arxivDoi = `10.48550/arXiv.${baseId}`;

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
                const baseId = arxivId.replace(/v\d+$/i, '');
                const arxivDoi = parsed.doi || `10.48550/arXiv.${baseId}`;

                // 1. Try OpenAlex by arXiv DOI
                let meta = await this.fetchFromOpenAlex(arxivDoi);
                if (meta) return meta;

                // 2. Try official arXiv Export API (version kept for the exact record)
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

        /** Sets the busy/idle visual state of a fetch button */
        _setFetchButtonState(prefix, busy) {
            const btn = document.getElementById(`btn-${prefix}-fetch-doi`);
            const icon = document.getElementById(`icon-${prefix}-fetch-doi`);
            const text = document.getElementById(`text-${prefix}-fetch-doi`);
            if (btn) btn.disabled = !!busy;
            if (icon) icon.className = busy
                ? 'ph ph-spinner animate-spin text-base text-jungle'
                : 'ph ph-cloud-arrow-down text-base text-jungle';
            if (text) {
                text.textContent = busy
                    ? tr('inspector.fetchingMetadata', 'Buscando...')
                    : tr('inspector.fetchMetadata', 'Buscar Metadados');
            }
        },

        /**
         * UI Action: Fetches metadata for current input in Inspector Modal
         */
        async fetchInspectorMetadata() {
            if (inspectorFetchInFlight) return;
            const doiInput = document.getElementById('inspector-doi');
            if (!doiInput) return;
            const rawVal = doiInput.value.trim();

            if (!rawVal) {
                toast(tr('inspector.promptEnterDoi', 'Informe primeiro um DOI ou ID arXiv'), 'info');
                doiInput.focus();
                return;
            }

            const state = window.Lexicon.State;
            // Capture the target BEFORE awaiting: the user may switch documents meanwhile
            const targetId = state ? state.inspectedArticleId : null;

            inspectorFetchInFlight = true;
            this._setFetchButtonState('inspector', true);

            try {
                const meta = await this.fetchMetadata(rawVal);

                const modal = document.getElementById('inspector-modal');
                const stale = !state || state.inspectedArticleId !== targetId ||
                    !modal || modal.classList.contains('hidden');
                if (stale) {
                    toast(tr('inspector.metadataStale', 'Metadados ignorados: o documento inspecionado mudou.'), 'info');
                    return;
                }

                if (!meta) {
                    toast(tr('inspector.metadataNotFound', 'Não foi possível encontrar metadados para este identificador.'), 'error');
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
                if (meta.doi) doiInput.value = meta.doi;

                // Update summary if currently blank or user confirms
                let summaryApplied = false;
                if (summaryEl && meta.summary) {
                    if (!summaryEl.value.trim() || confirm(
                        tr('inspector.confirmOverwriteSummary', 'Atualizar o resumo com os metadados oficiais?')
                    )) {
                        summaryEl.value = meta.summary;
                        summaryApplied = true;
                    }
                }

                // Update external link
                if (doiLinkEl && meta.doi) {
                    doiLinkEl.href = doiToUrl(meta.doi);
                    doiLinkEl.classList.remove('hidden');
                }

                // Store extra biblio metadata in the captured article
                const article = (state.articles || []).find(a => a.id === targetId);
                if (article) {
                    if (meta.title) article.title = meta.title;
                    if (meta.authors) article.authors = meta.authors;
                    if (meta.year) article.year = meta.year;
                    if (meta.publication) article.publication = meta.publication;
                    if (meta.doi) article.doi = meta.doi;
                    // Always replace biblio details so stale values from a previous record don't linger
                    article.volume = meta.volume || '';
                    article.issue = meta.issue || '';
                    article.pages = meta.pages || '';
                    if (summaryApplied) article.summary = meta.summary;

                    try {
                        await window.Lexicon.Storage.save();
                    } catch (saveErr) {
                        console.error('Error saving metadata:', saveErr);
                    }
                    if (window.Lexicon.Articles && typeof window.Lexicon.Articles.render === 'function') {
                        window.Lexicon.Articles.render();
                    }
                }

                toast(tr('inspector.metadataSuccess', 'Metadados importados com sucesso de {source}!', { source: meta.source }), 'success');
            } catch (err) {
                console.error('Error in fetchInspectorMetadata:', err);
                toast(tr('inspector.metadataError', 'Erro ao consultar metadados.'), 'error');
            } finally {
                inspectorFetchInFlight = false;
                this._setFetchButtonState('inspector', false);
            }
        },

        /**
         * UI Action: Fetches metadata for current input in Add Document Modal (Single Tab)
         */
        async fetchUploadFormMetadata() {
            if (formFetchInFlight) return;
            const doiInput = document.getElementById('form-doi');
            if (!doiInput) return;
            const rawVal = doiInput.value.trim();

            if (!rawVal) {
                toast(tr('inspector.promptEnterDoi', 'Informe primeiro um DOI ou ID arXiv'), 'info');
                doiInput.focus();
                return;
            }

            formFetchInFlight = true;
            pendingUploadMeta = null;
            this._setFetchButtonState('form', true);

            try {
                const meta = await this.fetchMetadata(rawVal);
                if (!meta) {
                    toast(tr('inspector.metadataNotFound', 'Não foi possível encontrar metadados para este identificador.'), 'error');
                    return;
                }

                // The user may have changed the identifier while the request was running
                if (doiInput.value.trim() !== rawVal) {
                    toast(tr('inspector.metadataStaleForm', 'Metadados ignorados: o identificador foi alterado durante a busca.'), 'info');
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
                if (meta.doi) doiInput.value = meta.doi;

                // Fields without visible inputs are kept in hidden state for the article creator
                pendingUploadMeta = {
                    doi: normalizeDoi(meta.doi || rawVal),
                    volume: meta.volume || '',
                    issue: meta.issue || '',
                    pages: meta.pages || '',
                    coverType: meta.coverType || 'pdf',
                    source: meta.source || ''
                };

                toast(tr('inspector.metadataSuccess', 'Metadados importados com sucesso de {source}!', { source: meta.source }), 'success');
            } catch (err) {
                console.error('Error in fetchUploadFormMetadata:', err);
                toast(tr('inspector.metadataError', 'Erro ao consultar metadados.'), 'error');
            } finally {
                formFetchInFlight = false;
                this._setFetchButtonState('form', false);
            }
        },

        /**
         * Returns and clears metadata fetched in the upload form that has no visible input
         * (volume, issue, pages, coverType). Consumers should compare `.doi` with the
         * DOI being saved (normalizeDoi) before applying it.
         * @returns {{doi:string, volume:string, issue:string, pages:string, coverType:string, source:string}|null}
         */
        consumePendingUploadMeta() {
            const meta = pendingUploadMeta;
            pendingUploadMeta = null;
            return meta;
        },

        /** Discards pending upload-form metadata (e.g. when the form is reset/closed) */
        clearPendingUploadMeta() {
            pendingUploadMeta = null;
        },

        /**
         * Tokenizes and parses author strings into structured author items
         * @param {string} authorStr 
         * @returns {Array<{ raw: string, family: string, familyCore: string, particle: string, given: string, initials: string, initialsCompact: string, isOrg: boolean }>}
         */
        parseAuthors(authorStr) {
            if (!authorStr || typeof authorStr !== 'string') return [];
            let cleaned = authorStr.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
            if (!cleaned || PLACEHOLDER_RE.test(cleaned)) return [];

            // Ignore "et al."
            cleaned = cleaned.replace(/[,;]?\s*\bet\.?\s+al\b\.?/gi, '').replace(/[,;\s]+$/, '').trim();
            if (!cleaned) return [];

            const rawList = [];
            cleaned.split(/\s*;\s*/).filter(Boolean).forEach(segment => {
                // Organization names may legitimately contain "and"/"&"
                if (!segment.includes(',') && isOrgName(segment)) {
                    rawList.push(segment);
                    return;
                }
                segment.split(/\s*,?\s+(?:and|&)\s+|\s*&\s*/i)
                    .map(s => s.trim())
                    .filter(Boolean)
                    .forEach(chunk => {
                        if (chunk.includes(',')) {
                            splitCommaChunk(chunk).forEach(r => rawList.push(r));
                        } else {
                            rawList.push(chunk);
                        }
                    });
            });

            return rawList.map(parseSingleAuthor).filter(Boolean);
        },

        /**
         * Formats reference according to Brazilian ABNT NBR 6023:2018 standard
         * @param {Object} article 
         * @returns {string}
         */
        formatABNT(article) {
            if (!article) return '';
            const authors = this.parseAuthors(article.authors);

            const abntName = (a) => {
                if (a.isOrg) return a.family.toLocaleUpperCase('pt-BR');
                const core = (a.familyCore || a.family || a.raw).toLocaleUpperCase('pt-BR');
                const given = [a.given, a.particle].filter(Boolean).join(' ');
                return given ? `${core}, ${given}` : core;
            };

            const title = cleanTitle(article.title) || tr('academic.untitled', 'Sem título');
            const isBook = article.coverType === 'book';
            const pub = oneLine(article.publication);
            const year = article.year ? String(article.year).trim() : '[s.d.]';
            const doi = article.doi ? String(article.doi).trim() : '';

            let lead;
            if (authors.length === 0) {
                // Entry by title: first word uppercased, rest of the title as-is (no repetition)
                lead = endPunct(abntTitleHead(title));
            } else {
                let authorText;
                if (authors.length <= 3) {
                    authorText = authors.map(abntName).join('; ');
                } else {
                    authorText = `${abntName(authors[0])} et al.`;
                }
                lead = `${endPunct(authorText)} ${endPunct(title)}`;
            }

            let citation = '';
            if (isBook) {
                citation = `${lead} ${pub ? pub + ', ' : ''}${year}.`;
            } else {
                const details = [];
                if (article.volume) details.push(`v. ${article.volume}`);
                if (article.issue) details.push(`n. ${article.issue}`);
                if (article.pages) details.push(`p. ${article.pages}`);
                details.push(year);

                if (pub) {
                    citation = `${lead} ${pub}, ${details.join(', ')}.`;
                } else {
                    citation = `${lead} ${year}.`;
                }
            }

            if (doi) {
                if (isArxivDoi(doi) || !isRealDoi(doi)) {
                    citation += ` Disponível em: ${doiToUrl(doi)}. Acesso em: ${abntAccessDate()}.`;
                } else {
                    citation += ` DOI: ${normalizeDoi(doi)}.`;
                }
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
            const apaName = (a) => (a.isOrg || !a.initials) ? a.family : `${a.family}, ${a.initials}`;

            let authorText = '';
            if (authors.length === 1) {
                authorText = apaName(authors[0]);
            } else if (authors.length === 2) {
                authorText = `${apaName(authors[0])}, & ${apaName(authors[1])}`;
            } else if (authors.length > 2 && authors.length <= 20) {
                const list = authors.map(apaName);
                const last = list.pop();
                authorText = `${list.join(', ')}, & ${last}`;
            } else if (authors.length > 20) {
                // Over 20 authors: first 19, ..., last
                const list = authors.slice(0, 19).map(apaName);
                authorText = `${list.join(', ')}, ... ${apaName(authors[authors.length - 1])}`;
            }

            const year = article.year ? `(${article.year})` : '(n.d.)';
            const title = cleanTitle(article.title) || 'Untitled';
            const pub = oneLine(article.publication);
            const doi = article.doi ? String(article.doi).trim() : '';

            // No author: the title moves into the author position (not repeated)
            let citation = authorText
                ? `${endPunct(authorText)} ${year}. ${endPunct(title)}`
                : `${endPunct(title)} ${year}.`;

            if (pub) {
                let loc = pub;
                if (article.volume) {
                    loc += `, ${article.volume}`;
                    if (article.issue) loc += `(${article.issue})`;
                }
                if (article.pages) {
                    loc += `, ${article.pages}`;
                }
                citation += ` ${endPunct(loc)}`;
            }

            if (doi) {
                citation += ` ${doiToUrl(doi)}`;
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
            const inverted = (a) => (a.isOrg || !a.given) ? a.family : `${a.family}, ${a.given}`;
            const direct = (a) => (a.isOrg || !a.given) ? a.family : `${a.given} ${a.family}`;

            let authorText = '';
            if (authors.length === 1) {
                authorText = inverted(authors[0]);
            } else if (authors.length >= 2 && authors.length <= 10) {
                const list = [inverted(authors[0]), ...authors.slice(1).map(direct)];
                const last = list.pop();
                authorText = `${list.join(', ')}, and ${last}`;
            } else if (authors.length > 10) {
                const list = [inverted(authors[0]), ...authors.slice(1, 7).map(direct)];
                authorText = `${list.join(', ')}, et al.`;
            }

            const year = article.year || 'n.d.';
            const title = cleanTitle(article.title) || 'Untitled';
            const isBook = article.coverType === 'book';
            const pub = oneLine(article.publication);
            const doi = article.doi ? String(article.doi).trim() : '';

            const titlePart = isBook ? endPunct(title) : `"${endPunct(title)}"`;

            let citation;
            if (authorText) {
                citation = `${endPunct(authorText)} ${endPunct(year)} ${titlePart}`;
            } else {
                // No author: start with the title, followed by the year
                citation = `${titlePart} ${endPunct(year)}`;
            }

            if (isBook) {
                if (pub) citation += ` ${endPunct(pub)}`;
            } else if (pub) {
                let src = pub;
                if (article.volume) {
                    src += ` ${article.volume}`;
                    if (article.issue) src += `, no. ${article.issue}`;
                }
                if (article.pages) {
                    src += `: ${article.pages}`;
                }
                citation += ` ${endPunct(src)}`;
            }

            if (doi) {
                citation += ` ${doiToUrl(doi)}.`;
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
            const vName = (a) => (a.isOrg || !a.initialsCompact) ? a.family : `${a.family} ${a.initialsCompact}`;

            let authorText = '';
            if (authors.length > 0 && authors.length <= 6) {
                authorText = authors.map(vName).join(', ');
            } else if (authors.length > 6) {
                authorText = `${authors.slice(0, 6).map(vName).join(', ')}, et al.`;
            }

            const title = cleanTitle(article.title) || 'Untitled';
            const pub = oneLine(article.publication);
            const year = article.year || '';
            const doi = article.doi ? String(article.doi).trim() : '';

            let citation = authorText ? `${endPunct(authorText)} ${endPunct(title)}` : endPunct(title);
            if (pub) {
                citation += ` ${endPunct(pub)}`;
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
                citation += isRealDoi(doi) ? ` doi:${normalizeDoi(doi)}` : ` Available from: ${doiToUrl(doi)}`;
            }

            return citation;
        },

        /**
         * Generates clean citation key for BibTeX (ASCII, diacritics stripped)
         * @param {Object} article 
         * @returns {string}
         */
        generateCiteKey(article) {
            const authors = this.parseAuthors(article && article.authors);
            const asciiLower = (s) => stripDiacritics(s).toLowerCase();
            let authorPart = '';
            if (authors.length > 0) {
                const a = authors[0];
                const base = a.isOrg ? a.family.split(/\s+/)[0] : (a.familyCore || a.family);
                authorPart = asciiLower(base).replace(/[^a-z0-9]/g, '');
            }
            if (!authorPart) authorPart = 'doc';
            const yearPart = String((article && article.year) || 'nodate').replace(/[^A-Za-z0-9]/g, '') || 'nodate';
            let titleWord = '';
            if (article && article.title) {
                const words = asciiLower(article.title).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
                const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'of', 'and', 'for', 'to', 'with', 'by', 'at', 'from', 'o', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'para', 'com', 'e', 'por', 'sobre']);
                const significant = words.find(w => w.length > 2 && !stopWords.has(w));
                titleWord = significant || words[0] || '';
            }
            return `${authorPart}${yearPart}${titleWord}`.slice(0, 30);
        },

        /**
         * Generates unique cite keys for a batch (duplicates get a, b, c... suffixes)
         * @param {Array<Object>} articles
         * @returns {Array<string>}
         */
        generateUniqueCiteKeys(articles) {
            const used = new Set();
            return (articles || []).map(a => {
                const base = this.generateCiteKey(a);
                let key = base;
                let n = 0;
                while (used.has(key)) {
                    key = base + this._suffix(n++);
                }
                used.add(key);
                return key;
            });
        },

        /** 0 -> a, 25 -> z, 26 -> aa ... */
        _suffix(n) {
            let s = '';
            n = n + 1;
            while (n > 0) {
                const r = (n - 1) % 26;
                s = String.fromCharCode(97 + r) + s;
                n = Math.floor((n - 1) / 26);
            }
            return s;
        },

        /**
         * Generates standardized BibTeX string (.bib)
         * @param {Object} article 
         * @param {string} [keyOverride] cite key to use (for de-duplicated batch export)
         * @returns {string}
         */
        toBibTeX(article, keyOverride) {
            if (!article) return '';
            const isBook = article.coverType === 'book';
            const pub = oneLine(article.publication);
            const type = isBook ? 'book' : (pub ? 'article' : 'misc');
            const key = keyOverride || this.generateCiteKey(article);

            const authors = this.parseAuthors(article.authors);
            const bibAuthors = authors.map(a => {
                if (a.isOrg) return `{${texEscape(a.family)}}`;
                if (a.family && a.given) return `${texEscape(a.family)}, ${texEscape(a.given)}`;
                return texEscape(a.family || a.raw);
            }).join(' and ');

            const fields = [];
            const add = (name, value) => { if (value) fields.push(`  ${name} = {${value}}`); };

            add('title', texEscape(article.title));
            add('author', bibAuthors);
            if (isBook) add('publisher', texEscape(pub));
            else if (pub) add('journal', texEscape(pub));
            add('year', texEscape(article.year));
            add('volume', texEscape(article.volume));
            add('number', texEscape(article.issue));
            if (article.pages) add('pages', texEscape(String(article.pages).replace(/\s*[-–—]+\s*/g, '--')));
            if (article.doi) {
                const raw = String(article.doi).trim();
                if (isRealDoi(raw)) add('doi', texUrlEscape(normalizeDoi(raw)));
                add('url', texUrlEscape(doiToUrl(raw)));
            }
            if (article.summary) add('abstract', texEscape(article.summary));
            if (Array.isArray(article.tags)) {
                const kw = article.tags.filter(tg => typeof tg === 'string' && tg.trim()).map(tg => texEscape(tg)).join(', ');
                add('keywords', kw);
            }

            const header = `@${type}{${key},`;
            if (!fields.length) return `${header}\n}`;
            return `${header}\n${fields.join(',\n')}\n}`;
        },

        /**
         * Generates standardized RIS file format (.ris) for Zotero, Mendeley, EndNote
         * @param {Object} article 
         * @returns {string}
         */
        toRIS(article) {
            if (!article) return '';
            const isBook = article.coverType === 'book';
            const pub = oneLine(article.publication);
            const type = isBook ? 'BOOK' : (pub ? 'JOUR' : 'GEN');
            const lines = [];
            const add = (tag, value) => {
                const v = oneLine(value);
                if (v) lines.push(`${tag}  - ${v}`);
            };

            lines.push(`TY  - ${type}`);
            add('TI', article.title);

            const authors = this.parseAuthors(article.authors);
            authors.forEach(a => {
                if (!a.isOrg && a.family && a.given) add('AU', `${a.family}, ${a.given}`);
                else add('AU', a.family || a.raw);
            });

            if (isBook) add('PB', pub);
            else add('T2', pub);

            add('PY', article.year);
            add('VL', article.volume);
            add('IS', article.issue);
            if (article.pages) {
                const pagesStr = oneLine(article.pages);
                const m = pagesStr.match(/^([^-–—]+?)\s*[-–—]+\s*(.+)$/);
                const pageToken = /^(?:[A-Za-z]{0,3}\d+[A-Za-z]{0,3}|[ivxlcdm]+)$/i;
                if (m && pageToken.test(m[1].trim()) && pageToken.test(m[2].trim())) {
                    add('SP', m[1]);
                    add('EP', m[2]);
                } else {
                    add('SP', pagesStr);
                }
            }
            if (article.doi) {
                const raw = String(article.doi).trim();
                if (isRealDoi(raw)) add('DO', normalizeDoi(raw));
                add('UR', doiToUrl(raw));
            }
            add('AB', article.summary);
            if (Array.isArray(article.tags)) {
                article.tags.forEach(tag => {
                    if (typeof tag === 'string') add('KW', tag);
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
            const previouslyFocused = document.activeElement;
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '-9999px';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            let successful = false;
            try {
                successful = document.execCommand('copy');
            } catch (err) {
                successful = false;
            } finally {
                if (textarea.parentNode) textarea.parentNode.removeChild(textarea);
                if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
                    try { previouslyFocused.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
                }
            }
            return successful;
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
            // Revoking immediately can cancel the download in some browsers
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        },

        _getInspectedArticle() {
            const state = window.Lexicon.State;
            if (!state || !Array.isArray(state.articles)) return null;
            return state.articles.find(a => a.id === state.inspectedArticleId) || null;
        },

        _getSelectedArticles() {
            const state = window.Lexicon.State;
            if (!state || !Array.isArray(state.articles)) return [];
            const ids = new Set(state.selectedIds || []);
            return state.articles.filter(a => ids.has(a.id));
        },

        /**
         * Copies formatted academic citation for inspected document
         * @param {'abnt'|'apa'|'chicago'|'vancouver'} format 
         */
        async copyCitationForInspected(format) {
            const article = this._getInspectedArticle();
            if (!article) return;

            this.closeCiteMenu();

            let citation = '';
            let formatName = '';

            switch (format) {
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
                case 'abnt':
                default:
                    citation = this.formatABNT(article);
                    formatName = 'ABNT';
            }

            const success = await this.copyToClipboard(citation);
            if (success) {
                toast(tr('inspector.copiedCitation', 'Referência copiada no formato {format}!', { format: formatName }), 'success');
            } else {
                toast(tr('academic.clipboardError', 'Erro ao copiar para a área de transferência'), 'error');
            }
        },

        /**
         * Copies BibTeX entry for inspected document to clipboard
         */
        async copyBibTeXForInspected() {
            const article = this._getInspectedArticle();
            if (!article) return;

            this.closeCiteMenu();
            const bibtex = this.toBibTeX(article);
            const success = await this.copyToClipboard(bibtex);

            if (success) {
                toast(tr('inspector.copiedBibtex', 'Entrada BibTeX copiada!'), 'success');
            } else {
                toast(tr('academic.clipboardError', 'Erro ao copiar para a área de transferência'), 'error');
            }
        },

        /**
         * Downloads individual .bib file for inspected document
         */
        downloadBibTeXForInspected() {
            const article = this._getInspectedArticle();
            if (!article) return;

            this.closeCiteMenu();
            const bibtex = this.toBibTeX(article);
            const key = this.generateCiteKey(article);
            this.downloadFile(bibtex + '\n', `${key}.bib`, 'application/x-bibtex');

            toast(tr('inspector.downloadedBibtex', 'Arquivo BibTeX (.bib) baixado!'), 'success');
        },

        /**
         * Downloads individual .ris file for inspected document
         */
        downloadRISForInspected() {
            const article = this._getInspectedArticle();
            if (!article) return;

            this.closeCiteMenu();
            const ris = this.toRIS(article);
            const key = this.generateCiteKey(article);
            this.downloadFile(ris, `${key}.ris`, 'application/x-research-info-systems');

            toast(tr('inspector.downloadedRis', 'Arquivo RIS (.ris) baixado para Zotero/Mendeley!'), 'success');
        },

        /**
         * Batch export of selected articles as a consolidated .bib file
         */
        batchExportBibTeX() {
            const selectedArticles = this._getSelectedArticles();
            if (!selectedArticles.length) {
                toast(tr('academic.noDocumentsSelected', 'Nenhum documento selecionado'), 'info');
                return;
            }

            const today = localDateStr();
            const keys = this.generateUniqueCiteKeys(selectedArticles);
            const header = `% Lexicon Research Library - Consolidated BibTeX Export\n% Exported: ${today}\n% Total Entries: ${selectedArticles.length}\n\n`;
            const entries = selectedArticles.map((a, i) => this.toBibTeX(a, keys[i])).join('\n\n');
            const fullContent = header + entries + '\n';

            this.downloadFile(fullContent, `Lexicon_Export_${today}.bib`, 'application/x-bibtex');

            toast(tr('batch.exportedBibtex', '{count} referências exportadas em BibTeX (.bib)', { count: selectedArticles.length }), 'success');
        },

        /**
         * Batch export of selected articles as a consolidated .ris file
         */
        batchExportRIS() {
            const selectedArticles = this._getSelectedArticles();
            if (!selectedArticles.length) {
                toast(tr('academic.noDocumentsSelected', 'Nenhum documento selecionado'), 'info');
                return;
            }

            const entries = selectedArticles.map(a => this.toRIS(a)).join('\r\n');
            this.downloadFile(entries, `Lexicon_Export_${localDateStr()}.ris`, 'application/x-research-info-systems');

            toast(tr('batch.exportedRis', '{count} referências exportadas em RIS (.ris)', { count: selectedArticles.length }), 'success');
        },

        /**
         * Exports a consolidated, structured Markdown note (.md) ready for Obsidian, Notion, Logseq
         * Includes full YAML frontmatter, formatted citations, abstract, notes and backlinks
         * @param {Object} [articleParam]
         */
        exportConsolidatedMarkdown(articleParam) {
            const article = articleParam || this._getInspectedArticle();
            if (!article) {
                toast(tr('academic.noDocumentForExport', 'Nenhum documento selecionado para exportação'), 'error');
                return;
            }

            const abnt = this.formatABNT(article);
            const apa = this.formatAPA(article);
            const chicago = this.formatChicago(article);
            const bibtex = this.toBibTeX(article);
            const untitled = tr('academic.untitled', 'Sem título');

            // Fetch backlinks if Zettelkasten is available
            let backlinksSection = '';
            if (window.Lexicon.Zettelkasten && typeof window.Lexicon.Zettelkasten.getBacklinks === 'function') {
                const backlinks = window.Lexicon.Zettelkasten.getBacklinks(article) || [];
                if (backlinks.length > 0) {
                    backlinksSection = backlinks.map(b => {
                        const src = b.sourceArticle || {};
                        return `- [[${oneLine(src.title) || untitled}]] (${src.year || 'N/A'}): "${oneLine(b.snippet)}"`;
                    }).join('\n');
                } else {
                    backlinksSection = tr('academic.mdNoBacklinks', '_Nenhuma nota externa cita este documento até o momento._');
                }
            }

            const tags = Array.isArray(article.tags) ? article.tags.filter(tg => typeof tg === 'string') : [];
            const yamlTags = tags.map(yamlStr).join(', ');
            const yearNum = article.year !== undefined && article.year !== null && /^\d{1,4}$/.test(String(article.year).trim())
                ? String(article.year).trim()
                : (article.year ? yamlStr(article.year) : 'null');

            const mdContent = [
                '---',
                `title: ${yamlStr(oneLine(article.title) || untitled)}`,
                `authors: ${yamlStr(article.authors || '')}`,
                `year: ${yearNum}`,
                `publication: ${yamlStr(article.publication || '')}`,
                `doi: ${yamlStr(normalizeDoi(article.doi))}`,
                `collection: ${yamlStr(article.collection || '')}`,
                `tags: [${yamlTags}]`,
                `status: ${yamlStr(article.status || 'inbox')}`,
                `date_added: ${yamlStr(article.addedDate || '')}`,
                'exported_from: "Lexicon Research Manager"',
                '---',
                '',
                `# ${oneLine(article.title) || tr('academic.mdDefaultHeading', 'Fichamento de Pesquisa')}`,
                '',
                `## 📚 ${tr('academic.mdReferencesHeading', 'Referências Bibliográficas Formatadas')}`,
                '',
                `- **ABNT NBR 6023:** ${abnt}`,
                `- **APA 7:** ${apa}`,
                `- **Chicago 17:** ${chicago}`,
                '',
                '### BibTeX',
                '```bibtex',
                bibtex,
                '```',
                '',
                '---',
                '',
                `## 📄 ${tr('academic.mdAbstractHeading', 'Resumo Executivo / Abstract')}`,
                '',
                article.summary || tr('academic.mdNoAbstract', '_Nenhum resumo registrado._'),
                '',
                '---',
                '',
                `## 📝 ${tr('academic.mdNotesHeading', 'Fichamento & Anotações de Leitura')}`,
                '',
                article.notes || tr('academic.mdNoNotes', '_Nenhum fichamento registrado._'),
                '',
                '---',
                '',
                `## 🔗 ${tr('academic.mdBacklinksHeading', 'Citações Reversas & Backlinks (Zettelkasten)')}`,
                '',
                backlinksSection,
                ''
            ].join('\n');

            const safeName = stripDiacritics(article.title || 'artigo')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '')
                .substring(0, 40)
                .replace(/^_+|_+$/g, '');

            const fileName = `${tr('academic.mdFilePrefix', 'fichamento')}_${safeName || article.id}.md`;
            this.downloadFile(mdContent, fileName, 'text/markdown;charset=utf-8');

            toast(tr('inspector.exportedNotesSuccess', 'Fichamento estruturado exportado (.md)!'), 'success');
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
         * Initializes listeners for document clicks to close dropdowns (idempotent)
         */
        init() {
            if (initialized) return;
            initialized = true;

            document.addEventListener('click', (e) => {
                const container = document.getElementById('inspector-cite-menu-container');
                if (container && !container.contains(e.target)) {
                    this.closeCiteMenu();
                }
            });

            // Allow pressing Enter in DOI inputs to trigger metadata fetch (respects in-flight guards)
            document.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' || !e.target) return;
                if (e.target.id === 'inspector-doi') {
                    e.preventDefault();
                    if (!inspectorFetchInFlight) this.fetchInspectorMetadata();
                } else if (e.target.id === 'form-doi') {
                    e.preventDefault();
                    if (!formFetchInFlight) this.fetchUploadFormMetadata();
                }
            });
        }
    };

    window.Lexicon.Academic = Academic;
    window.Lexicon.Citation = Academic; // Alias for backward/spec compatibility
})();
