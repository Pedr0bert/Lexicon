/* ==========================================================================
   Lexicon - Internationalization (i18n) Module
   Provides zero-dependency localization for PT-BR and EN-US
   ========================================================================== */

window.Lexicon = window.Lexicon || {};

(function() {
    const translations = {
        'pt-BR': {
            'app': {
                'name': 'Lexicon',
                'subtitle': 'Gerenciador de Pesquisa',
                'storageConnected': 'Armazenamento Local Conectado'
            },
            'nav': {
                'workflow': 'Fluxo de Trabalho',
                'all': 'Todos os Documentos',
                'collections': 'Coleções & Pastas',
                'inbox': 'Caixa de Entrada',
                'reading': 'Lista de Leitura',
                'processing': 'Fichamento',
                'favorites': 'Favoritos',
                'archived': 'Arquivados & Lidos',
                'recent': 'Adicionados Recentemente',
                'collectionsHeader': 'Coleções',
                'backupHeader': 'Backup do Catálogo',
                'exportBackup': 'Exportar Catálogo (.json)',
                'importBackup': 'Importar Catálogo',
                'resetSample': 'Restaurar Biblioteca de Exemplo',
                'toggleSidebar': 'Alternar Barra Lateral',
                'btnBackTitle': 'Voltar para página anterior (Alt + ←)',
                'btnForwardTitle': 'Avançar (Alt + →)',
                'pageBack': 'Voltar',
                'settings': 'Configurações',
                'stats': 'Estatísticas & Insights'
            },
            'search': {
                'placeholder': "Buscar título, notas ou pergunte à IA (ex: 'artigos sobre modulação óptica lidos em 2024')... (Ctrl+K)",
                'aiSearchTitle': 'Busca Semântica com o Bibliotecário IA (Enter)',
                'title': 'Busca',
                'semanticTitle': 'Busca Semântica',
                'tagTitle': 'Etiqueta',
                'filteredBy': 'Filtrado por:',
                'clearSemantic': 'Limpar Filtro IA',
                'filteringByTag': 'Filtrando pela etiqueta:'
            },
            'sort': {
                'label': 'Ordenar:',
                'newest': 'Mais recentes',
                'oldest': 'Mais antigos',
                'title': 'Título (A-Z)',
                'year': 'Ano (Mais recente)'
            },
            'view': {
                'grid': 'Visualização em Grade',
                'table': 'Visualização em Tabela'
            },
            'common': {
                'document': 'documento',
                'documents': 'documentos',
                'close': 'Fechar',
                'cancel': 'Cancelar',
                'save': 'Salvar',
                'saveChanges': 'Salvar Alterações',
                'delete': 'Excluir',
                'edit': 'Editar',
                'create': 'Criar',
                'loading': 'Carregando...',
                'add': 'Adicionar',
                'read': 'LER',
                'actions': 'Ações',
                'addDocument': 'Adicionar Documento'
            },
            'collections': {
                'title': 'Coleções & Pastas',
                'emptyFolder': '(Pasta vazia)',
                'noCollections': 'Nenhuma coleção criada',
                'createModalTitle': 'Criar Nova Coleção',
                'inputLabel': 'Nome da Coleção',
                'inputPlaceholder': 'ex: Sistemas Cognitivos',
                'createBtn': 'Criar Coleção',
                'deleteTitle': 'Excluir Coleção',
                'reduce': 'Recolher coleção',
                'expand': 'Expandir coleção',
                'expandList': 'Expandir / Recolher lista de coleções',
                'confirmDelete': 'Tem certeza de que deseja excluir a coleção "{name}"? Os artigos nela permanecerão no seu acervo.',
                'createdToast': 'Coleção "{name}" criada',
                'deletedToast': 'Coleção "{name}" excluída',
                'nameRequired': 'Por favor, digite o nome da coleção',
                'alreadyExists': 'Já existe uma coleção com este nome'
            },
            'folders': {
                'expandAll': 'Expandir todas',
                'reduceAll': 'Recolher todas',
                'emptyNotice': 'Nenhum documento nesta pasta.',
                'addDocsNow': 'Adicionar documentos agora',
                'addDocTitle': 'Adicionar documento a esta coleção',
                'addDoc': 'Adicionar Documento',
                'filterTitle': 'Filtrar biblioteca por esta coleção',
                'filter': 'Filtrar',
                'deleteTitle': 'Excluir Coleção',
                'reduce': 'Recolher',
                'expand': 'Expandir',
                'unfiled': 'Sem Coleção (Geral)',
                'noFiles': 'Nenhum arquivo registrado ainda'
            },
            'inspector': {
                'modalTitle': 'Inspetor de Documento',
                'summaryTab': 'Resumo & Abstract',
                'summaryPlaceholder': 'Resumo executivo, abstract ou tese central do documento...',
                'aiSummarize': 'Resumir com IA',
                'aiSummarizing': 'Resumindo...',
                'fileConnected': 'Arquivo Vinculado:',
                'relink': 'Vincular PDF Local',
                'metadataTitle': 'Metadados do Documento',
                'fieldTitle': 'Título Oficial',
                'fieldAuthors': 'Autores (separados por vírgula)',
                'fieldYear': 'Ano de Publicação',
                'fieldPublication': 'Periódico / Revista / Conferência',
                'fieldCollection': 'Coleção / Pasta',
                'fieldDoi': 'DOI ou Identificador',
                'fieldTags': 'Etiquetas (Tags)',
                'aiClassify': 'Classificar com IA',
                'aiClassifying': 'Classificando...',
                'tagPlaceholder': 'Nova tag...',
                'notesTitle': 'Fichamento',
                'notesPlaceholder': 'Digite aqui suas citações, notas de leitura, metodologia e reflexões críticas...',
                'aiStructure': 'Estruturar com IA',
                'aiStructuring': 'Estruturando...',
                'exportNotes': 'Exportar .md',
                'deleteDoc': 'Excluir Documento',
                'confirmDelete': 'Tem certeza de que deseja excluir este documento permanentemente?',
                'readTooltip': 'Abrir diretamente no leitor nativo do navegador',
                'favoriteTooltip': 'Marcar/Desmarcar como favorito',
                'starAdded': 'Adicionado aos favoritos',
                'starRemoved': 'Removido dos favoritos',
                'savedToast': 'Alterações salvas com sucesso',
                'deletedToast': 'Documento excluído',
                'notesExported': 'Fichamento exportado como Markdown',
                'openingReader': 'Abrindo "{title}" no leitor do navegador...',
                'fetchMetadata': 'Buscar Metadados',
                'fetchingMetadata': 'Buscando...',
                'fetchMetadataTitle': 'Buscar metadados automaticamente via CrossRef ou arXiv',
                'promptEnterDoi': 'Insira um DOI ou ID do arXiv primeiro',
                'metadataSuccess': 'Metadados importados com sucesso de {source}!',
                'metadataNotFound': 'Não foi possível encontrar metadados para este identificador.',
                'metadataError': 'Erro ao consultar metadados.',
                'confirmOverwriteSummary': 'Deseja substituir o resumo atual pelo abstract oficial?',
                'cite': 'Citar',
                'citeTooltip': 'Copiar referência formatada ou exportar citação',
                'copyReference': 'Copiar Referência',
                'exportFormat': 'Formatos de Intercâmbio',
                'quickCitation': 'Citações & Referência Rápida',
                'oneClickCopy': 'Clique para copiar',
                'copiedCitation': 'Referência ({format}) copiada para a área de transferência!',
                'copiedBibtex': 'Citação BibTeX copiada para a área de transferência!',
                'downloadedBibtex': 'Arquivo BibTeX (.bib) baixado com sucesso!',
                'downloadedRis': 'Arquivo RIS (.ris) baixado para Zotero / Mendeley!',
                'splitView': 'Split-View',
                'splitViewTitle': 'Abrir no Leitor Integrado lado a lado (Split-View)',
                'exportConsolidated': 'Exportar Fichamento (.md)',
                'quickCite': 'Citação',
                'quickCiteTitle': 'Inserir citação formatada (> trecho...)',
                'exportedNotesSuccess': 'Fichamento estruturado exportado (.md) com sucesso!'
            },
            'zettelkasten': {
                'backlinksTitle': 'Citações Reversas (Backlinks)',
                'wikilinks': 'Rede Zettelkasten [[Wikilinks]]',
                'noBacklinks': 'Nenhum documento cita este artigo ainda.',
                'linkHint': 'Digite [[Título]] em outro fichamento para conectá-los.'
            },
            'dashboard': {
                'title': 'Estatísticas & Insights do Acervo',
                'countInfo': '{docs} documentos catalogados em {cols} coleções',
                'emptyTitle': 'Nenhum dado para analisar',
                'emptyDesc': 'Adicione documentos ao seu catálogo para visualizar métricas analíticas e o funil de leitura.',
                'totalLibrary': 'Acervo Total',
                'activeCollections': '{count} coleções ativas',
                'notesTaken': 'Fichamentos',
                'withNotes': '{pct}% com anotações',
                'readingNow': 'Lendo Agora',
                'inActiveReading': 'Artigos em leitura ativa',
                'completed': 'Concluídos',
                'completionRate': '{pct}% de conclusão geral',
                'avgStay': 'Permanência Média',
                'days': 'dias',
                'avgInLibrary': 'Média no acervo',
                'funnelTitle': 'Funil do Pipeline de Leitura',
                'funnelSubtitle': 'Fluxo contínuo da biblioteca (Inbox → Lendo → Fichamento → Arquivados)',
                'docsBadge': '{count} Docs',
                'paceTitle': 'Ritmo de Aquisição & Leitura',
                'paceSubtitle': 'Distribuição temporal de artigos adicionados ao longo dos meses',
                'months': '{count} Meses',
                'monthlyPace': 'Cadência média mensal:',
                'articlesPerMonth': '{count} artigos/mês',
                'consistencyBadge': 'Consistência Científica',
                'noMonthlyData': 'Nenhum dado mensal registrado.',
                'collectionsTitle': 'Distribuição do Acervo por Coleções',
                'collectionsSubtitle': 'Proporção temática do seu acervo de pesquisa',
                'stayTimeTitle': 'Tempo Médio de Permanência por Etapa',
                'stayTimeSubtitle': 'Média de dias decorridos desde a entrada no acervo',
                'stayWorkflowHint': 'Fluxo recomendado: mover do Inbox para Lendo em até 7 dias',
                'tagCloudTitle': 'Nuvem de Tópicos & Palavras-chave Frequentes',
                'tagCloudSubtitle': 'As 20 etiquetas mais presentes no seu acervo (clique para filtrar)',
                'topicsCount': '{count} tópicos',
                'noTags': 'Nenhuma tag cadastrada ainda. Adicione tags aos seus documentos para gerar a nuvem temática.',
                'filterByTagTitle': 'Filtrar por #{tag} ({count} artigos)',
                'uncategorized': 'Sem Coleção',
                'stageInbox': 'Inbox (Sem classificação)',
                'stageReading': 'Em Leitura Ativa',
                'stageProcessing': 'Fichamento & Notas',
                'stageArchived': 'Arquivados & Lidos',
                'funnelInbox': 'Inbox',
                'funnelReading': 'Lendo',
                'funnelProcessing': 'Fichamento',
                'funnelArchived': 'Arquivados'
            },
            'upload': {
                'modalTitle': 'Adicionar Documento ao Acervo',
                'tabSingle': 'Documento Individual',
                'tabMulti': 'Importação em Lote / Pasta',
                'dropTitle': 'Solte o arquivo PDF ou EPUB aqui',
                'dropSubtitle': 'ou clique para navegar no seu computador',
                'dropMultiTitle': 'Solte múltiplos arquivos ou uma pasta inteira aqui',
                'selectFiles': 'Selecionar Arquivos',
                'selectFolder': 'Selecionar Pasta',
                'stagedFiles': 'Arquivos na Fila',
                'clearStaging': 'Limpar fila',
                'defaultCollection': 'Coleção Padrão para Arquivos Avulsos',
                'autoTagFolders': 'Criar coleções e tags automaticamente com base nos nomes das pastas',
                'saveToLibrary': 'Salvar na Biblioteca',
                'importDocs': 'Importar Documentos',
                'importSuccess': '{count} documento(s) importado(s) com sucesso'
            },
            'batch': {
                'selected': 'selecionado(s)',
                'newCollection': 'Nova Coleção',
                'addTag': 'Adicionar Tag',
                'favorite': 'Favoritar',
                'markRead': 'Marcar como Lido',
                'delete': 'Excluir',
                'clear': 'Limpar seleção',
                'confirmBatchDelete': 'Tem certeza de que deseja excluir os {count} documentos selecionados?',
                'batchMoved': '{count} documentos movidos para a coleção "{name}"',
                'batchTagAdded': 'Tag #{tag} adicionada a {count} documentos',
                'batchFavoritesUpdated': 'Status de favoritos atualizado para {count} documentos',
                'batchMarkedRead': '{count} documentos marcados como lidos e arquivados',
                'batchDeleted': '{count} documentos excluídos',
                'modalTitle': 'Nova Coleção para Selecionados',
                'modalSubtitle': 'Cria uma nova coleção e move os documentos selecionados para ela.',
                'createAndMove': 'Criar & Mover',
                'exportBibtex': 'BibTeX (.bib)',
                'exportBibtexTitle': 'Exportar selecionados como BibTeX (.bib)',
                'exportRis': 'RIS (.ris)',
                'exportRisTitle': 'Exportar selecionados como RIS (.ris) para Zotero / Mendeley',
                'exportedBibtex': '{count} citações exportadas em BibTeX (.bib)',
                'exportedRis': '{count} referências exportadas em RIS (.ris)'
            },
            'reset': {
                'title': 'Restaurar Biblioteca de Exemplo',
                'step1Indicator': 'Passo 1 de 3: Aviso de Segurança',
                'step2Indicator': 'Passo 2 de 3: Confirmação de Ação',
                'step3Indicator': 'Passo 3 de 3: Confirmação Final por Texto',
                'step1Warning': 'Atenção: Esta ação substituirá o seu catálogo atual pelo catálogo inicial de demonstração do Lexicon.',
                'step1Detail': 'Se você possui documentos ou fichamentos que não salvou em backup, eles poderão ser desvinculados.',
                'step2Question': 'Tem certeza de que deseja prosseguir com a restauração?',
                'step2Detail': 'Recomendamos exportar um backup (.json) do catálogo antes de continuar se houver dados importantes.',
                'step3Instruct': 'Para confirmar, digite exatamente RESET no campo abaixo:',
                'step3Placeholder': 'Digite RESET para confirmar',
                'btnNext': 'Continuar',
                'btnBack': 'Voltar',
                'btnConfirmReset': 'Restaurar Dados de Exemplo',
                'successToast': 'Biblioteca restaurada com os dados de exemplo'
            },
            'settings': {
                'modalTitle': 'Configurações do Lexicon',
                'modalSubtitle': 'Preferências do sistema, idioma e IA local',
                'tabGeneral': 'Geral & Idioma',
                'tabAI': 'Bibliotecário IA',
                'tabBackup': 'Catálogo & Dados',
                'languageTitle': 'Idioma da Aplicação & IA',
                'languageSubtitle': 'Selecione o idioma utilizado na interface, notificações e nos comandos enviados aos modelos locais do Ollama.',
                'langPtTitle': 'Português (Brasil)',
                'langPtDesc': 'Interface completa e prompts acadêmicos em português',
                'langEnTitle': 'English (US)',
                'langEnDesc': 'Interface and academic prompts in English',
                'privacyTitle': 'Arquitetura 100% Local-First',
                'privacyDesc': 'Seus artigos, notas, fichamentos e arquivos PDF permanecem salvos exclusivamente no armazenamento local do seu computador (IndexedDB do navegador). Nenhuma informação é enviada a servidores externos ou nuvem.',
                'backupDesc': 'Exporte todo o seu catálogo bibliográfico com notas e referências em formato JSON padronizado ou restaure um backup prévio.',
                'connectionStatus': 'Status da Conexão Local',
                'checkingOllama': 'Verificando status do Ollama...',
                'testConnection': 'Testar Conexão',
                'endpointLabel': 'Endereço da API Ollama',
                'modelLabel': 'Modelo de IA Ativo',
                'languageLabel': 'Idioma da Aplicação & IA',
                'languagePt': 'Português (Brasil)',
                'languageEn': 'English (US)',
                'tasksTitle': 'Tarefas Mecânicas Integradas',
                'task1Title': '1. Resumo Inteligente',
                'task1Desc': 'Gera resumo executivo acadêmico (2 a 3 frases) no Document Inspector.',
                'task2Title': '2. Auto-Tagging & Coleção',
                'task2Desc': 'Analisa título/abstract e classifica em coleção e tags via JSON estrito.',
                'task3Title': '3. Síntese de Fichamento',
                'task3Desc': "Botão 'Estruturar Notas' formata citações e conclusões em Markdown.",
                'task4Title': '4. Busca Semântica (Ctrl+K)',
                'task4Desc': 'Traduz perguntas em linguagem natural para filtros nativos no State.',
                'localPrivate': '100% Local & Privativo',
                'saveSettings': 'Salvar Configurações',
                'settingsSaved': 'Configurações salvas'
            },
            'toast': {
                'languageChanged': 'Idioma alterado para Português',
                'ollamaOnline': 'Bibliotecário: Conectado ao Ollama ({model})',
                'ollamaOffline': 'Bibliotecário: Ollama inacessível em {endpoint}',
                'catalogExported': 'Catálogo exportado com sucesso',
                'catalogImported': 'Catálogo importado com sucesso ({count} artigos)',
                'importInvalidJson': 'Arquivo JSON inválido para o catálogo'
            },
            'emptyState': {
                'title': 'Nenhum documento encontrado',
                'description': 'Nenhum artigo, livro ou documento corresponde ao filtro ou critério de busca atual.',
                'action': 'Adicionar Novo Documento'
            },
            'librarian': {
                'connected': 'Ollama conectado ({count} modelos detectados)',
                'offline': 'Não foi possível conectar ao Ollama local',
                'fileProtocolNotice': 'Abra via http://localhost:8000 (execute ./start.sh) para permitir conexão local',
                'corsNotice': 'Bloqueio de CORS detectado no Ollama. Inicie via ./start.sh ou configure OLLAMA_ORIGINS="*"',
                'serviceDownNotice': 'Certifique-se de que o Ollama está rodando (ollama serve).',
                'disconnected': 'Desconectado',
                'activeTitle': 'Bibliotecário IA Ativo ({model}) - Clique para configurar',
                'inactiveTitle': 'Bibliotecário IA Desconectado - Clique para ver diagnóstico',
                'noModels': 'Nenhum modelo detectado (Verifique a conexão com o Ollama)',
                'summarizeSuccess': 'Resumo executivo acadêmico gerado com sucesso!',
                'summarizeError': 'Erro ao gerar resumo: {error}',
                'classifySuccess': 'Bibliotecário: +{count} tags atribuídas e classificado em "{collection}"',
                'classifyError': 'Erro ao sugerir tags/coleção: {error}',
                'structureSuccess': 'Notas estruturadas no padrão de Fichamento Acadêmico!',
                'structureError': 'Erro ao estruturar notas: {error}',
                'semanticApplied': '🤖 Bibliotecário IA: {explanation}',
                'semanticError': 'Erro na busca semântica: {error}',
                'semanticCleared': 'Filtro semântico removido',
                'noDocSelected': 'Nenhum documento selecionado para inspeção',
                'emptyResponse': 'Modelo retornou resposta vazia.',
                'userCancelled': 'Geração cancelada pelo usuário.'
            },
            'table': {
                'colTitle': 'Título & Referência',
                'colCollection': 'Coleção',
                'colYear': 'Ano',
                'colTags': 'Etiquetas',
                'colActions': 'Ações'
            }
        },
        'en-US': {
            'app': {
                'name': 'Lexicon',
                'subtitle': 'File Manager',
                'storageConnected': 'Computer Storage Connected'
            },
            'nav': {
                'workflow': 'Workflow',
                'all': 'All Documents',
                'collections': 'Collections & Folders',
                'inbox': 'Inbox',
                'reading': 'Reading List',
                'processing': 'Notes',
                'favorites': 'Favorites',
                'archived': 'Archived',
                'recent': 'Recently Added',
                'collectionsHeader': 'Collections',
                'backupHeader': 'Catalog Backup',
                'exportBackup': 'Export Catalog (.json)',
                'importBackup': 'Import Catalog',
                'resetSample': 'Reset Sample Data',
                'toggleSidebar': 'Toggle Sidebar',
                'btnBackTitle': 'Return to previous page (Alt + ←)',
                'btnForwardTitle': 'Go forward (Alt + →)',
                'pageBack': 'Back',
                'settings': 'Settings',
                'stats': 'Statistics & Insights'
            },
            'search': {
                'placeholder': "Search title, notes, or ask AI (e.g. 'papers on optical modulation read in 2024')... (Ctrl+K)",
                'aiSearchTitle': 'Semantic Search with AI Librarian (Enter)',
                'title': 'Search',
                'semanticTitle': 'Semantic Search',
                'tagTitle': 'Tag',
                'filteredBy': 'Filtered by:',
                'clearSemantic': 'Clear AI Filter',
                'filteringByTag': 'Filtering by tag:'
            },
            'sort': {
                'label': 'Sort:',
                'newest': 'Newest Added',
                'oldest': 'Oldest Added',
                'title': 'Title (A-Z)',
                'year': 'Year (Newest)'
            },
            'view': {
                'grid': 'Grid Cards View',
                'table': 'High-Density Table View'
            },
            'common': {
                'document': 'document',
                'documents': 'documents',
                'close': 'Close',
                'cancel': 'Cancel',
                'save': 'Save',
                'saveChanges': 'Save Changes',
                'delete': 'Delete',
                'edit': 'Edit',
                'create': 'Create',
                'loading': 'Loading...',
                'add': 'Add',
                'read': 'READ',
                'actions': 'Actions',
                'addDocument': 'Add Document'
            },
            'collections': {
                'title': 'Collections & Folders',
                'emptyFolder': '(Empty folder)',
                'noCollections': 'No collections yet',
                'createModalTitle': 'Create New Collection',
                'inputLabel': 'Collection Name',
                'inputPlaceholder': 'e.g. Cognitive Systems',
                'createBtn': 'Create Collection',
                'deleteTitle': 'Delete collection',
                'reduce': 'Reduce collection',
                'expand': 'Expand collection',
                'expandList': 'Expand / Reduce Collections list',
                'confirmDelete': 'Are you sure you want to delete collection "{name}"? Articles in it will remain in your library.',
                'createdToast': 'Collection "{name}" created',
                'deletedToast': 'Collection "{name}" deleted',
                'nameRequired': 'Please enter a collection name',
                'alreadyExists': 'A collection with this name already exists'
            },
            'folders': {
                'expandAll': 'Expand all',
                'reduceAll': 'Reduce all',
                'emptyNotice': 'No documents in this folder.',
                'addDocsNow': 'Add documents now',
                'addDocTitle': 'Add document to this collection',
                'addDoc': 'Add Document',
                'filterTitle': 'Filter library by this collection',
                'filter': 'Filter',
                'deleteTitle': 'Delete Collection',
                'reduce': 'Reduce',
                'expand': 'Expand',
                'unfiled': 'Unfiled Documents',
                'noFiles': 'No files recorded yet'
            },
            'inspector': {
                'modalTitle': 'Document Inspector',
                'summaryTab': 'Summary & Abstract',
                'summaryPlaceholder': 'Executive summary, abstract or main thesis of the document...',
                'aiSummarize': 'Summarize with AI',
                'aiSummarizing': 'Summarizing...',
                'fileConnected': 'Linked File:',
                'relink': 'Relink Local PDF',
                'metadataTitle': 'Document Metadata',
                'fieldTitle': 'Official Title',
                'fieldAuthors': 'Authors (comma separated)',
                'fieldYear': 'Year',
                'fieldPublication': 'Publication / Journal / Conference',
                'fieldCollection': 'Collection / Folder',
                'fieldDoi': 'DOI or Identifier',
                'fieldTags': 'Tags',
                'aiClassify': 'Classify with AI',
                'aiClassifying': 'Classifying...',
                'tagPlaceholder': 'New tag...',
                'notesTitle': 'Notes',
                'notesPlaceholder': 'Type here your quotes, reading notes, methodology and critical reflections...',
                'aiStructure': 'Structure with AI',
                'aiStructuring': 'Structuring...',
                'exportNotes': 'Export .md',
                'deleteDoc': 'Delete Document',
                'confirmDelete': 'Are you sure you want to delete this document permanently?',
                'readTooltip': 'Open directly in browser PDF reader',
                'favoriteTooltip': 'Toggle Favorite',
                'starAdded': 'Added to favorites',
                'starRemoved': 'Removed from favorites',
                'savedToast': 'Changes saved successfully',
                'deletedToast': 'Document deleted',
                'notesExported': 'Notes exported as Markdown',
                'openingReader': 'Opening "{title}" in browser reader...',
                'fetchMetadata': 'Fetch Metadata',
                'fetchingMetadata': 'Fetching...',
                'fetchMetadataTitle': 'Fetch metadata automatically via CrossRef or arXiv',
                'promptEnterDoi': 'Please enter a DOI or arXiv ID first',
                'metadataSuccess': 'Metadata imported successfully from {source}!',
                'metadataNotFound': 'Could not find metadata for this identifier.',
                'metadataError': 'Error fetching metadata.',
                'confirmOverwriteSummary': 'Overwrite existing summary with official abstract?',
                'cite': 'Cite',
                'citeTooltip': 'Copy formatted reference or export citation',
                'copyReference': 'Copy Reference',
                'exportFormat': 'Interchange Formats',
                'quickCitation': 'Citations & Quick Reference',
                'oneClickCopy': 'Click to copy',
                'copiedCitation': 'Reference ({format}) copied to clipboard!',
                'copiedBibtex': 'BibTeX citation copied to clipboard!',
                'downloadedBibtex': 'BibTeX file (.bib) downloaded successfully!',
                'downloadedRis': 'RIS file (.ris) downloaded for Zotero / Mendeley!',
                'splitView': 'Split-View',
                'splitViewTitle': 'Open in Integrated Reader (Split-View)',
                'exportConsolidated': 'Export Structured Notes (.md)',
                'quickCite': 'Quote',
                'quickCiteTitle': 'Insert formatted citation block (> text...)',
                'exportedNotesSuccess': 'Structured notes (.md) exported successfully!'
            },
            'zettelkasten': {
                'backlinksTitle': 'Reverse Citations (Backlinks)',
                'wikilinks': 'Zettelkasten [[Wikilinks]] Network',
                'noBacklinks': 'No other document references this paper yet.',
                'linkHint': 'Type [[Title]] in another note to link them.'
            },
            'dashboard': {
                'title': 'Library Analytics & Insights',
                'countInfo': '{docs} documents cataloged in {cols} collections',
                'emptyTitle': 'No data to analyze',
                'emptyDesc': 'Add documents to your library to view analytics metrics and the reading funnel.',
                'totalLibrary': 'Total Library',
                'activeCollections': '{count} active collections',
                'notesTaken': 'Reading Notes',
                'withNotes': '{pct}% with notes',
                'readingNow': 'Reading Now',
                'inActiveReading': 'Articles in active reading',
                'completed': 'Completed',
                'completionRate': '{pct}% overall completion',
                'avgStay': 'Average Stay',
                'days': 'days',
                'avgInLibrary': 'Average in library',
                'funnelTitle': 'Reading Pipeline Funnel',
                'funnelSubtitle': 'Continuous library workflow (Inbox → Reading → Notes → Archived)',
                'docsBadge': '{count} Docs',
                'paceTitle': 'Acquisition & Reading Rhythm',
                'paceSubtitle': 'Temporal distribution of articles added over months',
                'months': '{count} Months',
                'monthlyPace': 'Average monthly pace:',
                'articlesPerMonth': '{count} articles/month',
                'consistencyBadge': 'Scientific Consistency',
                'noMonthlyData': 'No monthly data recorded.',
                'collectionsTitle': 'Library Distribution by Collection',
                'collectionsSubtitle': 'Thematic proportion of your research library',
                'stayTimeTitle': 'Average Stage Stay Time',
                'stayTimeSubtitle': 'Average days elapsed since added to library',
                'stayWorkflowHint': 'Recommended workflow: move from Inbox to Reading within 7 days',
                'tagCloudTitle': 'Frequent Topics & Keywords Cloud',
                'tagCloudSubtitle': 'Top 20 tags in your research library (click to filter)',
                'topicsCount': '{count} topics',
                'noTags': 'No tags registered yet. Add tags to your documents to generate the topic cloud.',
                'filterByTagTitle': 'Filter by #{tag} ({count} articles)',
                'uncategorized': 'Uncategorized',
                'stageInbox': 'Inbox (Unsorted)',
                'stageReading': 'In Active Reading',
                'stageProcessing': 'Notes & Processing',
                'stageArchived': 'Archived & Read',
                'funnelInbox': 'Inbox',
                'funnelReading': 'Reading',
                'funnelProcessing': 'Notes',
                'funnelArchived': 'Archived'
            },
            'upload': {
                'modalTitle': 'Add Document to Library',
                'tabSingle': 'Single Document',
                'tabMulti': 'Batch Import / Folder',
                'dropTitle': 'Drop PDF or EPUB here',
                'dropSubtitle': 'or click to browse local files',
                'dropMultiTitle': 'Drop multiple files or an entire directory here',
                'selectFiles': 'Select Files',
                'selectFolder': 'Select Folder',
                'stagedFiles': 'Staged Files',
                'clearStaging': 'Clear staging',
                'defaultCollection': 'Default Collection for Unfiled Files',
                'autoTagFolders': 'Automatically create collections and tags based on folder names',
                'saveToLibrary': 'Save to Library',
                'importDocs': 'Import Documents',
                'importSuccess': '{count} document(s) successfully imported'
            },
            'batch': {
                'selected': 'selected',
                'newCollection': 'New Collection',
                'addTag': 'Add Tag',
                'favorite': 'Favorite',
                'markRead': 'Mark Read',
                'delete': 'Delete',
                'clear': 'Clear selection',
                'confirmBatchDelete': 'Are you sure you want to delete {count} selected documents?',
                'batchMoved': '{count} documents moved to collection "{name}"',
                'batchTagAdded': 'Tag #{tag} added to {count} documents',
                'batchFavoritesUpdated': 'Favorites status updated for {count} documents',
                'batchMarkedRead': '{count} documents marked as read and archived',
                'batchDeleted': '{count} documents deleted',
                'modalTitle': 'New Collection for Selected',
                'modalSubtitle': 'Create a new collection and move selected documents into it.',
                'createAndMove': 'Create & Move',
                'exportBibtex': 'BibTeX (.bib)',
                'exportBibtexTitle': 'Export selected as BibTeX (.bib)',
                'exportRis': 'RIS (.ris)',
                'exportRisTitle': 'Export selected as RIS (.ris) for Zotero / Mendeley',
                'exportedBibtex': 'Exported {count} citations as BibTeX (.bib)',
                'exportedRis': 'Exported {count} references as RIS (.ris)'
            },
            'reset': {
                'title': 'Reset Sample Data',
                'step1Indicator': 'Step 1 of 3: Safety Warning',
                'step2Indicator': 'Step 2 of 3: Action Confirmation',
                'step3Indicator': 'Step 3 of 3: Text Confirmation',
                'step1Warning': 'Warning: This action will replace your current catalog with Lexicon initial demo library.',
                'step1Detail': 'If you have documents or notes that have not been backed up, they may be unlinked.',
                'step2Question': 'Are you sure you want to proceed with resetting?',
                'step2Detail': 'We strongly recommend exporting a catalog backup (.json) before continuing if you have important data.',
                'step3Instruct': 'To confirm, type exactly RESET in the box below:',
                'step3Placeholder': 'Type RESET to confirm',
                'btnNext': 'Continue',
                'btnBack': 'Back',
                'btnConfirmReset': 'Reset Sample Library',
                'successToast': 'Library reset to initial sample data'
            },
            'settings': {
                'modalTitle': 'Lexicon Settings',
                'modalSubtitle': 'System preferences, language, and local AI',
                'tabGeneral': 'General & Language',
                'tabAI': 'AI Librarian',
                'tabBackup': 'Catalog & Data',
                'languageTitle': 'Application & AI Language',
                'languageSubtitle': 'Select the language used across the UI, notifications, and prompts sent to local Ollama models.',
                'langPtTitle': 'Português (Brasil)',
                'langPtDesc': 'Interface completa e prompts acadêmicos em português',
                'langEnTitle': 'English (US)',
                'langEnDesc': 'Complete interface and academic prompts in English',
                'privacyTitle': '100% Local-First Architecture',
                'privacyDesc': 'Your articles, notes, synthesis, and PDF files remain stored exclusively on your local computer (browser IndexedDB). No information is sent to external servers or cloud.',
                'backupDesc': 'Export your entire bibliographic catalog with notes and references in standardized JSON format or restore a previous backup.',
                'connectionStatus': 'Local Connection Status',
                'checkingOllama': 'Checking Ollama status...',
                'testConnection': 'Test Connection',
                'endpointLabel': 'Ollama API Address',
                'modelLabel': 'Active AI Model',
                'languageLabel': 'Application & AI Language',
                'languagePt': 'Português (Brasil)',
                'languageEn': 'English (US)',
                'tasksTitle': 'Integrated Mechanic Tasks',
                'task1Title': '1. Smart Summary',
                'task1Desc': 'Generates an executive academic summary (2-3 sentences) in Document Inspector.',
                'task2Title': '2. Auto-Tagging & Collection',
                'task2Desc': 'Analyzes title/abstract and classifies into collection and tags via strict JSON.',
                'task3Title': '3. Notes Synthesis',
                'task3Desc': "Button 'Structure Notes' formats quotes and conclusions in Markdown.",
                'task4Title': '4. Semantic Search (Ctrl+K)',
                'task4Desc': 'Translates natural language questions into native State filters.',
                'localPrivate': '100% Local & Private',
                'saveSettings': 'Save Settings',
                'settingsSaved': 'Settings saved'
            },
            'toast': {
                'languageChanged': 'Language changed to English',
                'ollamaOnline': 'Librarian: Connected to Ollama ({model})',
                'ollamaOffline': 'Librarian: Ollama unreachable at {endpoint}',
                'catalogExported': 'Catalog exported successfully',
                'catalogImported': 'Catalog imported successfully ({count} articles)',
                'importInvalidJson': 'Invalid JSON file for catalog'
            },
            'emptyState': {
                'title': 'No documents found',
                'description': 'No papers, books, or articles match your current filter or search criteria.',
                'action': 'Add New Document'
            },
            'librarian': {
                'connected': 'Ollama connected ({count} models detected)',
                'offline': 'Could not connect to local Ollama',
                'fileProtocolNotice': 'Open via http://localhost:8000 (run ./start.sh) to allow local connection',
                'corsNotice': 'CORS restriction detected in Ollama. Run ./start.sh or configure OLLAMA_ORIGINS="*"',
                'serviceDownNotice': 'Make sure Ollama is running (ollama serve).',
                'disconnected': 'Disconnected',
                'activeTitle': 'AI Librarian Active ({model}) - Click to configure',
                'inactiveTitle': 'AI Librarian Disconnected - Click for diagnostics',
                'noModels': 'No models detected (Check Ollama connection)',
                'summarizeSuccess': 'Academic executive summary generated successfully!',
                'summarizeError': 'Error generating summary: {error}',
                'classifySuccess': 'Librarian: +{count} tags assigned and categorized under "{collection}"',
                'classifyError': 'Error suggesting tags/collection: {error}',
                'structureSuccess': 'Notes structured in Academic Reading standard!',
                'structureError': 'Error structuring notes: {error}',
                'semanticApplied': '🤖 AI Librarian: {explanation}',
                'semanticError': 'Semantic search error: {error}',
                'semanticCleared': 'Semantic filter cleared',
                'noDocSelected': 'No document selected for inspection',
                'emptyResponse': 'Model returned empty response.',
                'userCancelled': 'Generation cancelled by user.'
            },
            'table': {
                'colTitle': 'Title & Reference',
                'colCollection': 'Collection',
                'colYear': 'Year',
                'colTags': 'Tags',
                'colActions': 'Actions'
            }
        }
    };

    window.Lexicon.I18n = {
        locale: localStorage.getItem('lexicon_locale') || 'pt-BR',
        translations,

        /**
         * Initialize i18n subsystem
         */
        init() {
            this.setLocale(this.locale, false);
        },

        /**
         * Translate a dot-notated key with optional interpolated params
         * e.g. t('collections.createdToast', { name: 'AI Papers' })
         */
        t(key, params = {}) {
            const loc = translations[this.locale] ? this.locale : 'pt-BR';
            let val = key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined) ? obj[k] : null, translations[loc]);

            // Fallback to pt-BR if missing in en-US
            if (val === null && loc !== 'pt-BR') {
                val = key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined) ? obj[k] : null, translations['pt-BR']);
            }

            if (val === null || val === undefined) {
                return key;
            }

            if (typeof val === 'string' && params && typeof params === 'object') {
                return val.replace(/\{(\w+)\}/g, (_, k) => params[k] !== undefined ? params[k] : `{${k}}`);
            }

            return val;
        },

        /**
         * Switch active language
         */
        setLocale(newLocale, notify = true) {
            if (!translations[newLocale]) {
                newLocale = 'pt-BR';
            }
            this.locale = newLocale;
            try {
                localStorage.setItem('lexicon_locale', newLocale);
            } catch (e) {
                console.warn('Unable to persist locale in localStorage:', e);
            }

            document.documentElement.lang = newLocale === 'pt-BR' ? 'pt-BR' : 'en';

            this.translateDOM();
            this.updateLanguageButtons();

            // Update state currentFilter title if it's a standard category
            const state = window.Lexicon.State;
            if (state && state.currentFilter && state.currentFilter.type === 'category') {
                state.currentFilter.title = this.t(`nav.${state.currentFilter.value}`);
            }

            if (window.Lexicon.Collections && typeof window.Lexicon.Collections.render === 'function') {
                window.Lexicon.Collections.render();
                window.Lexicon.Collections.populateSelects();
            }

            if (window.Lexicon.Articles && typeof window.Lexicon.Articles.render === 'function') {
                window.Lexicon.Articles.render();
            }

            if (notify && window.Lexicon.UI && window.Lexicon.UI.Toast) {
                window.Lexicon.UI.Toast.show(this.t('toast.languageChanged'), 'success');
            }
        },

        /**
         * Update language toggle visual state in topbar and settings modal
         */
        updateLanguageButtons() {
            const isPt = this.locale === 'pt-BR';
            const btnPt = document.getElementById('lang-btn-pt');
            const btnEn = document.getElementById('lang-btn-en');
            const settingsSelect = document.getElementById('settings-language-select');

            if (btnPt && btnEn) {
                if (isPt) {
                    btnPt.className = 'px-2 py-0.5 rounded-md bg-jungle text-white font-bold shadow-2xs transition-all cursor-pointer';
                    btnEn.className = 'px-2 py-0.5 rounded-md text-earth hover:text-soil transition-all cursor-pointer';
                } else {
                    btnPt.className = 'px-2 py-0.5 rounded-md text-earth hover:text-soil transition-all cursor-pointer';
                    btnEn.className = 'px-2 py-0.5 rounded-md bg-jungle text-white font-bold shadow-2xs transition-all cursor-pointer';
                }
            }

            const cardPt = document.getElementById('lang-card-pt');
            const cardEn = document.getElementById('lang-card-en');
            const checkPt = document.querySelector('.lang-check-pt');
            const checkEn = document.querySelector('.lang-check-en');

            if (cardPt && cardEn) {
                if (isPt) {
                    cardPt.className = 'p-3.5 rounded-xl border-2 border-jungle bg-jungle/5 text-left flex items-start justify-between gap-3 transition-all cursor-pointer shadow-xs';
                    cardEn.className = 'p-3.5 rounded-xl border border-wood/80 hover:border-earth bg-paper text-left flex items-start justify-between gap-3 transition-all cursor-pointer';
                    if (checkPt) checkPt.classList.remove('hidden');
                    if (checkEn) checkEn.classList.add('hidden');
                } else {
                    cardPt.className = 'p-3.5 rounded-xl border border-wood/80 hover:border-earth bg-paper text-left flex items-start justify-between gap-3 transition-all cursor-pointer';
                    cardEn.className = 'p-3.5 rounded-xl border-2 border-jungle bg-jungle/5 text-left flex items-start justify-between gap-3 transition-all cursor-pointer shadow-xs';
                    if (checkPt) checkPt.classList.add('hidden');
                    if (checkEn) checkEn.classList.remove('hidden');
                }
            }

            if (settingsSelect) {
                settingsSelect.value = this.locale;
            }
        },

        /**
         * Scan DOM and translate all elements marked with data-i18n attributes
         */
        translateDOM() {
            // Text Content
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.dataset.i18n;
                if (key) {
                    el.textContent = this.t(key);
                }
            });

            // HTML Content
            document.querySelectorAll('[data-i18n-html]').forEach(el => {
                const key = el.dataset.i18nHtml;
                if (key) {
                    el.innerHTML = this.t(key);
                }
            });

            // Placeholders
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.dataset.i18nPlaceholder;
                if (key) {
                    el.placeholder = this.t(key);
                }
            });

            // Tooltips / Titles
            document.querySelectorAll('[data-i18n-title]').forEach(el => {
                const key = el.dataset.i18nTitle;
                if (key) {
                    el.title = this.t(key);
                }
            });

            // Update sort select options
            const sortSelect = document.getElementById('sort-select');
            if (sortSelect) {
                const curVal = sortSelect.value;
                sortSelect.innerHTML = `
                    <option value="date-desc">${this.t('sort.newest')}</option>
                    <option value="date-asc">${this.t('sort.oldest')}</option>
                    <option value="title-asc">${this.t('sort.title')}</option>
                    <option value="year-desc">${this.t('sort.year')}</option>
                `;
                sortSelect.value = curVal;
            }
        },

        /**
         * Provide localized prompts for LLM interactions in Ollama
         */
        getPrompt(type, data = {}) {
            const isPt = this.locale === 'pt-BR';

            if (type === 'summarize') {
                if (isPt) {
                    return `Você é um bibliotecário acadêmico sênior do Lexicon.
Com base nas informações do documento a seguir, gere um resumo executivo acadêmico estritamente entre 2 e 3 frases.
O resumo deve sintetizar com clareza e rigor:
1. O objeto de pesquisa e motivação central;
2. A metodologia, técnica ou abordagem teórica utilizada;
3. As principais conclusões ou contribuições científicas alcançadas.

Responda unicamente com as 2 a 3 frases do resumo, em tom acadêmico formal e no mesmo idioma predominante do documento (português por padrão se estiver em português). Sem introduções como "Aqui está o resumo" ou aspas.

Dados do Documento:
${data.docContext}`;
                } else {
                    return `You are a senior academic research librarian at Lexicon.
Based on the document information below, generate an executive academic summary strictly between 2 and 3 sentences.
The summary must clearly and rigorously synthesize:
1. The research subject and core motivation;
2. The methodology, technique, or theoretical framework applied;
3. The main findings or scientific contributions achieved.

Respond only with the 2 to 3 sentences of the summary, in a formal academic tone and in the predominant language of the document (English by default). Without introductions like "Here is the summary" or quotation marks.

Document Information:
${data.docContext}`;
                }
            }

            if (type === 'tagAndCollection') {
                if (isPt) {
                    return `Você é o Bibliotecário IA do Lexicon, especializado em classificação arquivística e catalogação bibliográfica.
Analise os metadados do documento abaixo e determine:
1. A coleção temática ideal (escolha uma das existentes ou sugira um nome curto de 2 a 3 palavras);
2. De 2 a 4 tags conceituais em minúsculas (sem o caractere #).

Coleções existentes no sistema: [${data.collections.map(c => `"${c}"`).join(', ')}]
Tags frequentes no sistema: [${data.tags.map(t => `"${t}"`).join(', ')}]

Documento:
${data.docContext}

Retorne estritamente um objeto JSON no formato:
{
  "collection": "Nome da Coleção",
  "tags": ["tag1", "tag2", "tag3"],
  "reason": "Justificativa concisa em 1 frase"
}`;
                } else {
                    return `You are the Lexicon AI Librarian, specialized in bibliographic archival cataloging.
Analyze the document metadata below and determine:
1. The ideal thematic collection (choose one of the existing ones or suggest a concise 2-3 word name);
2. 2 to 4 conceptual lowercase tags (without #).

Existing collections in system: [${data.collections.map(c => `"${c}"`).join(', ')}]
Frequent tags in system: [${data.tags.map(t => `"${t}"`).join(', ')}]

Document:
${data.docContext}

Return strictly a JSON object formatted as:
{
  "collection": "Collection Name",
  "tags": ["tag1", "tag2", "tag3"],
  "reason": "Concise 1-sentence rationale"
}`;
                }
            }

            if (type === 'structureNotes') {
                if (isPt) {
                    return `Você é um assistente de pesquisa acadêmica para o software Lexicon.
Com base nas anotações preliminares ou metadados a seguir, elabore uma estrutura de fichamento de leitura rigorosa e profissional em Markdown.

Diretrizes de Formatação:
- Utilize cabeçalhos Markdown claros (## 📌 Tese Central & Objetivos, ## 🔬 Metodologia & Abordagem, ## 💡 Achados & Evidências Principais, ## 💬 Citações & Trechos Relevantes, ## 🧠 Reflexões Críticas & Conexões).
- Mantenha quaisquer anotações originais do pesquisador devidamente incorporadas e aprimoradas.
- Se não houver anotações prévias, crie um esqueleto analítico com pontos reflexivos baseados no título e resumo.
- Não invente dados numéricos não fornecidos.
- Responda apenas com o texto Markdown formatado, sem introduções.

Metadados do Documento:
${data.docContext}`;
                } else {
                    return `You are an academic research assistant for Lexicon software.
Based on the preliminary notes and metadata below, create a structured, rigorous reading note (fichamento) in Markdown.

Formatting Guidelines:
- Use clear Markdown headers (## 📌 Core Thesis & Objectives, ## 🔬 Methodology & Framework, ## 💡 Key Findings & Evidence, ## 💬 Relevant Quotes, ## 🧠 Critical Reflections & Connections).
- Preserve and enhance any original notes written by the researcher.
- If no previous notes exist, create an analytical outline with guiding questions based on the title and summary.
- Do not fabricate metrics or factual citations not provided.
- Respond only with the formatted Markdown text, without greetings.

Document Metadata:
${data.docContext}`;
                }
            }

            if (type === 'semanticSearch') {
                if (isPt) {
                    return `Você é o Bibliotecário IA do Lexicon. O pesquisador fez uma busca em linguagem natural no catálogo:
"${data.query}"

Traduza a intenção da busca em parâmetros de filtro estritos para o catálogo de documentos.
Metadados disponíveis no sistema:
- Categorias de Status: "inbox" (caixa de entrada), "reading" (lendo atualmente), "processing" (em fichamento), "favorites" (favoritos), "archived" (lidos / concluídos / arquivados), "recent" (recentes), ou null para todos.
- Coleções existentes: [${data.collections.map(c => `"${c}"`).join(', ')}]
- Tags existentes: [${data.tags.slice(0, 30).map(t => `"${t}"`).join(', ')}]
- Anos no acervo: [${data.years.slice(0, 20).join(', ')}]

Instruções de Mapeamento:
1. Se o usuário disser "que li", "lidos", "concluídos", o status é "archived" (ou "reading" se "estou lendo").
2. Se o usuário disser "favoritos" ou "preferidos", status é "favorites".
3. Se houver menção explícita a ano (ex: 2024, 2023), preencha o campo "year".
4. Extraia o termo principal da pesquisa conceitual em "textQuery" (sem stopwords ou comandos de status).
5. Se identificar uma tag ou coleção específica correspondente, preencha.

Retorne estritamente um JSON com a estrutura:
{
  "textQuery": "termo central de busca ou vazio",
  "year": 2024,
  "status": "archived",
  "collection": null,
  "tag": null,
  "explanation": "Filtrando por ano 2024 e termo em lidos"
}`;
                } else {
                    return `You are the Lexicon AI Librarian. The researcher searched the catalog in natural language:
"${data.query}"

Translate the search intent into strict filter parameters for the document catalog.
Available metadata in the system:
- Status Categories: "inbox", "reading", "processing", "favorites", "archived" (completed/read), "recent", or null for all.
- Existing collections: [${data.collections.map(c => `"${c}"`).join(', ')}]
- Existing tags: [${data.tags.slice(0, 30).map(t => `"${t}"`).join(', ')}]
- Years in library: [${data.years.slice(0, 20).join(', ')}]

Mapping Instructions:
1. If the user says "that I read", "completed", "read", status is "archived" (or "reading" if currently reading).
2. If the user says "favorites", status is "favorites".
3. If there is explicit mention of a year, set the "year" field.
4. Extract the core conceptual search query into "textQuery" (without stopwords or status commands).
5. If a matching tag or collection is identified, populate it.

Return strictly a JSON with structure:
{
  "textQuery": "core query term or empty",
  "year": 2024,
  "status": "archived",
  "collection": null,
  "tag": null,
  "explanation": "Filtering by year 2024 and term in read references"
}`;
                }
            }

            return '';
        }
    };
})();
