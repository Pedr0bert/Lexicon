/* ==========================================================================
   Lexicon - AI Librarian Subsystem (Local Ollama Agent)
   Autonomous Academic Agent for Research Workflows
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    const STORAGE_KEY_ENDPOINT = 'lexicon_ollama_endpoint';
    const STORAGE_KEY_MODEL = 'lexicon_ollama_model';
    const DEFAULT_ENDPOINT = 'http://localhost:11434';
    const DEFAULT_MODEL = 'qwen2.5-coder:1.5b';

    const Librarian = {
        endpoint: DEFAULT_ENDPOINT,
        selectedModel: DEFAULT_MODEL,
        isOnline: false,
        availableModels: [],
        busy: false,
        abortControllers: new Map(),

        /**
         * Initialize the AI Librarian module
         */
        async init() {
            // Restore persistent settings
            const savedEndpoint = localStorage.getItem(STORAGE_KEY_ENDPOINT);
            const savedModel = localStorage.getItem(STORAGE_KEY_MODEL);

            if (savedEndpoint) this.endpoint = savedEndpoint.trim().replace(/\/+$/, '');
            if (savedModel) this.selectedModel = savedModel.trim();

            const state = window.Lexicon.State;
            if (state) {
                state.librarian = {
                    endpoint: this.endpoint,
                    selectedModel: this.selectedModel,
                    isOnline: false,
                    availableModels: [],
                    busy: false
                };
            }

            // Perform initial health check and model discovery
            await this.checkConnection(false);
            this.updateBadgeUI();
        },

        /**
         * Get list of candidate endpoints to probe in priority order
         */
        getCandidateEndpoints() {
            const candidates = [];
            if (this.endpoint) candidates.push(this.endpoint.trim().replace(/\/+$/, ''));

            // If running on an HTTP server (e.g. localhost:8000), prioritize local proxy
            if (window.location && window.location.protocol && window.location.protocol.startsWith('http')) {
                candidates.push(`${window.location.origin}/ollama`);
                candidates.push(`${window.location.origin}`);
            }

            // Common default addresses
            candidates.push('http://localhost:11434');
            candidates.push('http://127.0.0.1:11434');
            candidates.push('http://localhost:8000/ollama');
            candidates.push('http://127.0.0.1:8000/ollama');

            // Return unique non-empty candidates
            return Array.from(new Set(candidates)).filter(Boolean);
        },

        /**
         * Query Ollama local tags to discover available models and health
         * @param {boolean} notifyUser - Whether to display toast notification
         */
        async checkConnection(notifyUser = false) {
            const candidates = this.getCandidateEndpoints();
            let successEndpoint = null;
            let lastError = null;
            let failureReason = '';

            const isFileProtocol = window.location && window.location.protocol === 'file:';

            for (const ep of candidates) {
                try {
                    const normalized = ep.replace(/\/+$/, '');
                    const testUrl = normalized.endsWith('/api') ? `${normalized}/tags` : `${normalized}/api/tags`;

                    const response = await fetch(testUrl, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        this.availableModels = (data.models || []).map(m => ({
                            name: m.name || m.model,
                            size: m.size ? this.formatBytes(m.size) : '',
                            details: m.details || {}
                        }));
                        successEndpoint = normalized;
                        break;
                    } else {
                        lastError = new Error(`HTTP ${response.status} from ${testUrl}`);
                    }
                } catch (err) {
                    lastError = err;
                }
            }

            if (successEndpoint) {
                this.isOnline = true;
                this.endpoint = successEndpoint;
                localStorage.setItem(STORAGE_KEY_ENDPOINT, this.endpoint);

                // If currently selected model is not installed, pick a sensible default
                if (this.availableModels.length > 0) {
                    const hasSelected = this.availableModels.some(m => m.name === this.selectedModel);
                    if (!hasSelected) {
                        const preferred = this.availableModels.find(m => 
                            m.name.includes('qwen') || m.name.includes('gemma') || m.name.includes('llama') || m.name.includes('coder')
                        );
                        this.selectedModel = preferred ? preferred.name : this.availableModels[0].name;
                        localStorage.setItem(STORAGE_KEY_MODEL, this.selectedModel);
                    }
                }

                const state = window.Lexicon.State;
                if (state && state.librarian) {
                    state.librarian.isOnline = true;
                    state.librarian.endpoint = this.endpoint;
                    state.librarian.availableModels = this.availableModels;
                    state.librarian.selectedModel = this.selectedModel;
                }

                if (notifyUser) {
                    const msg = window.Lexicon.I18n
                        ? window.Lexicon.I18n.t('librarian.connected', { count: this.availableModels.length })
                        : `Ollama conectado (${this.availableModels.length} modelos detectados)`;
                    window.Lexicon.UI.Toast.show(msg, 'success');
                }
            } else {
                console.warn('[Librarian] All Ollama endpoints failed. Last error:', lastError);
                this.isOnline = false;
                this.availableModels = [];

                if (isFileProtocol) {
                    failureReason = 'file_protocol';
                } else if (lastError && (lastError.message.includes('403') || lastError.name === 'TypeError')) {
                    failureReason = 'cors_restriction';
                } else {
                    failureReason = 'service_down';
                }

                this.lastFailureReason = failureReason;

                const state = window.Lexicon.State;
                if (state && state.librarian) {
                    state.librarian.isOnline = false;
                    state.librarian.availableModels = [];
                }

                if (notifyUser) {
                    if (isFileProtocol) {
                        const msg = window.Lexicon.I18n
                            ? window.Lexicon.I18n.t('librarian.fileProtocolNotice')
                            : 'Abra via http://localhost:8000 (execute ./start.sh) para permitir conexão local';
                        window.Lexicon.UI.Toast.show(msg, 'warning');
                    } else {
                        const msg = window.Lexicon.I18n
                            ? window.Lexicon.I18n.t('librarian.offline')
                            : 'Não foi possível conectar ao Ollama local';
                        window.Lexicon.UI.Toast.show(msg, 'error');
                    }
                }
            }

            this.updateBadgeUI();
            this.populateModelSelect();
            return this.isOnline;
        },

        /**
         * Update UI indicators (Header badge, modal status, etc.)
         */
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
                const shortName = this.selectedModel.split(':')[0].replace(/^hf\.co\/[^\/]+\//, '');
                modelNameEl.textContent = this.isOnline 
                    ? shortName 
                    : (window.Lexicon.I18n ? window.Lexicon.I18n.t('librarian.disconnected') : 'Desconectado');
            }

            if (badge) {
                badge.title = this.isOnline 
                    ? (window.Lexicon.I18n ? window.Lexicon.I18n.t('librarian.activeTitle', { model: this.selectedModel }) : `Bibliotecário IA Ativo (${this.selectedModel}) - Clique para configurar`)
                    : (window.Lexicon.I18n ? window.Lexicon.I18n.t('librarian.inactiveTitle') : `Bibliotecário IA Desconectado - Clique para ver diagnóstico`);
            }

            if (modalStatusEl) {
                if (this.isOnline) {
                    modalStatusEl.innerHTML = `
                        <div class="flex items-center gap-2 text-jungle font-semibold">
                            <span class="w-2.5 h-2.5 rounded-full bg-leaf animate-pulse"></span>
                            <span>Conectado ao Ollama em <code>${this.endpoint}</code> (${this.availableModels.length} modelos prontos)</span>
                        </div>
                    `;
                } else {
                    let hint = 'Certifique-se de que o Ollama está rodando (<code>ollama serve</code>).';
                    if (isFileProtocol) {
                        hint = '<strong class="text-terracotta">Você está em file://.</strong> O navegador bloqueia conexões locais por segurança. Inicie com <code>./start.sh</code> no terminal e acesse <a href="http://localhost:8000" class="underline font-semibold" target="_blank">http://localhost:8000</a>.';
                    } else if (this.lastFailureReason === 'cors_restriction') {
                        hint = 'Bloqueio de CORS detectado no Ollama. Inicie via <code>./start.sh</code> (que inclui proxy automático) ou configure <code>OLLAMA_ORIGINS="*"</code> no Ollama.';
                    }

                    modalStatusEl.innerHTML = `
                        <div class="space-y-1.5">
                            <div class="flex items-center gap-2 text-terracotta font-semibold">
                                <span class="w-2.5 h-2.5 rounded-full bg-terracotta shrink-0"></span>
                                <span>Ollama não conectado</span>
                            </div>
                            <div class="text-[11px] text-earth/90 leading-relaxed bg-paper/90 p-2 rounded-lg border border-wood/60">
                                ${hint}
                            </div>
                        </div>
                    `;
                }
            }
        },

        /**
         * Populate the model selection dropdown in the settings modal
         */
        populateModelSelect() {
            const select = document.getElementById('librarian-model-select');
            if (!select) return;

            if (this.availableModels.length === 0) {
                const noModelsText = window.Lexicon.I18n 
                    ? window.Lexicon.I18n.t('librarian.noModels')
                    : 'No models detected (Check Ollama connection)';
                select.innerHTML = `<option value="">${noModelsText}</option>`;
                return;
            }

            select.innerHTML = this.availableModels.map(m => {
                const isSelected = m.name === this.selectedModel ? 'selected' : '';
                const sizeTag = m.size ? ` (${m.size})` : '';
                return `<option value="${m.name}" ${isSelected}>${m.name}${sizeTag}</option>`;
            }).join('');
        },

        /**
         * Save configured settings from modal
         */
        async saveSettings() {
            const endpointInput = document.getElementById('librarian-endpoint-input');
            const modelSelect = document.getElementById('librarian-model-select');

            if (endpointInput && endpointInput.value.trim()) {
                this.endpoint = endpointInput.value.trim().replace(/\/+$/, '');
                localStorage.setItem(STORAGE_KEY_ENDPOINT, this.endpoint);
            }

            if (modelSelect && modelSelect.value) {
                this.selectedModel = modelSelect.value;
                localStorage.setItem(STORAGE_KEY_MODEL, this.selectedModel);
            }

            await this.checkConnection(true);
            window.Lexicon.UI.Modal.close('librarian-settings-modal');
        },

        /**
         * Open Settings Modal
         */
        openSettingsModal(initialTab = 'ai') {
            if (window.Lexicon.App && typeof window.Lexicon.App.openSettingsModal === 'function') {
                window.Lexicon.App.openSettingsModal(initialTab);
            } else {
                const endpointInput = document.getElementById('librarian-endpoint-input');
                if (endpointInput) endpointInput.value = this.endpoint;
                this.populateModelSelect();
                this.updateBadgeUI();
                window.Lexicon.UI.Modal.open('librarian-settings-modal');
            }
        },
        /**
         * Abort a specific ongoing generation
         */
        abortGeneration(taskId) {
            if (this.abortControllers.has(taskId)) {
                this.abortControllers.get(taskId).abort();
                this.abortControllers.delete(taskId);
                console.log(`Aborted AI generation task: ${taskId}`);
            }
        },

        /**
         * Abort all ongoing generations
         */
        abortAll() {
            for (const [taskId, controller] of this.abortControllers.entries()) {
                controller.abort();
                console.log(`Aborted AI generation task: ${taskId}`);
            }
            this.abortControllers.clear();
            this.busy = false;
        },

        /**
         * Core generation caller to Ollama
         * @param {string} prompt
         * @param {object} options - { format: 'json', temperature: 0.2, system: '' }
         * @returns {Promise<string>}
         */
        async callOllama(prompt, options = {}) {
            if (!this.isOnline) {
                const online = await this.checkConnection(false);
                if (!online) {
                    throw new Error(`Ollama is not reachable at ${this.endpoint}. Please make sure Ollama is running.`);
                }
            }

            const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const controller = new AbortController();
            this.abortControllers.set(taskId, controller);

            const payload = {
                model: this.selectedModel,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: options.temperature !== undefined ? options.temperature : 0.2,
                    num_predict: options.num_predict || 1024
                }
            };

            if (options.system) {
                payload.system = options.system;
            }

            if (options.format === 'json') {
                payload.format = 'json';
            }

            const ep = this.endpoint.replace(/\/+$/, '');
            const generateUrl = ep.endsWith('/api') ? `${ep}/generate` : `${ep}/api/generate`;

            try {
                const response = await fetch(generateUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                if (!response.ok) {
                    const errText = await response.text().catch(() => '');
                    throw new Error(`Ollama generation error (${response.status}): ${errText || response.statusText}`);
                }

                const data = await response.json();
                return (data.response || '').trim();
            } catch (err) {
                if (err.name === 'AbortError') {
                    throw new Error('Geração cancelada pelo usuário.');
                }
                throw err;
            } finally {
                this.abortControllers.delete(taskId);
            }
        },

        /* =====================================================================
           TASK 1: Auto-Preenchimento e Resumo Inteligente (Document Inspector)
           ===================================================================== */
        /**
         * Generate a 2-3 sentence academic executive summary and fill #inspector-summary
         */
        async summarizeCurrentDocument() {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article) {
                const msg = window.Lexicon.I18n ? window.Lexicon.I18n.t('librarian.noDocSelected') : 'No document selected for inspection';
                window.Lexicon.UI.Toast.show(msg, 'error');
                return;
            }

            const summaryEl = document.getElementById('inspector-summary');
            const btn = document.getElementById('btn-ai-summarize');
            const originalBtnHtml = btn ? btn.innerHTML : '';

            // Set loading state
            if (btn) {
                btn.disabled = true;
                const loadingText = window.Lexicon.I18n ? window.Lexicon.I18n.t('inspector.aiSummarizing') : 'Resumindo...';
                btn.innerHTML = `<i class="ph ph-spinner animate-spin text-xs"></i> ${loadingText}`;
            }

            // If extracted text from PDF is not cached yet, try extracting from stored file in IndexedDB
            if (!article.extractedText && window.Lexicon.PDFExtractor) {
                try {
                    await window.Lexicon.PDFExtractor.extractTextForArticle(article);
                } catch (e) {
                    console.warn('[Librarian] On-the-fly PDF extraction error:', e);
                }
            }

            try {
                const docContext = [
                    `Título: "${article.title || 'Sem título'}"`,
                    article.authors ? `Autores: ${article.authors}` : '',
                    article.publication ? `Publicação: ${article.publication}` : '',
                    article.year ? `Ano: ${article.year}` : '',
                    article.extractedText ? `Texto Real Extraído do Documento (Páginas Iniciais / Abstract):\n${article.extractedText.slice(0, 3500)}` : '',
                    article.summary ? `Resumo Preliminar / Texto Existente:\n${article.summary}` : '',
                    article.notes ? `Notas Existentes:\n${article.notes}` : '',
                    article.fileName ? `Nome do Arquivo: ${article.fileName}` : ''
                ].filter(Boolean).join('\n');

                const prompt = window.Lexicon.I18n
                    ? window.Lexicon.I18n.getPrompt('summarize', { docContext })
                    : `Você é um bibliotecário acadêmico sênior do Lexicon. Com base nas informações do documento a seguir, gere um resumo executivo acadêmico estritamente entre 2 e 3 frases.\n\nDados do Documento:\n${docContext}`;

                const summary = await this.callOllama(prompt, {
                    temperature: 0.3,
                    num_predict: 350
                });

                if (!summary) {
                    throw new Error(window.Lexicon.I18n ? window.Lexicon.I18n.t('librarian.emptyResponse') : 'Modelo retornou resposta vazia.');
                }

                // Update UI and model
                if (summaryEl) {
                    summaryEl.value = summary;
                }
                const splitSummaryEl = document.getElementById('split-reader-summary');
                if (splitSummaryEl) {
                    splitSummaryEl.value = summary;
                }
                article.summary = summary;
                window.Lexicon.Storage.save();
                window.Lexicon.Articles.render();

                const successMsg = window.Lexicon.I18n ? window.Lexicon.I18n.t('librarian.summarizeSuccess') : 'Resumo executivo acadêmico gerado com sucesso!';
                window.Lexicon.UI.Toast.show(successMsg, 'success');
            } catch (err) {
                console.error('[Librarian:Summarize]', err);
                const errorMsg = window.Lexicon.I18n 
                    ? window.Lexicon.I18n.t('librarian.summarizeError', { error: err.message }) 
                    : `Erro ao gerar resumo: ${err.message}`;
                window.Lexicon.UI.Toast.show(errorMsg, 'error');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalBtnHtml;
                }
            }
        },

        /* =====================================================================
           TASK 2: Auto-Tagging e Sugestão de Coleção
           ===================================================================== */
        /**
         * Analyze title and abstract + existing collections to return strict JSON
         * and apply tags + collection classification to the inspected document.
         */
        async suggestTagsAndCollectionCurrentDocument() {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article) {
                const msg = window.Lexicon.I18n ? window.Lexicon.I18n.t('librarian.noDocSelected') : 'No document selected for inspection';
                window.Lexicon.UI.Toast.show(msg, 'error');
                return;
            }

            const btn = document.getElementById('btn-ai-tag-collection');
            const originalBtnHtml = btn ? btn.innerHTML : '';

            if (btn) {
                btn.disabled = true;
                const loadingText = window.Lexicon.I18n ? window.Lexicon.I18n.t('inspector.aiClassifying') : 'Classificando...';
                btn.innerHTML = `<i class="ph ph-spinner animate-spin text-xs"></i> ${loadingText}`;
            }

            try {
                const existingCollections = state.collections.map(c => c.name);
                const existingTags = Array.from(new Set(state.articles.flatMap(a => a.tags || []))).filter(Boolean).slice(0, 30);
                const docContext = [
                    `Título: "${article.title || 'Sem título'}"`,
                    article.authors ? `Autores: ${article.authors}` : '',
                    article.summary ? `Resumo / Abstract: ${article.summary}` : '',
                    article.notes ? `Notas / Anotações: ${article.notes}` : '',
                    article.tags && article.tags.length > 0 ? `Tags Atuais: ${article.tags.join(', ')}` : ''
                ].filter(Boolean).join('\n');

                const prompt = window.Lexicon.I18n
                    ? window.Lexicon.I18n.getPrompt('tagAndCollection', { collections: existingCollections, tags: existingTags, docContext })
                    : `Você é o Bibliotecário IA do Lexicon.\nAnalise os metadados do documento abaixo e a lista atual de coleções do usuário.\nColeções: [${existingCollections.join(', ')}]\nDocumento:\n${docContext}\nRetorne JSON com {"tags": [], "collection": "", "reasoning": ""}`;

                const rawJson = await this.callOllama(prompt, {
                    format: 'json',
                    temperature: 0.1,
                    num_predict: 400
                });

                let parsed;
                try {
                    parsed = JSON.parse(rawJson);
                } catch (pe) {
                    // Fallback regex extract in case of wrapping
                    const match = rawJson.match(/\{[\s\S]*\}/);
                    if (match) parsed = JSON.parse(match[0]);
                    else throw pe;
                }

                const newTags = Array.isArray(parsed.tags) ? parsed.tags.map(t => String(t).trim().toLowerCase().replace(/^#/, '')) : [];
                const suggestedCollection = parsed.collection ? String(parsed.collection).trim() : null;

                // Merge tags
                article.tags = article.tags || [];
                let addedCount = 0;
                newTags.forEach(t => {
                    if (t && !article.tags.includes(t)) {
                        article.tags.push(t);
                        addedCount++;
                    }
                });

                // Handle collection
                const collectionEl = document.getElementById('inspector-collection');
                if (suggestedCollection) {
                    const existingCol = state.collections.find(c => c.name.toLowerCase() === suggestedCollection.toLowerCase());
                    if (existingCol) {
                        article.collection = existingCol.name;
                        if (collectionEl) collectionEl.value = existingCol.name;
                    } else if (parsed.isNewCollection !== false) {
                        // Create collection automatically if user doesn't have it
                        if (window.Lexicon.Collections && window.Lexicon.Collections.createCollection) {
                            window.Lexicon.Collections.createCollection(suggestedCollection);
                        } else {
                            state.collections.push({ id: `c_${Date.now()}`, name: suggestedCollection });
                        }
                        article.collection = suggestedCollection;
                        if (collectionEl) {
                            collectionEl.innerHTML = `
                                <option value="">(None / Uncategorized)</option>
                                ${state.collections.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                            `;
                            collectionEl.value = suggestedCollection;
                        }
                    } else {
                        // Keep as text collection
                        article.collection = suggestedCollection;
                        if (collectionEl) collectionEl.value = suggestedCollection;
                    }
                }

                // Render in inspector
                if (window.Lexicon.Articles && window.Lexicon.Articles.renderInspectorTags) {
                    window.Lexicon.Articles.renderInspectorTags(article.tags);
                }

                window.Lexicon.Storage.save();
                window.Lexicon.Collections.render();
                window.Lexicon.Articles.render();

                const reason = parsed.reasoning || parsed.reason || '';
                const reasonText = reason ? ` (${reason})` : '';
                const targetCol = article.collection || (window.Lexicon.I18n ? window.Lexicon.I18n.t('folders.unfiled') : 'Geral');
                const successMsg = window.Lexicon.I18n
                    ? window.Lexicon.I18n.t('librarian.classifySuccess', { count: addedCount, collection: targetCol }) + reasonText
                    : `Bibliotecário: +${addedCount} tags atribuídas e classificado em "${targetCol}"${reasonText}`;
                window.Lexicon.UI.Toast.show(successMsg, 'success');
            } catch (err) {
                console.error('[Librarian:Tagging]', err);
                const errorMsg = window.Lexicon.I18n
                    ? window.Lexicon.I18n.t('librarian.classifyError', { error: err.message })
                    : `Erro ao sugerir tags/coleção: ${err.message}`;
                window.Lexicon.UI.Toast.show(errorMsg, 'error');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalBtnHtml;
                }
            }
        },

        /* =====================================================================
           TASK 3: Síntese de Fichamento (Markdown Assistant)
           ===================================================================== */
        /**
         * Reformat and structure the notes in #inspector-notes into academic Markdown standard
         */
        async structureCurrentNotes() {
            const state = window.Lexicon.State;
            const article = state.articles.find(a => a.id === state.inspectedArticleId);
            if (!article) {
                const msg = window.Lexicon.I18n ? window.Lexicon.I18n.t('librarian.noDocSelected') : 'No document selected for inspection';
                window.Lexicon.UI.Toast.show(msg, 'error');
                return;
            }

            const notesEl = document.getElementById('inspector-notes');
            const btn = document.getElementById('btn-ai-structure-notes');
            const originalBtnHtml = btn ? btn.innerHTML : '';

            const currentNotes = notesEl ? notesEl.value.trim() : (article.notes || '');

            if (btn) {
                btn.disabled = true;
                const loadingText = window.Lexicon.I18n ? window.Lexicon.I18n.t('inspector.aiStructuring') : 'Estruturando...';
                btn.innerHTML = `<i class="ph ph-spinner animate-spin text-xs"></i> ${loadingText}`;
            }

            try {
                const docContext = [
                    `Título: "${article.title || 'Documento'}"`,
                    article.authors ? `Autores: ${article.authors} (${article.year || 's.d.'})` : '',
                    article.summary ? `Resumo: ${article.summary}` : '',
                    `Anotações Atuais:\n${currentNotes || '(Nenhuma anotação prévia)'}`
                ].filter(Boolean).join('\n');

                const prompt = window.Lexicon.I18n
                    ? window.Lexicon.I18n.getPrompt('structureNotes', { docContext })
                    : `Você é o Assistente Acadêmico de Fichamento do Lexicon. Organize as anotações a seguir no padrão formal de Fichamento Acadêmico em Markdown.\n\n${docContext}`;

                const structured = await this.callOllama(prompt, {
                    temperature: 0.3,
                    num_predict: 1024
                });

                if (!structured) {
                    throw new Error(window.Lexicon.I18n ? window.Lexicon.I18n.t('librarian.emptyResponse') : 'Modelo retornou resposta vazia.');
                }

                if (notesEl) {
                    notesEl.value = structured;
                }
                article.notes = structured;

                if (window.Lexicon.Articles && window.Lexicon.Articles.autoSaveNotes) {
                    window.Lexicon.Articles.autoSaveNotes();
                } else {
                    window.Lexicon.Storage.save();
                }

                const successMsg = window.Lexicon.I18n ? window.Lexicon.I18n.t('librarian.structureSuccess') : 'Notas estruturadas no padrão de Fichamento Acadêmico!';
                window.Lexicon.UI.Toast.show(successMsg, 'success');
            } catch (err) {
                console.error('[Librarian:Notes]', err);
                const errorMsg = window.Lexicon.I18n
                    ? window.Lexicon.I18n.t('librarian.structureError', { error: err.message })
                    : `Erro ao estruturar notas: ${err.message}`;
                window.Lexicon.UI.Toast.show(errorMsg, 'error');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalBtnHtml;
                }
            }
        },

        /* =====================================================================
           TASK 4: Busca Semântica no Catálogo (Ctrl + K)
           ===================================================================== */
        /**
         * Translate natural language search query into native filtering parameters in state.js
         * @param {string} [overrideQuery] - Optional query string
         */
        async executeSemanticSearch(overrideQuery) {
            const searchInput = document.getElementById('search-input');
            const query = (overrideQuery !== undefined ? overrideQuery : (searchInput ? searchInput.value : '')).trim();

            if (!query) {
                this.clearSemanticFilter();
                return;
            }

            const searchBtn = document.getElementById('btn-ai-search');
            const originalBtnHtml = searchBtn ? searchBtn.innerHTML : '';

            if (searchBtn) {
                searchBtn.disabled = true;
                searchBtn.innerHTML = `<i class="ph ph-spinner animate-spin text-sm text-jungle"></i>`;
            }

            try {
                const state = window.Lexicon.State;
                const existingCollections = state.collections.map(c => c.name);

                // Collect unique tags and years from library
                const existingTags = Array.from(new Set(state.articles.flatMap(a => a.tags || []))).filter(Boolean);
                const existingYears = Array.from(new Set(state.articles.map(a => a.year).filter(Boolean))).sort((a, b) => b - a);

                const prompt = window.Lexicon.I18n
                    ? window.Lexicon.I18n.getPrompt('semanticSearch', { query, collections: existingCollections, tags: existingTags, years: existingYears })
                    : `Você é o Bibliotecário IA do Lexicon. O pesquisador buscou: "${query}". Retorne JSON com filtros textQuery, year, status, collection, tag, explanation.`;

                const rawJson = await this.callOllama(prompt, {
                    format: 'json',
                    temperature: 0.1,
                    num_predict: 350
                });

                let parsed;
                try {
                    parsed = JSON.parse(rawJson);
                } catch (e) {
                    const match = rawJson.match(/\{[\s\S]*\}/);
                    if (match) parsed = JSON.parse(match[0]);
                    else throw e;
                }

                // Apply semantic filter to State
                state.semanticFilter = {
                    originalQuery: query,
                    textQuery: (parsed.textQuery || '').trim(),
                    year: parsed.year ? parseInt(parsed.year) : null,
                    status: parsed.status && ['inbox', 'reading', 'processing', 'favorites', 'archived', 'recent'].includes(parsed.status) ? parsed.status : null,
                    collection: parsed.collection || null,
                    tag: parsed.tag ? String(parsed.tag).replace(/^#/, '').toLowerCase() : null,
                    explanation: parsed.explanation || 'Filtro semântico aplicado pelo Bibliotecário IA'
                };

                // Clear standard search query to let semantic filter take precedence
                state.searchQuery = '';

                // Record navigation state
                if (window.Lexicon.Navigation && window.Lexicon.Navigation.recordNavigation) {
                    window.Lexicon.Navigation.recordNavigation();
                }

                // Trigger native re-render
                window.Lexicon.Articles.render();

                const toastMsg = window.Lexicon.I18n
                    ? window.Lexicon.I18n.t('librarian.semanticApplied', { explanation: state.semanticFilter.explanation })
                    : `🤖 Bibliotecário IA: ${state.semanticFilter.explanation}`;
                window.Lexicon.UI.Toast.show(toastMsg, 'info');
            } catch (err) {
                console.error('[Librarian:SemanticSearch]', err);
                const errorMsg = window.Lexicon.I18n
                    ? window.Lexicon.I18n.t('librarian.semanticError', { error: err.message })
                    : `Erro na busca semântica: ${err.message}`;
                window.Lexicon.UI.Toast.show(errorMsg, 'error');
                // Fallback to native text search
                window.Lexicon.State.searchQuery = query;
                if (window.Lexicon.Navigation && window.Lexicon.Navigation.recordNavigation) {
                    window.Lexicon.Navigation.recordNavigation();
                }
                window.Lexicon.Articles.render();
            } finally {
                if (searchBtn) {
                    searchBtn.disabled = false;
                    searchBtn.innerHTML = originalBtnHtml;
                }
            }
        },

        /**
         * Clear active semantic filter and restore normal catalog view
         */
        clearSemanticFilter() {
            this.abortAll();
            const state = window.Lexicon.State;
            state.semanticFilter = null;
            state.searchQuery = '';

            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.value = '';

            if (window.Lexicon.Navigation && window.Lexicon.Navigation.recordNavigation) {
                window.Lexicon.Navigation.recordNavigation();
            }

            window.Lexicon.Articles.render();
            const msg = window.Lexicon.I18n ? window.Lexicon.I18n.t('librarian.semanticCleared') : 'Filtro semântico removido';
            window.Lexicon.UI.Toast.show(msg, 'info');
        },

        /**
         * Utility: Format byte size
         */
        formatBytes(bytes) {
            if (!bytes || bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }
    };

    window.Lexicon.Librarian = Librarian;
})();
