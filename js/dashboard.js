/* ==========================================================================
   Lexicon - Research Analytics & Reading Dashboard Module
   Zero-dependency, pure native SVG charts (Local-first, lightweight)
   Pipeline Funnel, Reading Rhythm, Collections Distribution & Tag Cloud
   Full i18n support (PT-BR / EN-US)
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    'use strict';

    /**
     * Helper for i18n translation with interpolation (existing keys)
     */
    function t(key, params = {}) {
        if (window.Lexicon.I18n && typeof window.Lexicon.I18n.t === 'function') {
            return window.Lexicon.I18n.t(key, params);
        }
        return key;
    }

    /**
     * i18n lookup with local fallback for new keys (I18n.t returns the key itself when missing)
     */
    const tr = (key, fallback, params) => {
        const I = window.Lexicon.I18n;
        if (I && typeof I.t === 'function') {
            const v = I.t(key, params);
            if (typeof v === 'string' && v !== key) return v;
        }
        return String(fallback).replace(/\{(\w+)\}/g, (_, k) => params && params[k] !== undefined ? params[k] : `{${k}}`);
    };

    /** Singular/plural helper: uses `${key}One` when count === 1 */
    const trCount = (key, fallbackOne, fallbackMany, count, extra) => {
        const params = Object.assign({ count }, extra || {});
        return count === 1
            ? tr(`${key}One`, fallbackOne, params)
            : tr(key, fallbackMany, params);
    };

    const esc = (s) => {
        const U = window.Lexicon.Utils;
        if (U && typeof U.escapeHTML === 'function') return U.escapeHTML(String(s === null || s === undefined ? '' : s));
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };

    const STAGES = ['inbox', 'reading', 'processing', 'archived'];
    /** Missing/unknown status is treated as 'inbox' everywhere */
    const normStatus = (s) => STAGES.includes(s) ? s : 'inbox';

    // Internal sentinel keys (cannot collide with real collection names)
    const UNCAT_KEY = '\u0000__lexicon_uncategorized__';
    const OTHERS_KEY = '\u0000__lexicon_others__';
    const MAX_DONUT_SLICES = 8;

    const PALETTE = ['#1B4332', '#2D6A4F', '#40916C', '#E07A5F', '#D1C7B7', '#4A4036', '#74C69D', '#B5838D', '#F2CC8F', '#3D405B'];
    const OTHERS_COLOR = '#A8A29E';

    const DAY_MS = 1000 * 60 * 60 * 24;

    const currentLocale = () => {
        const I = window.Lexicon.I18n;
        return (I && I.locale) || 'pt-BR';
    };

    /**
     * Parses 'YYYY-MM-DD' as a LOCAL date (new Date('YYYY-MM-DD') is UTC midnight).
     * Full ISO strings (with time) and timestamps are parsed natively.
     * @returns {Date|null}
     */
    function parseLocalDate(value) {
        if (value === null || value === undefined || value === '') return null;
        if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
        if (typeof value === 'number') {
            const d = new Date(value);
            return isNaN(d.getTime()) ? null : d;
        }
        const str = String(value).trim();
        const m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (m) {
            const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
            return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }

    /**
     * Whole days since the given date (local calendar), never negative
     */
    function daysSince(dateStr) {
        const added = parseLocalDate(dateStr);
        if (!added) return 0;
        const now = new Date();
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startAdded = new Date(added.getFullYear(), added.getMonth(), added.getDate());
        const diff = Math.round((startToday - startAdded) / DAY_MS);
        return Math.max(0, diff);
    }

    const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    function monthShortName(year, monthIndex) {
        const d = new Date(year, monthIndex, 1);
        let name;
        try {
            name = new Intl.DateTimeFormat(currentLocale(), { month: 'short' }).format(d);
        } catch (e) {
            name = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d);
        }
        name = name.replace(/\.$/, '');
        return name.charAt(0).toUpperCase() + name.slice(1);
    }

    /**
     * Builds a chronological, gap-filled monthly series.
     * @returns {{ series: Array<{key:string,label:string,count:number}>, spanMonths: number, datedCount: number }}
     */
    function buildMonthlySeries(articles) {
        const counts = new Map();
        let datedCount = 0;
        articles.forEach(a => {
            const d = parseLocalDate(a.addedDate);
            if (!d) return; // missing/invalid dates are excluded from the series
            datedCount++;
            const k = monthKey(d);
            counts.set(k, (counts.get(k) || 0) + 1);
        });
        if (!counts.size) return { series: [], spanMonths: 0, datedCount: 0 };

        const keys = Array.from(counts.keys()).sort();
        const [fy, fm] = keys[0].split('-').map(Number);
        const [ly, lm] = keys[keys.length - 1].split('-').map(Number);

        const all = [];
        let y = fy;
        let m = fm;
        while (y < ly || (y === ly && m <= lm)) {
            const k = `${y}-${String(m).padStart(2, '0')}`;
            all.push({ key: k, year: y, month: m - 1, count: counts.get(k) || 0 });
            m++;
            if (m > 12) { m = 1; y++; }
        }

        const spanMonths = all.length;
        const shown = all.slice(-12);
        const spansYears = shown.length > 0 && shown[0].year !== shown[shown.length - 1].year;
        const series = shown.map(s => ({
            key: s.key,
            count: s.count,
            label: spansYears
                ? `${monthShortName(s.year, s.month)} ${String(s.year).slice(-2)}`
                : monthShortName(s.year, s.month)
        }));
        return { series, spanMonths, datedCount };
    }

    /** Case-insensitive tag counting, displaying the most common casing */
    function buildTagData(articles) {
        const map = new Map();
        articles.forEach(a => {
            (Array.isArray(a.tags) ? a.tags : []).forEach(rawTag => {
                if (typeof rawTag !== 'string') return;
                const clean = rawTag.trim();
                if (!clean) return;
                const k = clean.toLocaleLowerCase();
                let entry = map.get(k);
                if (!entry) {
                    entry = { count: 0, variants: new Map() };
                    map.set(k, entry);
                }
                entry.count++;
                entry.variants.set(clean, (entry.variants.get(clean) || 0) + 1);
            });
        });
        return Array.from(map.values()).map(entry => {
            let best = '';
            let bestCount = -1;
            entry.variants.forEach((c, v) => {
                if (c > bestCount) { best = v; bestCount = c; }
            });
            return [best, entry.count];
        }).sort((a, b) => b[1] - a[1]).slice(0, 20);
    }

    /** Collection breakdown, grouped into top N + "Others" */
    function buildCollectionData(articles) {
        const map = new Map();
        articles.forEach(a => {
            const c = (typeof a.collection === 'string' && a.collection.trim()) ? a.collection : UNCAT_KEY;
            map.set(c, (map.get(c) || 0) + 1);
        });
        const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
        if (sorted.length <= MAX_DONUT_SLICES) return sorted;
        const top = sorted.slice(0, MAX_DONUT_SLICES);
        const othersCount = sorted.slice(MAX_DONUT_SLICES).reduce((acc, e) => acc + e[1], 0);
        top.push([OTHERS_KEY, othersCount, sorted.length - MAX_DONUT_SLICES]);
        return top;
    }

    const collectionLabel = (key, extra) => {
        if (key === UNCAT_KEY) return t('dashboard.uncategorized');
        if (key === OTHERS_KEY) {
            return trCount('dashboard.othersCollections', 'Outras ({count} coleção)', 'Outras ({count} coleções)', extra || 0);
        }
        return key;
    };

    /** Attribute snippet for a delegated, keyboard-accessible dashboard action */
    const dashAttrs = (action, value) =>
        `data-dash-action="${esc(action)}"${value !== undefined ? ` data-dash-value="${esc(value)}"` : ''} role="button" tabindex="0"`;

    /**
     * Attaches ONE delegated click/keyboard listener to the container (idempotent)
     */
    function ensureDelegation(container) {
        if (!container || container._dashDelegation) return;
        container._dashDelegation = true;

        const run = (el) => {
            const Articles = window.Lexicon.Articles;
            if (!Articles) return;
            const action = el.getAttribute('data-dash-action');
            const value = el.getAttribute('data-dash-value');
            switch (action) {
                case 'category':
                    if (typeof Articles.setCategoryFilter === 'function' && STAGES.concat(['all']).includes(value)) {
                        Articles.setCategoryFilter(value);
                    }
                    break;
                case 'tag':
                    if (typeof Articles.filterByTag === 'function' && value) Articles.filterByTag(value);
                    break;
                case 'collection':
                    if (typeof Articles.filterByCollection === 'function' && value) Articles.filterByCollection(value);
                    break;
                case 'unfiled':
                    if (typeof Articles.filterUnfiled === 'function') {
                        Articles.filterUnfiled();
                    } else if (typeof Articles.setCategoryFilter === 'function') {
                        Articles.setCategoryFilter('collections');
                    }
                    break;
                default:
                    break;
            }
        };

        const findTarget = (e) => {
            const start = e.target && e.target.closest ? e.target : (e.target && e.target.parentElement);
            if (!start || !start.closest) return null;
            const el = start.closest('[data-dash-action]');
            return el && container.contains(el) ? el : null;
        };

        container.addEventListener('click', (e) => {
            const el = findTarget(e);
            if (!el) return;
            e.preventDefault();
            run(el);
        });

        container.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const el = findTarget(e);
            if (!el) return;
            e.preventDefault();
            run(el);
        });
    }

    const average = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    window.Lexicon.Dashboard = {
        // Exposed for reuse/testing
        parseLocalDate,
        daysSince,

        /**
         * Render the full Analytics & Insights Dashboard
         */
        render(container, emptyState, viewTitle, viewCount) {
            if (!container) return;
            const state = window.Lexicon.State || {};
            const articles = Array.isArray(state.articles) ? state.articles : [];
            const collections = Array.isArray(state.collections) ? state.collections : [];

            if (emptyState) emptyState.classList.add('hidden');
            if (viewTitle) viewTitle.textContent = t('dashboard.title');
            if (viewCount) viewCount.textContent = t('dashboard.countInfo', { docs: articles.length, cols: collections.length });

            // Reset container class from cards multi-column grid to full-width block layout
            container.className = 'w-full block';
            ensureDelegation(container);

            if (articles.length === 0) {
                container.innerHTML = `
                    <div class="py-16 text-center text-earth">
                        <i class="ph ph-chart-line-up text-4xl text-wood mb-3"></i>
                        <h3 class="text-base font-serif font-bold text-soil">${t('dashboard.emptyTitle')}</h3>
                        <p class="text-xs max-w-sm mx-auto mt-1">${t('dashboard.emptyDesc')}</p>
                    </div>
                `;
                return;
            }

            // 1. Pipeline Funnel Counts (unknown/missing status -> inbox)
            const funnel = { inbox: 0, reading: 0, processing: 0, archived: 0 };
            articles.forEach(a => { funnel[normStatus(a.status)]++; });

            const total = articles.length;
            const completedCount = funnel.archived;
            const completionRate = Math.round((completedCount / total) * 100);

            // Articles with substantive notes (Fichamento completo)
            const notesCount = articles.filter(a => typeof a.notes === 'string' && a.notes.trim().length > 20).length;

            // 2. Age (days since added) of documents currently in each stage
            const stayTimes = { inbox: [], reading: [], processing: [], archived: [] };
            articles.forEach(a => {
                stayTimes[normStatus(a.status)].push(daysSince(a.addedDate));
            });
            const avgStay = {
                inbox: average(stayTimes.inbox),
                reading: average(stayTimes.reading),
                processing: average(stayTimes.processing),
                archived: average(stayTimes.archived)
            };

            const overallAvgDays = Math.round(articles.reduce((acc, a) => acc + daysSince(a.addedDate), 0) / total);

            // 3. Collection Breakdown (sentinel keys for uncategorized / others)
            const colData = buildCollectionData(articles);

            // 4. Tag Cloud
            const tagData = buildTagData(articles);

            // 5. Monthly Trend
            const monthly = buildMonthlySeries(articles);
            const avgPerMonth = monthly.spanMonths
                ? Math.round((monthly.datedCount / monthly.spanMonths) * 10) / 10
                : 0;

            const docsLabel = (n) => trCount('dashboard.docCount', '{count} doc', '{count} docs', n);

            // Render Dashboard HTML with native SVGs
            container.innerHTML = `
                <div class="w-full space-y-6 pb-12">
                    
                    <!-- KPI Cards Bar (Interactive & Fully Localized) -->
                    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                        <div class="p-4 bg-paper rounded-2xl border border-wood shadow-2xs cursor-pointer hover:border-leaf/60 transition-all group"
                             ${dashAttrs('category', 'all')} title="${esc(t('nav.all'))}">
                            <div class="flex items-center justify-between text-earth mb-1">
                                <span class="text-[11px] font-bold uppercase tracking-wider">${t('dashboard.totalLibrary')}</span>
                                <i class="ph ph-books text-base text-jungle group-hover:scale-110 transition-transform"></i>
                            </div>
                            <div class="text-2xl font-serif font-bold text-soil">${total}</div>
                            <div class="text-[10px] text-earth/80 mt-1">${t('dashboard.activeCollections', { count: collections.length })}</div>
                        </div>

                        <div class="p-4 bg-paper rounded-2xl border border-wood shadow-2xs cursor-pointer hover:border-leaf/60 transition-all group"
                             ${dashAttrs('category', 'processing')} title="${esc(tr('dashboard.notesKpiTitle', 'Documentos com anotações substanciais (mais de 20 caracteres). Clique para abrir a etapa Processando.'))}">
                            <div class="flex items-center justify-between text-earth mb-1">
                                <span class="text-[11px] font-bold uppercase tracking-wider">${t('dashboard.notesTaken')}</span>
                                <i class="ph ph-notepad text-base text-leaf group-hover:scale-110 transition-transform"></i>
                            </div>
                            <div class="text-2xl font-serif font-bold text-leaf">${notesCount}</div>
                            <div class="text-[10px] text-earth/80 mt-1">${t('dashboard.withNotes', { pct: Math.round((notesCount / total) * 100) })}</div>
                        </div>

                        <div class="p-4 bg-paper rounded-2xl border border-wood shadow-2xs cursor-pointer hover:border-leaf/60 transition-all group"
                             ${dashAttrs('category', 'reading')} title="${esc(t('nav.reading'))}">
                            <div class="flex items-center justify-between text-earth mb-1">
                                <span class="text-[11px] font-bold uppercase tracking-wider">${t('dashboard.readingNow')}</span>
                                <i class="ph ph-book-open text-base text-jungle group-hover:scale-110 transition-transform"></i>
                            </div>
                            <div class="text-2xl font-serif font-bold text-jungle">${funnel.reading}</div>
                            <div class="text-[10px] text-earth/80 mt-1">${t('dashboard.inActiveReading')}</div>
                        </div>

                        <div class="p-4 bg-paper rounded-2xl border border-wood shadow-2xs cursor-pointer hover:border-leaf/60 transition-all group"
                             ${dashAttrs('category', 'archived')} title="${esc(t('nav.archived'))}">
                            <div class="flex items-center justify-between text-earth mb-1">
                                <span class="text-[11px] font-bold uppercase tracking-wider">${t('dashboard.completed')}</span>
                                <i class="ph ph-archive text-base text-canopy group-hover:scale-110 transition-transform"></i>
                            </div>
                            <div class="text-2xl font-serif font-bold text-canopy">${completedCount}</div>
                            <div class="text-[10px] text-earth/80 mt-1">${t('dashboard.completionRate', { pct: completionRate })}</div>
                        </div>

                        <div class="p-4 bg-paper rounded-2xl border border-wood shadow-2xs col-span-2 sm:col-span-1">
                            <div class="flex items-center justify-between text-earth mb-1">
                                <span class="text-[11px] font-bold uppercase tracking-wider">${t('dashboard.avgStay')}</span>
                                <i class="ph ph-clock text-base text-terracotta"></i>
                            </div>
                            <div class="text-2xl font-serif font-bold text-terracotta">${overallAvgDays} <span class="text-xs font-sans font-normal text-earth">${overallAvgDays === 1 ? tr('dashboard.day', 'dia') : t('dashboard.days')}</span></div>
                            <div class="text-[10px] text-earth/80 mt-1">${t('dashboard.avgInLibrary')}</div>
                        </div>
                    </div>

                    <!-- Row 1: Pipeline Funnel (SVG) & Reading Pace -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        <!-- Card 1: Pipeline Funnel -->
                        <div class="p-5 bg-paper rounded-2xl border border-wood shadow-2xs flex flex-col justify-between">
                            <div class="flex items-center justify-between mb-3">
                                <div>
                                    <h3 class="text-sm font-bold text-soil flex items-center gap-2">
                                        <i class="ph ph-funnel text-terracotta"></i>
                                        ${t('dashboard.funnelTitle')}
                                    </h3>
                                    <p class="text-[11px] text-earth mt-0.5">${t('dashboard.funnelSubtitle')}</p>
                                </div>
                                <span class="text-xs font-mono font-bold text-earth bg-sand px-2 py-0.5 rounded-lg border border-wood/60">
                                    ${total === 1 ? tr('dashboard.docsBadgeOne', '{count} Doc', { count: total }) : t('dashboard.docsBadge', { count: total })}
                                </span>
                            </div>

                            <div class="w-full my-2">
                                ${this.renderFunnelSVG(funnel, total)}
                            </div>

                            <div class="grid grid-cols-4 gap-2 pt-3 border-t border-wood/40 text-center text-[11px]">
                                <div class="cursor-pointer hover:bg-sand/60 p-1.5 rounded-lg transition-colors group" ${dashAttrs('category', 'inbox')}>
                                    <span class="block font-bold text-terracotta group-hover:scale-105 transition-transform">${funnel.inbox}</span>
                                    <span class="text-earth text-[10px]">${t('dashboard.funnelInbox')}</span>
                                </div>
                                <div class="cursor-pointer hover:bg-sand/60 p-1.5 rounded-lg transition-colors group" ${dashAttrs('category', 'reading')}>
                                    <span class="block font-bold text-jungle group-hover:scale-105 transition-transform">${funnel.reading}</span>
                                    <span class="text-earth text-[10px]">${t('dashboard.funnelReading')}</span>
                                </div>
                                <div class="cursor-pointer hover:bg-sand/60 p-1.5 rounded-lg transition-colors group" ${dashAttrs('category', 'processing')}>
                                    <span class="block font-bold text-leaf group-hover:scale-105 transition-transform">${funnel.processing}</span>
                                    <span class="text-earth text-[10px]">${t('dashboard.funnelProcessing')}</span>
                                </div>
                                <div class="cursor-pointer hover:bg-sand/60 p-1.5 rounded-lg transition-colors group" ${dashAttrs('category', 'archived')}>
                                    <span class="block font-bold text-canopy group-hover:scale-105 transition-transform">${funnel.archived}</span>
                                    <span class="text-earth text-[10px]">${t('dashboard.funnelArchived')}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Card 2: Ritmo de Leitura (Monthly Additions / Flow) -->
                        <div class="p-5 bg-paper rounded-2xl border border-wood shadow-2xs flex flex-col justify-between">
                            <div class="flex items-center justify-between mb-3">
                                <div>
                                    <h3 class="text-sm font-bold text-soil flex items-center gap-2">
                                        <i class="ph ph-trend-up text-jungle"></i>
                                        ${t('dashboard.paceTitle')}
                                    </h3>
                                    <p class="text-[11px] text-earth mt-0.5">${t('dashboard.paceSubtitle')}</p>
                                </div>
                                <span class="text-xs font-mono font-bold text-earth bg-sand px-2 py-0.5 rounded-lg border border-wood/60">
                                    ${monthly.spanMonths === 1 ? tr('dashboard.monthsOne', '{count} Mês', { count: 1 }) : t('dashboard.months', { count: monthly.spanMonths })}
                                </span>
                            </div>

                            <div class="w-full my-2">
                                ${this.renderMonthlyBarsSVG(monthly.series)}
                            </div>

                            <div class="flex items-center justify-between text-[11px] text-earth pt-3 border-t border-wood/40">
                                <span>${t('dashboard.monthlyPace')} <strong>${avgPerMonth === 1 ? tr('dashboard.articlesPerMonthOne', '{count} artigo/mês', { count: 1 }) : t('dashboard.articlesPerMonth', { count: avgPerMonth.toLocaleString(currentLocale()) })}</strong></span>
                                <span class="text-jungle font-semibold">${t('dashboard.consistencyBadge')}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Row 2: Collections Distribution & Average Stay Time -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        <!-- Card 3: Collections Distribution (Donut & Breakdown) -->
                        <div class="p-5 bg-paper rounded-2xl border border-wood shadow-2xs flex flex-col justify-between">
                            <div class="flex items-center justify-between mb-3">
                                <div>
                                    <h3 class="text-sm font-bold text-soil flex items-center gap-2">
                                        <i class="ph ph-folders text-jungle"></i>
                                        ${t('dashboard.collectionsTitle')}
                                    </h3>
                                    <p class="text-[11px] text-earth mt-0.5">${t('dashboard.collectionsSubtitle')}</p>
                                </div>
                            </div>

                            <div class="flex flex-col sm:flex-row items-center gap-6 my-2">
                                <div class="shrink-0">
                                    ${this.renderDonutSVG(colData, total)}
                                </div>
                                <div class="flex-1 space-y-2 w-full">
                                    ${colData.map((c, i) => {
                                        const [key, count, extra] = c;
                                        const pct = Math.round((count / total) * 100);
                                        const color = key === OTHERS_KEY ? OTHERS_COLOR : PALETTE[i % PALETTE.length];
                                        const label = collectionLabel(key, extra);
                                        const isOthers = key === OTHERS_KEY;
                                        const actionAttrs = isOthers
                                            ? ''
                                            : (key === UNCAT_KEY ? dashAttrs('unfiled') : dashAttrs('collection', key));
                                        const rowClass = isOthers
                                            ? 'flex items-center justify-between text-xs p-1 rounded-lg'
                                            : 'flex items-center justify-between text-xs cursor-pointer hover:bg-sand/60 p-1 rounded-lg transition-colors group';
                                        return `
                                            <div class="${rowClass}" ${actionAttrs} title="${esc(label)}">
                                                <div class="flex items-center gap-2 min-w-0">
                                                    <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${color};"></span>
                                                    <span class="truncate font-medium text-soil group-hover:text-jungle transition-colors">${esc(label)}</span>
                                                </div>
                                                <div class="flex items-center gap-2 shrink-0 font-mono text-[11px] text-earth">
                                                    <span>${esc(docsLabel(count))}</span>
                                                    <span class="font-bold text-soil w-8 text-right">${pct}%</span>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- Card 4: Age of documents per pipeline stage -->
                        <div class="p-5 bg-paper rounded-2xl border border-wood shadow-2xs flex flex-col justify-between">
                            <div class="flex items-center justify-between mb-3">
                                <div>
                                    <h3 class="text-sm font-bold text-soil flex items-center gap-2">
                                        <i class="ph ph-timer text-terracotta"></i>
                                        ${t('dashboard.stayTimeTitle')}
                                    </h3>
                                    <p class="text-[11px] text-earth mt-0.5">${esc(tr('dashboard.stayTimeSubtitleAge', 'Idade média (dias desde a entrada no acervo) dos documentos atualmente em cada etapa'))}</p>
                                </div>
                            </div>

                            <div class="space-y-4 my-2">
                                ${this.renderStayBars(avgStay, funnel)}
                            </div>

                            <div class="text-[11px] text-earth/80 pt-3 border-t border-wood/40 flex items-center justify-between">
                                <span>${t('dashboard.stayWorkflowHint')}</span>
                                <i class="ph ph-check-circle text-leaf text-base"></i>
                            </div>
                        </div>
                    </div>

                    <!-- Row 3: Tag Cloud & Topic Clustering -->
                    <div class="p-5 bg-paper rounded-2xl border border-wood shadow-2xs">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h3 class="text-sm font-bold text-soil flex items-center gap-2">
                                    <i class="ph ph-tag text-leaf"></i>
                                    ${t('dashboard.tagCloudTitle')}
                                </h3>
                                <p class="text-[11px] text-earth mt-0.5">${t('dashboard.tagCloudSubtitle')}</p>
                            </div>
                            <span class="text-xs text-earth font-medium">${t('dashboard.topicsCount', { count: tagData.length })}</span>
                        </div>

                        <div class="flex flex-wrap items-center gap-2 p-4 bg-sand/50 border border-wood/50 rounded-xl min-h-[120px]">
                            ${tagData.length === 0 ? `
                                <span class="text-xs text-earth/70 italic">${t('dashboard.noTags')}</span>
                            ` : tagData.map(([tag, count]) => {
                                const maxCount = tagData[0][1];
                                const scale = 0.8 + (count / maxCount) * 0.7; // between 0.8rem and 1.5rem
                                const safeTag = esc(tag);
                                const titleText = count === 1
                                    ? tr('dashboard.filterByTagTitleOne', 'Filtrar por #{tag} ({count} artigo)', { tag: safeTag, count })
                                    : t('dashboard.filterByTagTitle', { tag: safeTag, count: count });
                                return `
                                    <button type="button" data-dash-action="tag" data-dash-value="${safeTag}"
                                            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white hover:bg-jungle hover:text-white border border-wood text-soil font-medium transition-all shadow-2xs cursor-pointer group"
                                            style="font-size: ${scale.toFixed(2)}rem;"
                                            title="${titleText}">
                                        <span class="text-leaf group-hover:text-white">#</span>${safeTag}
                                        <span class="text-[10px] font-mono opacity-70 bg-sand group-hover:bg-canopy group-hover:text-white px-1.5 py-0.2 rounded-full">${count}</span>
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>

                </div>
            `;
        },

        /**
         * Render Pipeline Funnel SVG
         */
        renderFunnelSVG(funnel, total) {
            const stages = [
                { key: 'inbox', name: t('dashboard.funnelInbox'), count: funnel.inbox, color: '#E07A5F' },
                { key: 'reading', name: t('dashboard.funnelReading'), count: funnel.reading, color: '#2D6A4F' },
                { key: 'processing', name: t('dashboard.funnelProcessing'), count: funnel.processing, color: '#40916C' },
                { key: 'archived', name: t('dashboard.funnelArchived'), count: funnel.archived, color: '#1B4332' }
            ];

            const width = 500;
            const height = 140;
            const barWidth = 110;
            const gap = 16;
            const maxBar = 80;
            const safeTotal = Math.max(1, total);

            const maxCount = Math.max(1, ...stages.map(s => s.count));

            const svgElements = stages.map((st, i) => {
                const x = i * (barWidth + gap) + 8;
                const pct = Math.round((st.count / safeTotal) * 100);
                // Empty stages get a thin placeholder bar instead of looking like a real value
                const h = st.count === 0 ? 4 : Math.max(12, Math.round((st.count / maxCount) * maxBar));
                const y = height - 40 - h;
                const inside = h > 35;

                return `
                    <g class="funnel-stage cursor-pointer group" ${dashAttrs('category', st.key)}>
                        <title>${esc(st.name)}: ${st.count} (${pct}%)</title>
                        <rect x="${x}" y="${y + 2}" width="${barWidth}" height="${h}" rx="${Math.min(8, h / 2)}" fill="rgba(0,0,0,0.06)" />
                        <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="${Math.min(8, h / 2)}" fill="${st.color}" opacity="${st.count === 0 ? 0.35 : 1}" class="hover:opacity-90 transition-opacity" />
                        <text x="${x + barWidth / 2}" y="${inside ? y + h / 2 + 5 : y - 8}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="14" fill="${inside ? '#ffffff' : st.color}">
                            ${st.count}
                        </text>
                        <text x="${x + barWidth / 2}" y="${height - 20}" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="11" fill="#4A4036">
                            ${esc(st.name)}
                        </text>
                        <text x="${x + barWidth / 2}" y="${height - 6}" text-anchor="middle" font-family="monospace" font-size="10" fill="#4A4036" opacity="0.8">
                            ${pct}%
                        </text>
                        ${i < 3 ? `
                            <path d="M ${x + barWidth + 4} ${height - 60} L ${x + barWidth + 12} ${height - 60}" stroke="#D1C7B7" stroke-width="2" stroke-linecap="round" />
                        ` : ''}
                    </g>
                `;
            }).join('');

            return `
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto overflow-visible select-none">
                    ${svgElements}
                </svg>
            `;
        },

        /**
         * Render Monthly Pace SVG Bar Chart
         * @param {Array<{key:string,label:string,count:number}>} series chronological, gap-filled
         */
        renderMonthlyBarsSVG(series) {
            if (!Array.isArray(series) || series.length === 0) {
                return `<div class="py-8 text-center text-xs text-earth">${t('dashboard.noMonthlyData')}</div>`;
            }

            const width = 500;
            const height = 140;
            const paddingLeft = 30;
            const paddingRight = 10;
            const paddingBottom = 25;
            const availableWidth = width - paddingLeft - paddingRight;
            const availableHeight = height - paddingBottom - 15;

            const n = series.length;
            const slot = availableWidth / n;
            // Bars always fit inside their slot (no overlap)
            const barWidth = Math.max(4, Math.min(45, slot * 0.7));
            const maxVal = Math.max(1, ...series.map(m => m.count));
            const labelSize = slot < 36 ? 8 : 9;

            const bars = series.map((m, idx) => {
                const x = paddingLeft + idx * slot + (slot - barWidth) / 2;
                const barHeight = m.count === 0 ? 0 : Math.max(4, (m.count / maxVal) * availableHeight);
                const y = height - paddingBottom - barHeight;

                return `
                    <g class="month-bar group">
                        <title>${esc(m.label)}: ${m.count}</title>
                        ${barHeight > 0 ? `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="${Math.min(5, barWidth / 2).toFixed(2)}" fill="#2D6A4F" class="hover:fill-jungle transition-all" />` : ''}
                        <text x="${(x + barWidth / 2).toFixed(2)}" y="${(y - 4).toFixed(2)}" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="10" fill="#2D6A4F" ${m.count === 0 ? 'opacity="0.4"' : ''}>
                            ${m.count}
                        </text>
                        <text x="${(x + barWidth / 2).toFixed(2)}" y="${height - 8}" text-anchor="middle" font-family="sans-serif" font-size="${labelSize}" fill="#4A4036">
                            ${esc(m.label)}
                        </text>
                    </g>
                `;
            }).join('');

            return `
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto select-none">
                    <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width}" y2="${height - paddingBottom}" stroke="#D1C7B7" stroke-width="1" />
                    <line x1="${paddingLeft}" y1="${height - paddingBottom - availableHeight / 2}" x2="${width}" y2="${height - paddingBottom - availableHeight / 2}" stroke="#E6DFD3" stroke-dasharray="3 3" />
                    <line x1="${paddingLeft}" y1="${height - paddingBottom - availableHeight}" x2="${width}" y2="${height - paddingBottom - availableHeight}" stroke="#E6DFD3" stroke-dasharray="3 3" />
                    ${bars}
                </svg>
            `;
        },

        /**
         * Render SVG Donut Chart for Collections
         * @param {Array} colData [key, count, extra?][] (already grouped into top N + others)
         */
        renderDonutSVG(colData, total) {
            const size = 120;
            const strokeWidth = 22;
            const radius = (size - strokeWidth) / 2;
            const circumference = 2 * Math.PI * radius;
            const safeTotal = Math.max(1, total);

            let accumulatedDash = 0;

            const segments = colData.map((c, i) => {
                const [key, count, extra] = c;
                const ratio = count / safeTotal;
                const dash = ratio * circumference;
                const offset = circumference - accumulatedDash;
                accumulatedDash += dash;
                const isOthers = key === OTHERS_KEY;
                const color = isOthers ? OTHERS_COLOR : PALETTE[i % PALETTE.length];
                const label = collectionLabel(key, extra);
                const actionAttrs = isOthers
                    ? ''
                    : (key === UNCAT_KEY ? dashAttrs('unfiled') : dashAttrs('collection', key));

                return `
                    <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
                            fill="transparent"
                            stroke="${color}"
                            stroke-width="${strokeWidth}"
                            stroke-dasharray="${dash} ${circumference - dash}"
                            stroke-dashoffset="${offset}"
                            class="transition-all hover:opacity-85${isOthers ? '' : ' cursor-pointer'}" ${actionAttrs}>
                        <title>${esc(label)}: ${count}</title>
                    </circle>
                `;
            }).join('');

            return `
                <div class="relative w-[120px] h-[120px]">
                    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="transform -rotate-90">
                        ${segments}
                    </svg>
                    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span class="text-base font-serif font-bold text-soil leading-none">${total}</span>
                        <span class="text-[9px] text-earth uppercase font-semibold">${esc(total === 1 ? tr('dashboard.donutDocsLabelOne', 'Doc') : tr('dashboard.donutDocsLabel', 'Docs'))}</span>
                    </div>
                </div>
            `;
        },

        /**
         * Render average-age bars per stage (Interactive)
         * @param {Object} avgStay average age in days per stage
         * @param {Object} [funnel] document count per stage
         */
        renderStayBars(avgStay, funnel) {
            const stages = [
                { key: 'inbox', label: t('dashboard.stageInbox'), days: avgStay.inbox, color: 'bg-terracotta' },
                { key: 'reading', label: t('dashboard.stageReading'), days: avgStay.reading, color: 'bg-jungle' },
                { key: 'processing', label: t('dashboard.stageProcessing'), days: avgStay.processing, color: 'bg-leaf' },
                { key: 'archived', label: t('dashboard.stageArchived'), days: avgStay.archived, color: 'bg-canopy' }
            ];

            const maxDays = Math.max(1, ...stages.map(s => s.days));

            return stages.map(st => {
                const pct = Math.max(5, Math.round((st.days / maxDays) * 100));
                const docs = funnel ? funnel[st.key] || 0 : null;
                const dayLabel = st.days === 1 ? tr('dashboard.day', 'dia') : t('dashboard.days');
                const titleText = docs === null ? '' : tr('dashboard.stayBarTitle', '{stage}: idade média de {days} dia(s) em {count} documento(s)', { stage: st.label, days: st.days, count: docs });
                return `
                    <div class="cursor-pointer group hover:bg-sand/60 p-1.5 rounded-xl transition-colors" ${dashAttrs('category', st.key)}${titleText ? ` title="${esc(titleText)}"` : ''}>
                        <div class="flex items-center justify-between text-xs mb-1">
                            <span class="font-medium text-soil group-hover:text-jungle transition-colors">${st.label}</span>
                            <span class="font-mono font-bold text-earth text-[11px]">${st.days} ${dayLabel}</span>
                        </div>
                        <div class="w-full h-2.5 bg-sand rounded-full overflow-hidden border border-wood/40">
                            <div class="h-full rounded-full ${st.color} transition-all duration-500" style="width: ${pct}%;"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    };
})();
