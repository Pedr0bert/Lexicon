/* ==========================================================================
   Lexicon - Research Analytics & Reading Dashboard Module
   Zero-dependency, pure native SVG charts (Local-first, lightweight)
   Pipeline Funnel, Reading Rhythm, Collections Distribution & Tag Cloud
   Full i18n support (PT-BR / EN-US)
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    /**
     * Helper for i18n translation with interpolation
     */
    function t(key, params = {}) {
        if (window.Lexicon.I18n && typeof window.Lexicon.I18n.t === 'function') {
            return window.Lexicon.I18n.t(key, params);
        }
        return key;
    }

    /**
     * Compute days difference between ISO date and today
     */
    function daysSince(dateStr) {
        if (!dateStr) return 0;
        const added = new Date(dateStr);
        if (isNaN(added.getTime())) return 0;
        const now = new Date();
        const diffTime = Math.abs(now - added);
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Format Month Year (e.g. "Jan 2024") with active locale support
     */
    function formatMonthYear(dateStr) {
        const isEn = window.Lexicon.I18n && window.Lexicon.I18n.locale === 'en-US';
        if (!dateStr) return isEn ? 'Recent' : 'Recente';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return isEn ? 'Recent' : 'Recente';
        const monthsPt = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const months = isEn ? monthsEn : monthsPt;
        return `${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    window.Lexicon.Dashboard = {
        /**
         * Render the full Analytics & Insights Dashboard
         */
        render(container, emptyState, viewTitle, viewCount) {
            const state = window.Lexicon.State;
            const articles = state.articles || [];
            const collections = state.collections || [];

            if (emptyState) emptyState.classList.add('hidden');
            if (viewTitle) viewTitle.textContent = t('dashboard.title');
            if (viewCount) viewCount.textContent = t('dashboard.countInfo', { docs: articles.length, cols: collections.length });

            // Reset container class from cards multi-column grid to full-width block layout
            if (container) {
                container.className = 'w-full block';
            }

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

            // 1. Calculate Pipeline Funnel Counts
            const funnel = {
                inbox: articles.filter(a => a.status === 'inbox').length,
                reading: articles.filter(a => a.status === 'reading').length,
                processing: articles.filter(a => a.status === 'processing').length,
                archived: articles.filter(a => a.status === 'archived').length
            };

            const total = articles.length;
            const completedCount = funnel.archived;
            const completionRate = Math.round((completedCount / total) * 100);

            // Articles with substantive notes (Fichamento completo)
            const notesCount = articles.filter(a => (a.notes || '').trim().length > 20).length;

            // 2. Calculate Stay Times (Tempo Médio de Permanência)
            const stayTimes = {
                inbox: [],
                reading: [],
                processing: [],
                archived: []
            };

            articles.forEach(a => {
                const days = daysSince(a.addedDate);
                const st = a.status || 'inbox';
                if (stayTimes[st]) stayTimes[st].push(days);
            });

            const avgStay = {
                inbox: stayTimes.inbox.length ? Math.round(stayTimes.inbox.reduce((a, b) => a + b, 0) / stayTimes.inbox.length) : 0,
                reading: stayTimes.reading.length ? Math.round(stayTimes.reading.reduce((a, b) => a + b, 0) / stayTimes.reading.length) : 0,
                processing: stayTimes.processing.length ? Math.round(stayTimes.processing.reduce((a, b) => a + b, 0) / stayTimes.processing.length) : 0,
                archived: stayTimes.archived.length ? Math.round(stayTimes.archived.reduce((a, b) => a + b, 0) / stayTimes.archived.length) : 0
            };

            const overallAvgDays = Math.round(articles.reduce((acc, a) => acc + daysSince(a.addedDate), 0) / total);

            // 3. Collection Breakdown
            const uncatLabel = t('dashboard.uncategorized');
            const colMap = {};
            articles.forEach(a => {
                const c = a.collection || uncatLabel;
                colMap[c] = (colMap[c] || 0) + 1;
            });
            const colData = Object.entries(colMap).sort((a, b) => b[1] - a[1]);

            // 4. Tag Cloud
            const tagMap = {};
            articles.forEach(a => {
                (a.tags || []).forEach(t => {
                    const clean = t.trim();
                    if (clean) tagMap[clean] = (tagMap[clean] || 0) + 1;
                });
            });
            const tagData = Object.entries(tagMap).sort((a, b) => b[1] - a[1]).slice(0, 20);

            // 5. Monthly Trend
            const monthMap = {};
            articles.forEach(a => {
                const key = formatMonthYear(a.addedDate);
                monthMap[key] = (monthMap[key] || 0) + 1;
            });
            const monthData = Object.entries(monthMap);

            // Render Dashboard HTML with native SVGs
            container.innerHTML = `
                <div class="w-full space-y-6 pb-12">
                    
                    <!-- KPI Cards Bar (Interactive & Fully Localized) -->
                    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                        <div class="p-4 bg-paper rounded-2xl border border-wood shadow-2xs cursor-pointer hover:border-leaf/60 transition-all group"
                             onclick="Lexicon.Articles.setCategoryFilter('all')" title="${t('nav.all')}">
                            <div class="flex items-center justify-between text-earth mb-1">
                                <span class="text-[11px] font-bold uppercase tracking-wider">${t('dashboard.totalLibrary')}</span>
                                <i class="ph ph-books text-base text-jungle group-hover:scale-110 transition-transform"></i>
                            </div>
                            <div class="text-2xl font-serif font-bold text-soil">${total}</div>
                            <div class="text-[10px] text-earth/80 mt-1">${t('dashboard.activeCollections', { count: collections.length })}</div>
                        </div>

                        <div class="p-4 bg-paper rounded-2xl border border-wood shadow-2xs cursor-pointer hover:border-leaf/60 transition-all group"
                             onclick="Lexicon.Articles.setCategoryFilter('processing')" title="${t('nav.processing')}">
                            <div class="flex items-center justify-between text-earth mb-1">
                                <span class="text-[11px] font-bold uppercase tracking-wider">${t('dashboard.notesTaken')}</span>
                                <i class="ph ph-notepad text-base text-leaf group-hover:scale-110 transition-transform"></i>
                            </div>
                            <div class="text-2xl font-serif font-bold text-leaf">${notesCount}</div>
                            <div class="text-[10px] text-earth/80 mt-1">${t('dashboard.withNotes', { pct: Math.round((notesCount / total) * 100) })}</div>
                        </div>

                        <div class="p-4 bg-paper rounded-2xl border border-wood shadow-2xs cursor-pointer hover:border-leaf/60 transition-all group"
                             onclick="Lexicon.Articles.setCategoryFilter('reading')" title="${t('nav.reading')}">
                            <div class="flex items-center justify-between text-earth mb-1">
                                <span class="text-[11px] font-bold uppercase tracking-wider">${t('dashboard.readingNow')}</span>
                                <i class="ph ph-book-open text-base text-jungle group-hover:scale-110 transition-transform"></i>
                            </div>
                            <div class="text-2xl font-serif font-bold text-jungle">${funnel.reading}</div>
                            <div class="text-[10px] text-earth/80 mt-1">${t('dashboard.inActiveReading')}</div>
                        </div>

                        <div class="p-4 bg-paper rounded-2xl border border-wood shadow-2xs cursor-pointer hover:border-leaf/60 transition-all group"
                             onclick="Lexicon.Articles.setCategoryFilter('archived')" title="${t('nav.archived')}">
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
                            <div class="text-2xl font-serif font-bold text-terracotta">${overallAvgDays} <span class="text-xs font-sans font-normal text-earth">${t('dashboard.days')}</span></div>
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
                                    ${t('dashboard.docsBadge', { count: total })}
                                </span>
                            </div>

                            <div class="w-full my-2">
                                ${this.renderFunnelSVG(funnel, total)}
                            </div>

                            <div class="grid grid-cols-4 gap-2 pt-3 border-t border-wood/40 text-center text-[11px]">
                                <div class="cursor-pointer hover:bg-sand/60 p-1.5 rounded-lg transition-colors group" onclick="Lexicon.Articles.setCategoryFilter('inbox')">
                                    <span class="block font-bold text-terracotta group-hover:scale-105 transition-transform">${funnel.inbox}</span>
                                    <span class="text-earth text-[10px]">${t('dashboard.funnelInbox')}</span>
                                </div>
                                <div class="cursor-pointer hover:bg-sand/60 p-1.5 rounded-lg transition-colors group" onclick="Lexicon.Articles.setCategoryFilter('reading')">
                                    <span class="block font-bold text-jungle group-hover:scale-105 transition-transform">${funnel.reading}</span>
                                    <span class="text-earth text-[10px]">${t('dashboard.funnelReading')}</span>
                                </div>
                                <div class="cursor-pointer hover:bg-sand/60 p-1.5 rounded-lg transition-colors group" onclick="Lexicon.Articles.setCategoryFilter('processing')">
                                    <span class="block font-bold text-leaf group-hover:scale-105 transition-transform">${funnel.processing}</span>
                                    <span class="text-earth text-[10px]">${t('dashboard.funnelProcessing')}</span>
                                </div>
                                <div class="cursor-pointer hover:bg-sand/60 p-1.5 rounded-lg transition-colors group" onclick="Lexicon.Articles.setCategoryFilter('archived')">
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
                                    ${t('dashboard.months', { count: monthData.length })}
                                </span>
                            </div>

                            <div class="w-full my-2">
                                ${this.renderMonthlyBarsSVG(monthData)}
                            </div>

                            <div class="flex items-center justify-between text-[11px] text-earth pt-3 border-t border-wood/40">
                                <span>${t('dashboard.monthlyPace')} <strong>${t('dashboard.articlesPerMonth', { count: Math.max(1, Math.round(total / Math.max(1, monthData.length))) })}</strong></span>
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
                                        const pct = Math.round((c[1] / total) * 100);
                                        const colors = ['#1B4332', '#2D6A4F', '#40916C', '#E07A5F', '#D1C7B7', '#4A4036'];
                                        const color = colors[i % colors.length];
                                        const colParam = c[0] === uncatLabel ? '' : c[0];
                                        return `
                                            <div class="flex items-center justify-between text-xs cursor-pointer hover:bg-sand/60 p-1 rounded-lg transition-colors group"
                                                 onclick="Lexicon.Articles.filterByCollection('${window.Lexicon.Utils.escapeHTML(colParam)}')">
                                                <div class="flex items-center gap-2 min-w-0">
                                                    <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${color};"></span>
                                                    <span class="truncate font-medium text-soil group-hover:text-jungle transition-colors">${window.Lexicon.Utils.escapeHTML(c[0])}</span>
                                                </div>
                                                <div class="flex items-center gap-2 shrink-0 font-mono text-[11px] text-earth">
                                                    <span>${c[1]} docs</span>
                                                    <span class="font-bold text-soil w-8 text-right">${pct}%</span>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- Card 4: Average Duration in Pipeline (Tempo Médio) -->
                        <div class="p-5 bg-paper rounded-2xl border border-wood shadow-2xs flex flex-col justify-between">
                            <div class="flex items-center justify-between mb-3">
                                <div>
                                    <h3 class="text-sm font-bold text-soil flex items-center gap-2">
                                        <i class="ph ph-timer text-terracotta"></i>
                                        ${t('dashboard.stayTimeTitle')}
                                    </h3>
                                    <p class="text-[11px] text-earth mt-0.5">${t('dashboard.stayTimeSubtitle')}</p>
                                </div>
                            </div>

                            <div class="space-y-4 my-2">
                                ${this.renderStayBars(avgStay)}
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
                            ` : tagData.map(([tag, count], idx) => {
                                const maxCount = tagData[0][1];
                                const scale = 0.8 + (count / maxCount) * 0.7; // between 0.8em and 1.5em
                                const safeTag = window.Lexicon.Utils.escapeHTML(tag);
                                return `
                                    <button type="button" onclick="Lexicon.Articles.filterByTag('${safeTag}')"
                                            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white hover:bg-jungle hover:text-white border border-wood text-soil font-medium transition-all shadow-2xs cursor-pointer group"
                                            style="font-size: ${scale.toFixed(2)}rem;"
                                            title="${t('dashboard.filterByTagTitle', { tag: safeTag, count: count })}">
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

            const maxCount = Math.max(1, ...stages.map(s => s.count));

            const svgElements = stages.map((st, i) => {
                const x = i * (barWidth + gap) + 8;
                const pct = Math.round((st.count / total) * 100);
                const h = Math.max(24, Math.round((st.count / maxCount) * 80));
                const y = height - 40 - h;

                return `
                    <g class="funnel-stage cursor-pointer group" onclick="Lexicon.Articles.setCategoryFilter('${st.key}')">
                        <!-- Bar shadow -->
                        <rect x="${x}" y="${y + 2}" width="${barWidth}" height="${h}" rx="8" fill="rgba(0,0,0,0.06)" />
                        <!-- Bar body -->
                        <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="8" fill="${st.color}" class="hover:opacity-90 transition-opacity" />
                        <!-- Value badge on bar -->
                        <text x="${x + barWidth / 2}" y="${y + (h > 35 ? h / 2 + 5 : -8)}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="14" fill="${h > 35 ? '#ffffff' : st.color}">
                            ${st.count}
                        </text>
                        <!-- Stage Label -->
                        <text x="${x + barWidth / 2}" y="${height - 20}" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="11" fill="#4A4036">
                            ${st.name}
                        </text>
                        <!-- Percentage label -->
                        <text x="${x + barWidth / 2}" y="${height - 6}" text-anchor="middle" font-family="monospace" font-size="10" fill="#4A4036" opacity="0.8">
                            ${pct}%
                        </text>
                        ${i < 3 ? `
                            <!-- Arrow between stages -->
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
         */
        renderMonthlyBarsSVG(monthData) {
            if (!monthData || monthData.length === 0) {
                return `<div class="py-8 text-center text-xs text-earth">${t('dashboard.noMonthlyData')}</div>`;
            }

            const width = 500;
            const height = 140;
            const paddingLeft = 30;
            const paddingBottom = 25;
            const availableWidth = width - paddingLeft - 10;
            const availableHeight = height - paddingBottom - 15;

            const maxVal = Math.max(1, ...monthData.map(m => m[1]));
            const barWidth = Math.min(45, Math.max(16, (availableWidth / monthData.length) - 10));

            const bars = monthData.map(([month, count], idx) => {
                const x = paddingLeft + idx * (availableWidth / monthData.length) + ((availableWidth / monthData.length) - barWidth) / 2;
                const barHeight = Math.max(8, (count / maxVal) * availableHeight);
                const y = height - paddingBottom - barHeight;

                return `
                    <g class="month-bar group">
                        <!-- Bar -->
                        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="5" fill="#2D6A4F" class="hover:fill-jungle transition-all" />
                        <!-- Count on top -->
                        <text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="10" fill="#2D6A4F">
                            ${count}
                        </text>
                        <!-- Month label below -->
                        <text x="${x + barWidth / 2}" y="${height - 8}" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#4A4036">
                            ${month.split(' ')[0]}
                        </text>
                    </g>
                `;
            }).join('');

            return `
                <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto select-none">
                    <!-- Grid background lines -->
                    <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width}" y2="${height - paddingBottom}" stroke="#D1C7B7" stroke-width="1" />
                    <line x1="${paddingLeft}" y1="${height - paddingBottom - availableHeight / 2}" x2="${width}" y2="${height - paddingBottom - availableHeight / 2}" stroke="#E6DFD3" stroke-dasharray="3 3" />
                    <line x1="${paddingLeft}" y1="${height - paddingBottom - availableHeight}" x2="${width}" y2="${height - paddingBottom - availableHeight}" stroke="#E6DFD3" stroke-dasharray="3 3" />
                    ${bars}
                </svg>
            `;
        },

        /**
         * Render SVG Donut Chart for Collections
         */
        renderDonutSVG(colData, total) {
            const size = 120;
            const strokeWidth = 22;
            const radius = (size - strokeWidth) / 2;
            const circumference = 2 * Math.PI * radius;

            const colors = ['#1B4332', '#2D6A4F', '#40916C', '#E07A5F', '#D1C7B7', '#4A4036'];
            let accumulatedDash = 0;

            const segments = colData.map((c, i) => {
                const ratio = c[1] / total;
                const dash = ratio * circumference;
                const offset = circumference - accumulatedDash;
                accumulatedDash += dash;
                const color = colors[i % colors.length];

                return `
                    <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
                            fill="transparent"
                            stroke="${color}"
                            stroke-width="${strokeWidth}"
                            stroke-dasharray="${dash} ${circumference - dash}"
                            stroke-dashoffset="${offset}"
                            stroke-linecap="round"
                            class="transition-all hover:opacity-85" />
                `;
            }).join('');

            return `
                <div class="relative w-[120px] h-[120px]">
                    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="transform -rotate-90">
                        ${segments}
                    </svg>
                    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span class="text-base font-serif font-bold text-soil leading-none">${total}</span>
                        <span class="text-[9px] text-earth uppercase font-semibold">Docs</span>
                    </div>
                </div>
            `;
        },

        /**
         * Render Stay Times Comparison Bars (Interactive)
         */
        renderStayBars(avgStay) {
            const stages = [
                { key: 'inbox', label: t('dashboard.stageInbox'), days: avgStay.inbox, color: 'bg-terracotta' },
                { key: 'reading', label: t('dashboard.stageReading'), days: avgStay.reading, color: 'bg-jungle' },
                { key: 'processing', label: t('dashboard.stageProcessing'), days: avgStay.processing, color: 'bg-leaf' },
                { key: 'archived', label: t('dashboard.stageArchived'), days: avgStay.archived, color: 'bg-canopy' }
            ];

            const maxDays = Math.max(1, ...stages.map(s => s.days));

            return stages.map(st => {
                const pct = Math.max(5, Math.round((st.days / maxDays) * 100));
                return `
                    <div class="cursor-pointer group hover:bg-sand/60 p-1.5 rounded-xl transition-colors" onclick="Lexicon.Articles.setCategoryFilter('${st.key}')">
                        <div class="flex items-center justify-between text-xs mb-1">
                            <span class="font-medium text-soil group-hover:text-jungle transition-colors">${st.label}</span>
                            <span class="font-mono font-bold text-earth text-[11px]">${st.days} ${t('dashboard.days')}</span>
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
