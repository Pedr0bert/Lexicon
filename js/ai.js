/* ==========================================================================
   Lexicon - AI Librarian Subsystem (Local Ollama Agent)
   Autonomous Academic Agent for Research Workflows
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    const STORAGE_KEY_ENDPOINT = 'lexicon_ollama_endpoint';
    const STORAGE_KEY_ENDPOINT_CUSTOM = 'lexicon_ollama_endpoint_custom';
    const STORAGE_KEY_MODEL = 'lexicon_ollama_model';
    const DEFAULT_ENDPOINT = 'http://localhost:11434';
    const PROBE_TIMEOUT_MS = 2500;
    const GENERATION_TIMEOUT_MS = 5 * 60 * 1000;
    const RECHECK_INTERVAL_MS = 30 * 1000;
    // General-purpose instruction models are preferred over code / embedding models
    const MODEL_PREFERENCE = ['qwen3', 'qwen2.5', 'llama3', 'gemma3', 'gemma2', 'gemma', 'mistral', 'phi4', 'phi3', 'granite', 'deepseek-r1', 'llama'];
    const NON_CHAT_MODEL_RE = /(coder|code|embed|embedding|bge|nomic|minilm|whisper|llava|vision|clip)/i;
    const PLACEHOLDER_VALUES = /^(nome da cole[cç][aã]o|collection name|tag\d*|null|none|n\/a|undefined|termo central de busca ou vazio|core query term or empty)$/i;

    const U = () => window.Lexicon.Utils;
    const tr = (k, f, p) => U().tr(k, f, p);
    const esc = (s) => U().escapeHTML(s);
    const toast = (m, t) => window.Lexicon.UI.Toast.show(m, t);
    const isPt = () => !window.Lexicon.I18n || window.Lexicon.I18n.locale !== 'en-US';

    const safeGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
    const normEndpoint = (ep) => String(ep || '').trim().replace(/\/+$/, '');

    function apiUrl(endpoint, path) {
        const ep = normEndpoint(endpoint);
        return ep.endsWith('/api') ? `${ep}/${path}` : `${ep}/api/${path}`;
    }

    /** fetch with a timeout, optionally linked to an outer AbortSignal */
    async function fetchWithTimeout(url, init = {}, timeoutMs = PROBE_TIMEOUT_MS, outerSignal = null) {
        const controller = new AbortController();
        const onOuterAbort = () => controller.abort(outerSignal.reason || new DOMException('Aborted', 'AbortError'));
        if (outerSignal) {
            if (outerSignal.aborted) onOuterAbort();
            else outerSignal.addEventListener('abort', onOuterAbort, { once: true });
        }
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
        try {
            return await fetch(url, Object.assign({}, init, { signal: controller.signal }));
        } catch (err) {
            if (timedOut) {
                const e = new Error(`timeout after ${Math.round(timeoutMs / 1000)}s`);
                e.name = 'TimeoutError';
                throw e;
            }
            throw err;
        } finally {
            clearTimeout(timer);
            if (outerSignal) outerSignal.removeEventListener('abort', onOuterAbort);
        }
    }

    /** Remove ```markdown fences, <think> blocks and stray quotes around a model answer */
    function cleanModelText(text) {
        let s = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        const fence = s.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```\s*$/);
        if (fence) s = fence[1].trim();
        if (/^["“].*["”]$/s.test(s) && !s.slice(1, -1).includes('"')) s = s.slice(1, -1).trim();
        return s;
    }

    /** Parse a JSON object from model output (tolerates fences / prose around it) */
    function parseModelJson(raw) {
        const text = cleanModelText(raw);
        try {
            return JSON.parse(text);
        } catch (e) {
            const match = text.match(/\{[\s\S]*\}/);
            if (match) return JSON.parse(match[0]);
            throw new Error(tr('librarian.invalidJson', 'O modelo não retornou um JSON válido.'));
        }
    }

    const cleanLabel = (v, max) => String(v === null || v === undefined ? '' : v)
        .replace(/<[^>]*>/g, ' ')
        .replace(/[\u0000-\u001f<>{}\[\]`"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max);

    /** Wrap untrusted document text so the model treats it as data, not instructions */
    function fence(label, text, max) {
        const body = String(text || '').slice(0, max).replace(/<\/?documento>|<\/?document>/gi, '');
        return `${label}:\n<<<\n${body}\n>>>`;
    }

    function buildDocContext(article, opts = {}) {
        const pt = isPt();
        const L = pt
            ? { title: 'Título', authors: 'Autores', pub: 'Publicação', year: 'Ano', text: 'Texto extraído do documento (páginas iniciais)', summary: 'Resumo existente', notes: 'Anotações do pesquisador', file: 'Nome do arquivo', tags: 'Tags atuais', none: '(Nenhuma anotação prévia)' }
            : { title: 'Title', authors: 'Authors', pub: 'Publication', year: 'Year', text: 'Text extracted from the document (first pages)', summary: 'Existing summary', notes: 'Researcher notes', file: 'File name', tags: 'Current tags', none: '(No previous notes)' };
        const parts = [
            `${L.title}: "${cleanLabel(article.title, 400)}"`,
            article.authors ? `${L.authors}: ${cleanLabel(article.authors, 400)}` : '',
            article.publication ? `${L.pub}: ${cleanLabel(article.publication, 200)}` : '',
            article.year ? `${L.year}: ${article.year}` : ''
        ];
        if (opts.text && article.extractedText) parts.push(fence(L.text, article.extractedText, opts.textMax || 6000));
        if (opts.summary !== false && article.summary) parts.push(fence(L.summary, article.summary, 3000));
        if (opts.tags && Array.isArray(article.tags) && article.tags.length) parts.push(`${L.tags}: ${article.tags.map(t => cleanLabel(t, 40)).join(', ')}`);
        if (opts.notes) {
            const notes = opts.notesText !== undefined ? opts.notesText : article.notes;
            parts.push(fence(L.notes, notes || L.none, opts.notesMax || 6000));
        }
        if (opts.file && article.fileName) parts.push(`${L.file}: ${cleanLabel(article.fileName, 200)}`);
        return parts.filter(Boolean).join('\n');
    }

    /** Pick a context window big enough for the prompt (≈3 chars/token) */
    function contextSizeFor(prompt, numPredict) {
        const est = Math.ceil(String(prompt).length / 3) + (numPredict || 512) + 256;
        let ctx = 2048;
        while (ctx < est && ctx < 16384) ctx *= 2;
        return ctx;
    }

    function setBusyButton(btn, loadingText) {
        if (!btn) return () => {};
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        btn.innerHTML = `<i class="ph ph-spinner animate-spin text-xs" aria-hidden="true"></i> ${esc(loadingText)}`;
        return () => {
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            btn.innerHTML = original;
        };
    }

    const Librarian = {
        endpoint: DEFAULT_ENDPOINT,
        endpointIsCustom: false,
        selectedModel: '',
        isOnline: false,
        availableModels: [],
        lastFailureReason: '',
        lastCheckAt: 0,
        tasks: new Map(), // taskId -> { controller, scope }
        runningKeys: new Set(),

        get busy() {
            return this.tasks.size > 0;
        },

        async init() {
            if (this._initialized) return;
            this._initialized = true;

            const savedEndpoint = safeGet(STORAGE_KEY_ENDPOINT);
            const savedModel = safeGet(STORAGE_KEY_MODEL);
            this.endpointIsCustom = safeGet(STORAGE_KEY_ENDPOINT_CUSTOM) === '1';
            if (savedEndpoint) this.endpoint = normEndpoint(savedEndpoint);
            if (savedModel) this.selectedModel = savedModel.trim();

            // AI tasks belong to the dialog that started them
            const Modal = window.Lexicon.UI && window.Lexicon.UI.Modal;
            if (Modal && Modal.onClose) {
                Modal.onClose('inspector-modal', () => {
                    if (!(window.Lexicon.Reader && window.Lexicon.Reader.isOpen())) this.abortScope('inspector');
                });
                Modal.onClose('reader-split-modal', () => this.abortScope('reader'));
            }

            await this.checkConnection(false);
        },

        /**
         * Candidate endpoints in priority order. A user-configured endpoint is never
         * replaced automatically by a fallback.
         */
        getCandidateEndpoints() {
            const candidates = [];
            if (this.endpoint) candidates.push(normEndpoint(this.endpoint));
            if (this.endpointIsCustom) return candidates;

            if (window.location && /^https?:$/.test(window.location.protocol)) {
                candidates.push(`${window.location.origin}/ollama`);
            }
            candidates.push('http://localhost:11434', 'http://127.0.0.1:11434');
            return Array.from(new Set(candidates)).filter(Boolean);
        },

        /**
         * Query Ollama /api/tags on all candidates in parallel; pick the best one.
         * @param {boolean} notifyUser
         */
        async checkConnection(notifyUser = false) {
            this.lastCheckAt = Date.now();
            const candidates = this.getCandidateEndpoints();
            const isFileProtocol = window.location && window.location.protocol === 'file:';

            const results = await Promise.allSettled(candidates.map(async (ep) => {
                const res = await fetchWithTimeout(apiUrl(ep, 'tags'), { headers: { 'Accept': 'application/json' } }, PROBE_TIMEOUT_MS);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                return { ep, data };
            }));

            const winnerIdx = results.findIndex(r => r.status === 'fulfilled');
            const lastError = results.map(r => r.reason).filter(Boolean).pop();

            if (winnerIdx >= 0) {
                const { ep, data } = results[winnerIdx].value;
                this.availableModels = (Array.isArray(data.models) ? data.models : []).map(m => ({
                    name: String(m.name || m.model || ''),
                    size: m.size ? U().formatBytes(m.size) : '',
                    details: m.details || {}
                })).filter(m => m.name);
                this.isOnline = true;
                this.lastFailureReason = '';
                this.endpoint = ep;
                if (!this.endpointIsCustom) safeSet(STORAGE_KEY_ENDPOINT, ep);

                if (this.availableModels.length > 0 && !this.availableModels.some(m => m.name === this.selectedModel)) {
                    this.selectedModel = this.pickDefaultModel();
                    safeSet(STORAGE_KEY_MODEL, this.selectedModel);
                }

                if (notifyUser) {
                    toast(tr('librarian.connected', 'Ollama conectado ({count} modelos detectados)', { count: this.availableModels.length }), 'success');
                    if (!this.availableModels.length) {
                        toast(tr('librarian.noModelsHint', 'Nenhum modelo instalado. Rode por exemplo: ollama pull qwen2.5:3b'), 'warning');
                    }
                }
            } else {
                console.warn('[Librarian] Ollama endpoints unreachable. Last error:', lastError);
                this.isOnline = false;
                this.availableModels = [];
                if (isFileProtocol) this.lastFailureReason = 'file_protocol';
                else if (lastError && (/HTTP 403/.test(lastError.message) || lastError.name === 'TypeError')) this.lastFailureReason = 'cors_restriction';
                else this.lastFailureReason = 'service_down';

                if (notifyUser) {
                    toast(isFileProtocol
                        ? tr('librarian.fileProtocolNotice', 'Abra via http://localhost:8000 (execute ./start.sh) para permitir conexão local')
                        : tr('librarian.offline', 'Não foi possível conectar ao Ollama local'),
                    isFileProtocol ? 'warning' : 'error');
                }
            }

            this.updateBadgeUI();
            this.populateModelSelect();
            return this.isOnline;
        },

        pickDefaultModel() {
            const chatModels = this.availableModels.filter(m => !NON_CHAT_MODEL_RE.test(m.name));
            const pool = chatModels.length ? chatModels : this.availableModels;
            for (const pref of MODEL_PREFERENCE) {
                const found = pool.find(m => m.name.toLowerCase().startsWith(pref) || m.name.toLowerCase().includes(`/${pref}`));
                if (found) return found.name;
            }
            return pool[0] ? pool[0].name : '';
        },

        updateBadgeUI() {
            const badge = document.getElementById('librarian-header-badge');
            const statusDot = document.getElementById('librarian-status-dot');
            const modelNameEl = document.getElementById('librarian-model-name');
            const modalStatusEl = document.getElementById('librarian-modal-status');
            const isFileProtocol = window.location && window.location.protocol === 'file:';

            if (statusDot) {
                statusDot.className = `w-2 h-2 rounded-full shrink-0 ${this.isOnline ? 'bg-leaf animate-pulse' : 'bg-terracotta'}`;
            }

            if (modelNameEl) {
                const shortName = (this.selectedModel || 'Ollama').split(':')[0].replace(/^hf\.co\/[^\/]+\//, '');
                modelNameEl.textContent = this.isOnline ? shortName : tr('librarian.disconnected', 'Desconectado');
            }

            if (badge) {
                badge.title = this.isOnline
                    ? tr('librarian.activeTitle', 'Bibliotecário IA Ativo ({model}) - Clique para configurar', { model: this.selectedModel })
                    : tr('librarian.inactiveTitle', 'Bibliotecário IA Desconectado - Clique para ver diagnóstico');
                badge.setAttribute('aria-label', badge.title);
            }

            if (modalStatusEl) {
                if (this.isOnline) {
                    modalStatusEl.innerHTML = `
                        <div class="flex items-center gap-2 text-jungle font-semibold">
                            <span class="w-2.5 h-2.5 rounded-full bg-leaf animate-pulse" aria-hidden="true"></span>
                            <span>${esc(tr('librarian.statusConnected', 'Conectado ao Ollama em {endpoint} ({count} modelos prontos)', { endpoint: this.endpoint, count: this.availableModels.length }))}</span>
                        </div>
                    `;
                } else {
                    let hint = esc(tr('librarian.hintServe', 'Certifique-se de que o Ollama está rodando (ollama serve).'));
                    if (isFileProtocol) {
                        hint = `<strong class="text-terracotta">${esc(tr('librarian.hintFileTitle', 'Você está em file://.'))}</strong> ${esc(tr('librarian.hintFile', 'O navegador bloqueia conexões locais por segurança. Inicie com ./start.sh e acesse http://localhost:8000.'))}`;
                    } else if (this.lastFailureReason === 'cors_restriction') {
                        hint = esc(tr('librarian.hintCors', 'Bloqueio de CORS detectado no Ollama. Inicie via ./start.sh (que inclui proxy automático) ou configure OLLAMA_ORIGINS com a origem desta página.'));
                    }
                    modalStatusEl.innerHTML = `
                        <div class="space-y-1.5">
                            <div class="flex items-center gap-2 text-terracotta font-semibold">
                                <span class="w-2.5 h-2.5 rounded-full bg-terracotta shrink-0" aria-hidden="true"></span>
                                <span>${esc(tr('librarian.statusOffline', 'Ollama não conectado'))}</span>
                            </div>
                            <div class="text-[11px] text-earth/90 leading-relaxed bg-paper/90 p-2 rounded-lg border border-wood/60">${hint}</div>
                        </div>
                    `;
                }
            }
        },

        populateModelSelect() {
            const select = document.getElementById('librarian-model-select');
            if (!select) return;
            select.textContent = '';

            if (this.availableModels.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = tr('librarian.noModels', 'No models detected (Check Ollama connection)');
                select.appendChild(opt);
                return;
            }

            this.availableModels.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.name;
                opt.textContent = m.size ? `${m.name} (${m.size})` : m.name;
                if (NON_CHAT_MODEL_RE.test(m.name)) opt.textContent += ' ⚠';
                opt.selected = m.name === this.selectedModel;
                select.appendChild(opt);
            });
        },

        async saveSettings() {
            const endpointInput = document.getElementById('librarian-endpoint-input');
            const modelSelect = document.getElementById('librarian-model-select');

            if (endpointInput) {
                const value = normEndpoint(endpointInput.value);
                if (value) {
                    let ok = false;
                    try { ok = /^https?:$/.test(new URL(value).protocol); } catch (e) { ok = false; }
                    if (!ok) {
                        toast(tr('librarian.invalidEndpoint', 'Endpoint inválido. Use por exemplo http://localhost:11434'), 'error');
                        return;
                    }
                    if (value !== this.endpoint) {
                        this.endpoint = value;
                        this.endpointIsCustom = value !== DEFAULT_ENDPOINT;
                    }
                } else {
                    this.endpoint = DEFAULT_ENDPOINT;
                    this.endpointIsCustom = false;
                }
                safeSet(STORAGE_KEY_ENDPOINT, this.endpoint);
                safeSet(STORAGE_KEY_ENDPOINT_CUSTOM, this.endpointIsCustom ? '1' : '0');
            }

            if (modelSelect && modelSelect.value) {
                this.selectedModel = modelSelect.value;
                safeSet(STORAGE_KEY_MODEL, this.selectedModel);
            }

            await this.checkConnection(true);
            window.Lexicon.UI.Modal.close('librarian-settings-modal');
        },

        openSettingsModal(initialTab = 'ai') {
            if (window.Lexicon.App && typeof window.Lexicon.App.openSettingsModal === 'function') {
                window.Lexicon.App.openSettingsModal(initialTab);
            }
        },

        /** Abort every task started from a given scope ('inspector', 'reader', 'search') */
        abortScope(scope) {
            for (const [taskId, task] of this.tasks.entries()) {
                if (task.scope === scope) {
                    task.controller.abort();
                    this.tasks.delete(taskId);
                }
            }
        },

        abortGeneration(taskId) {
            const task = this.tasks.get(taskId);
            if (task) {
                task.controller.abort();
                this.tasks.delete(taskId);
            }
        },

        abortAll() {
            for (const task of this.tasks.values()) task.controller.abort();
            this.tasks.clear();
        },

        /**
         * Core generation call to Ollama
         * @param {string} prompt
         * @param {{format?: 'json', temperature?: number, num_predict?: number, system?: string, scope?: string}} options
         * @returns {Promise<string>}
         */
        async callOllama(prompt, options = {}) {
            if (!this.isOnline) {
                // Re-probe at most every RECHECK_INTERVAL_MS to avoid long waits on every action
                const online = (Date.now() - this.lastCheckAt > RECHECK_INTERVAL_MS) ? await this.checkConnection(false) : false;
                if (!online) {
                    throw new Error(tr('librarian.unreachable', 'Ollama não está acessível em {endpoint}. Verifique se ele está rodando.', { endpoint: this.endpoint }));
                }
            }
            if (!this.selectedModel) {
                throw new Error(tr('librarian.noModelSelected', 'Nenhum modelo selecionado. Instale um modelo (ex.: ollama pull qwen2.5:3b) e escolha-o nas configurações.'));
            }

            const taskId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `task_${Date.now()}_${Math.random()}`;
            const controller = new AbortController();
            this.tasks.set(taskId, { controller, scope: options.scope || 'global' });

            const numPredict = options.num_predict || 1024;
            const payload = {
                model: this.selectedModel,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: options.temperature !== undefined ? options.temperature : 0.2,
                    num_predict: numPredict,
                    num_ctx: contextSizeFor((options.system || '') + prompt, numPredict)
                }
            };
            if (options.system) payload.system = options.system;
            if (options.format === 'json') payload.format = 'json';

            try {
                const response = await fetchWithTimeout(apiUrl(this.endpoint, 'generate'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }, GENERATION_TIMEOUT_MS, controller.signal);

                if (!response.ok) {
                    const errText = await response.text().catch(() => '');
                    let detail = errText;
                    try { detail = JSON.parse(errText).error || errText; } catch (e) { /* plain text */ }
                    if (response.status === 404 && /model/i.test(detail)) {
                        this.isOnline = false;
                        this.lastCheckAt = 0;
                    }
                    throw new Error(tr('librarian.httpError', 'Erro do Ollama ({status}): {detail}', { status: response.status, detail: String(detail || response.statusText).slice(0, 300) }));
                }

                const data = await response.json();
                return cleanModelText(data.response || '');
            } catch (err) {
                if (err.name === 'AbortError') {
                    const e = new Error(tr('librarian.cancelled', 'Geração cancelada.'));
                    e.cancelled = true;
                    throw e;
                }
                if (err.name === 'TimeoutError') {
                    throw new Error(tr('librarian.timeout', 'O modelo demorou demais para responder. Tente um modelo menor.'));
                }
                if (err.name === 'TypeError') {
                    this.isOnline = false;
                    this.updateBadgeUI();
                }
                throw err;
            } finally {
                this.tasks.delete(taskId);
            }
        },

        /** Context of the action: reader (if open for this doc) or inspector */
        _context() {
            const Reader = window.Lexicon.Reader;
            const state = window.Lexicon.State;
            if (Reader && Reader.isOpen()) {
                return { scope: 'reader', articleId: Reader.getCurrentArticleId(), notesEl: document.getElementById('split-reader-notes'), summaryEl: document.getElementById('split-reader-summary') };
            }
            return { scope: 'inspector', articleId: state.inspectedArticleId, notesEl: document.getElementById('inspector-notes'), summaryEl: document.getElementById('inspector-summary') };
        },

        /** Is the given article still displayed in the given scope? */
        _stillShowing(scope, articleId) {
            const Reader = window.Lexicon.Reader;
            if (scope === 'reader') return !!(Reader && Reader.isOpen() && Reader.getCurrentArticleId() === articleId);
            const Modal = window.Lexicon.UI.Modal;
            return window.Lexicon.State.inspectedArticleId === articleId && Modal.isOpen('inspector-modal');
        },

        _guard(key) {
            if (this.runningKeys.has(key)) {
                toast(tr('librarian.alreadyRunning', 'O Bibliotecário IA já está trabalhando neste documento.'), 'info');
                return false;
            }
            this.runningKeys.add(key);
            return true;
        },

        _reportError(prefixKey, prefixFallback, err) {
            if (err && err.cancelled) return;
            console.error(`[Librarian] ${prefixKey}`, err);
            toast(tr(prefixKey, prefixFallback, { error: err.message }), 'error');
        },

        /* =====================================================================
           TASK 1: Academic executive summary
           ===================================================================== */
        async summarizeCurrentDocument() {
            const state = window.Lexicon.State;
            const ctx = this._context();
            const article = state.articles.find(a => a.id === ctx.articleId);
            if (!article) {
                toast(tr('librarian.noDocSelected', 'No document selected for inspection'), 'error');
                return;
            }
            const key = `summary:${article.id}`;
            if (!this._guard(key)) return;

            const btns = Array.from(document.querySelectorAll('[data-ai-action="summarize"], #btn-ai-summarize'));
            const restores = btns.map(b => setBusyButton(b, tr('inspector.aiSummarizing', 'Resumindo...')));

            try {
                if (!article.extractedText && window.Lexicon.PDFExtractor) {
                    try {
                        await window.Lexicon.PDFExtractor.extractTextForArticle(article);
                    } catch (e) {
                        console.warn('[Librarian] On-the-fly PDF extraction error:', e);
                    }
                }

                const docContext = buildDocContext(article, { text: true, textMax: 6000, notes: !!article.notes, notesMax: 2000, file: true });
                const prompt = window.Lexicon.I18n
                    ? window.Lexicon.I18n.getPrompt('summarize', { docContext })
                    : `Summarize this document in 2-3 sentences.\n\n${docContext}`;

                const summary = await this.callOllama(prompt, { temperature: 0.3, num_predict: 400, scope: ctx.scope });
                if (!summary) throw new Error(tr('librarian.emptyResponse', 'Modelo retornou resposta vazia.'));

                const current = state.articles.find(a => a.id === article.id);
                if (!current) return; // deleted meanwhile
                current.summary = summary;
                await window.Lexicon.Storage.save();

                if (this._stillShowing(ctx.scope, article.id) && ctx.summaryEl) ctx.summaryEl.value = summary;
                // Keep the other view in sync if it shows the same article
                const otherSummary = ctx.scope === 'reader' ? document.getElementById('inspector-summary') : document.getElementById('split-reader-summary');
                if (otherSummary && ((ctx.scope === 'reader' && state.inspectedArticleId === article.id) ||
                    (ctx.scope === 'inspector' && window.Lexicon.Reader && window.Lexicon.Reader.getCurrentArticleId() === article.id))) {
                    otherSummary.value = summary;
                }
                window.Lexicon.Articles.render();
                toast(tr('librarian.summarizeSuccess', 'Resumo executivo acadêmico gerado com sucesso!'), 'success');
            } catch (err) {
                this._reportError('librarian.summarizeError', 'Erro ao gerar resumo: {error}', err);
            } finally {
                this.runningKeys.delete(key);
                restores.forEach(r => r());
            }
        },

        /* =====================================================================
           TASK 2: Auto-tagging and collection suggestion
           ===================================================================== */
        async suggestTagsAndCollectionCurrentDocument() {
            const state = window.Lexicon.State;
            const ctx = this._context();
            const article = state.articles.find(a => a.id === ctx.articleId);
            if (!article) {
                toast(tr('librarian.noDocSelected', 'No document selected for inspection'), 'error');
                return;
            }
            const key = `tags:${article.id}`;
            if (!this._guard(key)) return;

            const restore = setBusyButton(document.getElementById('btn-ai-tag-collection'), tr('inspector.aiClassifying', 'Classificando...'));

            try {
                const existingCollections = state.collections.map(c => c.name);
                const tagCounts = new Map();
                state.articles.forEach(a => (a.tags || []).forEach(t => {
                    if (typeof t !== 'string') return;
                    tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
                }));
                const existingTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 40);
                const docContext = buildDocContext(article, { text: !!article.extractedText, textMax: 2500, notes: !!article.notes, notesMax: 1500, tags: true });

                const prompt = window.Lexicon.I18n
                    ? window.Lexicon.I18n.getPrompt('tagAndCollection', { collections: existingCollections, tags: existingTags, docContext })
                    : `Return JSON {"collection": "", "isNewCollection": false, "tags": [], "reason": ""}\n${docContext}`;

                const rawJson = await this.callOllama(prompt, { format: 'json', temperature: 0.1, num_predict: 400, scope: ctx.scope });
                const parsed = parseModelJson(rawJson);

                const current = state.articles.find(a => a.id === article.id);
                if (!current) return;

                // --- Tags: sanitize, dedupe case-insensitively, reuse existing casing ---
                const existingByLower = new Map();
                tagCounts.forEach((_, t) => { if (!existingByLower.has(t.toLowerCase())) existingByLower.set(t.toLowerCase(), t); });
                const currentLower = new Set((current.tags || []).map(t => String(t).toLowerCase()));
                let addedCount = 0;
                current.tags = current.tags || [];
                (Array.isArray(parsed.tags) ? parsed.tags : []).slice(0, 6).forEach(rawTag => {
                    let tag = cleanLabel(rawTag, 40).replace(/^#+/, '');
                    if (!tag || PLACEHOLDER_VALUES.test(tag)) return;
                    tag = existingByLower.get(tag.toLowerCase()) || tag.toLowerCase();
                    if (currentLower.has(tag.toLowerCase())) return;
                    current.tags.push(tag);
                    currentLower.add(tag.toLowerCase());
                    addedCount++;
                });

                // --- Collection: only existing names are applied silently ---
                let suggested = cleanLabel(parsed.collection, 60);
                if (PLACEHOLDER_VALUES.test(suggested)) suggested = '';
                let targetCol = current.collection;
                if (suggested) {
                    const existingCol = window.Lexicon.Collections.findByName(suggested);
                    if (existingCol) {
                        targetCol = existingCol.name;
                    } else if (window.confirm(tr('librarian.confirmNewCollection',
                        'O Bibliotecário IA sugeriu uma nova coleção: "{name}".\nCriar esta coleção e mover o documento para ela?', { name: suggested }))) {
                        targetCol = window.Lexicon.Collections.getOrCreate(suggested, { silent: true }).name;
                    }
                }
                current.collection = targetCol || null;

                await window.Lexicon.Storage.save();
                window.Lexicon.Collections.render();
                window.Lexicon.Collections.populateSelects();
                window.Lexicon.Articles.render();

                if (this._stillShowing(ctx.scope, current.id)) {
                    if (ctx.scope === 'inspector') {
                        window.Lexicon.Articles.renderInspectorTags(current.tags);
                        window.Lexicon.Collections.fillSelect(document.getElementById('inspector-collection'), current.collection || '');
                    } else {
                        window.Lexicon.Collections.fillSelect(document.getElementById('split-collection-select'), current.collection || '',
                            { noneLabel: tr('reader.noCollection', '(Sem Coleção)') });
                    }
                }

                const reason = cleanLabel(parsed.reasoning || parsed.reason || '', 200);
                const colName = current.collection || tr('folders.unfiled', 'Geral');
                toast(tr('librarian.classifySuccess', 'Bibliotecário: +{count} tags atribuídas e classificado em "{collection}"', { count: addedCount, collection: colName }) +
                    (reason ? ` (${reason})` : ''), 'success');
            } catch (err) {
                this._reportError('librarian.classifyError', 'Erro ao sugerir tags/coleção: {error}', err);
            } finally {
                this.runningKeys.delete(key);
                restore();
            }
        },

        /* =====================================================================
           TASK 3: Structured reading notes (Markdown)
           ===================================================================== */
        async structureCurrentNotes() {
            const state = window.Lexicon.State;
            const ctx = this._context();
            const article = state.articles.find(a => a.id === ctx.articleId);
            if (!article) {
                toast(tr('librarian.noDocSelected', 'No document selected for inspection'), 'error');
                return;
            }
            const key = `notes:${article.id}`;
            if (!this._guard(key)) return;

            const notesEl = ctx.notesEl;
            const currentNotes = (notesEl ? notesEl.value : (article.notes || '')).trim();
            const btns = Array.from(document.querySelectorAll('#btn-ai-structure-notes, [data-ai-action="structure"]'));
            const restores = btns.map(b => setBusyButton(b, tr('inspector.aiStructuring', 'Estruturando...')));

            try {
                const docContext = buildDocContext(article, { text: !!article.extractedText, textMax: 3000, notes: true, notesText: currentNotes, notesMax: 8000 });
                const prompt = window.Lexicon.I18n
                    ? window.Lexicon.I18n.getPrompt('structureNotes', { docContext })
                    : `Structure these notes in Markdown.\n\n${docContext}`;

                const structured = await this.callOllama(prompt, { temperature: 0.3, num_predict: 1500, scope: ctx.scope });
                if (!structured) throw new Error(tr('librarian.emptyResponse', 'Modelo retornou resposta vazia.'));

                const current = state.articles.find(a => a.id === article.id);
                if (!current) return;

                // Never silently destroy the researcher's own notes
                const latestNotes = (this._stillShowing(ctx.scope, current.id) && notesEl ? notesEl.value : current.notes || '').trim();
                if (latestNotes && !window.confirm(tr('librarian.confirmReplaceNotes',
                    'Substituir suas anotações atuais pela versão estruturada pela IA?\nSuas anotações originais serão preservadas ao final, em "Anotações originais".'))) {
                    return;
                }
                const originalHeading = tr('librarian.originalNotesHeading', 'Anotações originais');
                const finalNotes = latestNotes
                    ? `${structured}\n\n---\n\n<details>\n<summary>${originalHeading}</summary>\n\n${latestNotes}\n\n</details>\n`
                    : structured;

                current.notes = finalNotes;
                await window.Lexicon.Storage.save();
                if (this._stillShowing(ctx.scope, current.id) && notesEl) {
                    notesEl.value = finalNotes;
                }
                if (ctx.scope === 'reader' && window.Lexicon.Reader) window.Lexicon.Reader.renderBacklinks();
                toast(tr('librarian.structureSuccess', 'Notas estruturadas no padrão de Fichamento Acadêmico!'), 'success');
            } catch (err) {
                this._reportError('librarian.structureError', 'Erro ao estruturar notas: {error}', err);
            } finally {
                this.runningKeys.delete(key);
                restores.forEach(r => r());
            }
        },

        /* =====================================================================
           TASK 4: Semantic catalog search
           ===================================================================== */
        async executeSemanticSearch(overrideQuery) {
            const searchInput = document.getElementById('search-input');
            const query = String(overrideQuery !== undefined ? overrideQuery : (searchInput ? searchInput.value : '')).trim();
            const state = window.Lexicon.State;

            if (!query) {
                if (state.semanticFilter) this.clearSemanticFilter();
                return;
            }

            const applyTextSearch = () => {
                if (window.Lexicon.Navigation) window.Lexicon.Navigation.recordNavigation();
                state.semanticFilter = null;
                state.searchQuery = query;
                window.Lexicon.Articles.render();
            };

            // Offline: don't make the user wait for probes — plain text search right away
            if (!this.isOnline && Date.now() - this.lastCheckAt < RECHECK_INTERVAL_MS) {
                applyTextSearch();
                toast(tr('librarian.offlineTextSearch', 'Bibliotecário IA offline: usando busca por texto.'), 'info');
                return;
            }

            if (!this._guard('search')) return;
            this.abortScope('search');
            const searchBtn = document.getElementById('btn-ai-search');
            const restore = setBusyButton(searchBtn, '');

            try {
                const existingCollections = state.collections.map(c => c.name);
                const tagCounts = new Map();
                state.articles.forEach(a => (a.tags || []).forEach(t => { if (typeof t === 'string') tagCounts.set(t, (tagCounts.get(t) || 0) + 1); }));
                const existingTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 60);
                const existingYears = Array.from(new Set(state.articles.map(a => a.year).filter(Boolean))).sort((a, b) => b - a);

                const prompt = window.Lexicon.I18n
                    ? window.Lexicon.I18n.getPrompt('semanticSearch', { query: cleanLabel(query, 300), collections: existingCollections, tags: existingTags, years: existingYears })
                    : `Return JSON filters for: ${query}`;

                const rawJson = await this.callOllama(prompt, { format: 'json', temperature: 0.1, num_predict: 300, scope: 'search' });
                const parsed = parseModelJson(rawJson);

                // --- Validate every field against what actually exists ---
                const yearNum = parseInt(parsed.year, 10);
                const yearMentioned = Number.isFinite(yearNum) && new RegExp(`\\b${yearNum}\\b`).test(query);
                const status = ['inbox', 'reading', 'processing', 'archived', 'favorites', 'recent'].includes(parsed.status) ? parsed.status : null;
                const colRaw = cleanLabel(parsed.collection, 80);
                const col = colRaw && !PLACEHOLDER_VALUES.test(colRaw)
                    ? (window.Lexicon.Collections.findByName(colRaw) ||
                       state.collections.find(c => U().fold(c.name).includes(U().fold(colRaw))) || null)
                    : null;
                const tagRaw = cleanLabel(parsed.tag, 40).replace(/^#/, '');
                const tag = tagRaw && !PLACEHOLDER_VALUES.test(tagRaw)
                    ? (Array.from(tagCounts.keys()).find(t => t.toLowerCase() === tagRaw.toLowerCase()) || null)
                    : null;
                let textQuery = cleanLabel(parsed.textQuery, 120);
                if (PLACEHOLDER_VALUES.test(textQuery)) textQuery = '';

                // Record history BEFORE changing the view
                if (window.Lexicon.Navigation) window.Lexicon.Navigation.recordNavigation();

                state.semanticFilter = {
                    originalQuery: query,
                    textQuery,
                    year: yearMentioned ? yearNum : null,
                    status,
                    collection: col ? col.name : null,
                    tag,
                    explanation: cleanLabel(parsed.explanation, 200) || tr('librarian.semanticDefaultExplanation', 'Filtro semântico aplicado pelo Bibliotecário IA')
                };
                // Nothing usable came back -> fall back to the literal query
                const sf = state.semanticFilter;
                if (!sf.textQuery && !sf.year && !sf.status && !sf.collection && !sf.tag) sf.textQuery = query;

                state.searchQuery = '';
                window.Lexicon.Articles.render();
                toast(tr('librarian.semanticApplied', '🤖 Bibliotecário IA: {explanation}', { explanation: sf.explanation }), 'info');
            } catch (err) {
                if (!err.cancelled) {
                    this._reportError('librarian.semanticError', 'Erro na busca semântica: {error}', err);
                    applyTextSearch();
                }
            } finally {
                this.runningKeys.delete('search');
                restore();
            }
        },

        clearSemanticFilter() {
            this.abortScope('search');
            const state = window.Lexicon.State;
            if (window.Lexicon.Navigation) window.Lexicon.Navigation.recordNavigation();
            state.semanticFilter = null;
            state.searchQuery = '';

            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.value = '';

            window.Lexicon.Articles.render();
            toast(tr('librarian.semanticCleared', 'Filtro semântico removido'), 'info');
        },

        formatBytes(bytes) {
            return U().formatBytes(bytes);
        }
    };

    window.Lexicon.Librarian = Librarian;
})();
