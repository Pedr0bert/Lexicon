# Lexicon — Painel de Tarefas e Progresso (tasks.md)

> **Documento de Controle de Progresso do Projeto**  
> **Aplicação:** Lexicon (Intelligent Research Library & Document Manager)  
> **Arquitetura:** *Local-first*, *Zero-build*, Vanilla JS, Web APIs Nativas e Ollama Local.  
> **Última Atualização:** 12/09/2026

---

## 📊 Visão Geral do Progresso

| Fase | Título | Status | Progresso |
| :--- | :--- | :---: | :---: |
| **Fase 1** | Estabilidade, Segurança, Configurações & i18n | ✅ **CONCLUÍDO** | 100% |
| **Fase 2** | Automação Acadêmica (DOI, BibTeX, ABNT/APA, RIS) | ✅ **CONCLUÍDO** | 100% |
| **Fase 3** | Leitura (Split-View), Extração PDF, Zettelkasten (`[[Wikilinks]]`), EPUB & Dashboard | ✅ **CONCLUÍDO** | 100% |
| **Fase 4** | IA Avançada, RAG Local, Embeddings & Streaming | ⏳ **PRÓXIMA** | 0% |

---

## 🚀 FASE 1: Estabilidade, Segurança, Configurações & i18n
**Status:** ✅ **100% CONCLUÍDO**

- [x] **1.1 Correção Definitiva de Escaping de Aspas**
  - [x] Atualização de `window.Lexicon.Utils.escapeHTML` em `js/utils.js` e `js/app.js` tratando `&quot;` e `&#39;`.
  - [x] Prevenção de quebras de layout e XSS ao injetar títulos e resumos com aspas no DOM.
- [x] **1.2 Eliminação de Handlers Inline com Interpolação Frágil**
  - [x] Substituição de strings dinâmicas concatenadas em `onclick` por atributos `data-*` e Delegação de Eventos.
- [x] **1.3 Consistência de Estado e Limpeza de Filtros**
  - [x] Sincronização e reset limpo de tags ativas e busca ao alternar categorias ou pastas.
  - [x] Histórico de navegação sem loops (`navigation.js`).
- [x] **1.4 Sistema de Internacionalização (i18n)**
  - [x] Criação de `js/i18n.js` com suporte completo a Português (`pt-BR`) e Inglês (`en-US`).
  - [x] Suporte a tags dinâmicas `data-i18n`, `data-i18n-placeholder` e `data-i18n-title`.
  - [x] Prompts do Bibliotecário IA ajustados conforme o idioma ativo.
- [x] **1.5 Modal Dedicado de Configurações (`#librarian-settings-modal`)**
  - [x] Remoção da sobrecarga visual da interface principal.
  - [x] Criação de aba/modal de configurações limpa com alternância de idioma, diagnóstico de conexão com Ollama e seleção de modelos.
  - [x] Correção de z-index, opacidade e classes Tailwind (`.hidden { display: none !important; }`).
- [x] **1.6 Padronização Curta de Nomes sem Mistura de Idiomas**
  - [x] Português: **`Fichamento`** (palavra única, limpa, cabe em 1 linha na barra lateral).
  - [x] Inglês: **`Notes`** (palavra única, sem mistura de termos em português).
  - [x] Atualizado no menu, filtros, dropdown de status, inspetor e exportadores Markdown.
- [x] **1.7 Concorrência e Inicialização Local**
  - [x] `server.py` atualizado com `socketserver.ThreadingTCPServer` para requisições concorrentes sem travamento.
  - [x] `start.sh` com verificação de diretório e subida segura do servidor em segundo plano.

---

## 📚 FASE 2: Automação Acadêmica & Produtividade (DOI & Citações)
**Status:** ✅ **100% CONCLUÍDO**

- [x] **2.1 Lookup Automático de Metadados via DOI (CrossRef API)**
  - [x] Campo de busca / botão *"Buscar Metadados"* ao lado do campo DOI no Inspector e no modal de Adicionar Documento.
  - [x] Integração com a API pública e aberta da CrossRef (`https://api.crossref.org/works/{doi}`) com fallback inteligente para OpenAlex.
  - [x] Preenchimento automático de: Título, Autores formatados, Revista/Periódico, Ano de Publicação, Volume/Issue e Abstract.
- [x] **2.2 Suporte a Identificadores arXiv**
  - [x] Reconhecimento de IDs arXiv (ex: `2301.12345`, `arXiv:2301.12345`, `math/0405076`, `10.48550/arXiv...` e URLs).
  - [x] Consulta multi-estratégia (OpenAlex, API oficial arXiv Export via DOMParser, CrossRef).
- [x] **2.3 Gerador e Exportador BibTeX (`.bib`)**
  - [x] Geração de entradas `@article{...}`, `@book{...}` limpas e padronizadas com citekey semântico a partir dos metadados.
  - [x] Botão de 1 clique para copiar o BibTeX no Document Inspector.
  - [x] Botão para baixar arquivo `.bib` individual.
  - [x] Ação em lote na barra flutuante: *"Exportar Selecionados como BibTeX (.bib)"*.
- [x] **2.4 Cópia Rápida em Padrões Acadêmicos Oficiais (1 Clique)**
  - [x] **ABNT NBR 6023** (padrão brasileiro: `SOBRENOME, Nome. Título...`).
  - [x] **APA 7ª edição** (padrão internacional para periódicos).
  - [x] **Vancouver** (padrão para biomédicas) e **Chicago 17ª ed.** (Author-Date para humanas).
  - [x] Notificação toast com feedback imediato de cópia para a área de transferência com fallback `execCommand`.
- [x] **2.5 Exportação RIS (Interoperabilidade)**
  - [x] Gerador de formato `.ris` para importação direta no Zotero, Mendeley e EndNote.
  - [x] Download individual `.ris` no Document Inspector e exportação em lote na barra flutuante.

---

## 📖 FASE 3: Experiência de Leitura (Split-View), Zettelkasten & Dashboard Analítico
**Status:** ✅ **100% CONCLUÍDO**

- [x] **3.1 Leitor Integrado Split-View (Modo Lado a Lado)**
  - [x] Leitura sem parsers pesados: `<iframe>` com leitor nativo do navegador à esquerda (60% da tela).
  - [x] Editor de Fichamento / Notas em Markdown à direita (40% da tela).
  - [x] Alternância entre visão padrão (modal) e visão imersiva de tela cheia.
- [x] **3.2 Extração Real de Texto de PDFs via Web Worker (`pdf.js` extractor)**
  - [x] Leitura leve das primeiras páginas do PDF no navegador sem recarregar tela.
  - [x] Captura automática do Abstract/Resumo real e metadados internos do PDF para alimentar o resumo da IA.
- [x] **3.3 Rede de Notas Conectadas & Zettelkasten (`[[Wikilinks]]`)**
  - [x] Autocomplete de títulos de artigos ao digitar `[[` no editor de fichamento.
  - [x] Transformação de `[[ID_ou_Titulo]]` em links clicáveis para abrir o artigo no Inspector.
  - [x] Painel de Citações Reversas (Backlinks) mostrando quais notas citam o documento atual.
- [x] **3.4 Suporte a Leitura de Livros em Formato EPUB (`epub.js`)**
  - [x] Visualizador dedicado de arquivos `.epub` com paginação, ajuste de fonte, tema e TOC (índice de capítulos).
- [x] **3.5 Atalho de Citação Rápida**
  - [x] Botão no editor para inserir bloco de citação formatado (`> "trecho citado" (Página X)`) com carimbo de tempo.
- [x] **3.6 Download Estruturado do Fichamento Consolidado**
  - [x] Exportação em Markdown pronto para Obsidian, Notion ou Logseq, com cabeçalho bibliográfico completo no topo.
- [x] **3.7 Dashboard de Métricas & Estatísticas de Leitura**
  - [x] Tela *"Estatísticas & Insights"* na barra lateral.
  - [x] Gráficos SVG nativos leves (zero bibliotecas externas):
    - [x] Funil do Pipeline de Leitura (*Inbox* → *Lendo* → *Fichamento* → *Arquivados*).
    - [x] Ritmo de leitura (artigos concluídos por mês/ano).
    - [x] Distribuição de acervo por coleções e nuvem de tags frequentes.
    - [x] Tempo médio de permanência em cada etapa do funil.

---

## 🤖 FASE 4: IA Avançada, RAG Local, Embeddings & Streaming
**Status:** ⏳ **PENDENTE**

- [ ] **4.1 Streaming em Tempo Real (ReadableStream)**
  - [ ] Respostas do Ollama geradas com `stream: true`.
  - [ ] Efeito máquina de escrever em tempo real, sem espera passiva ou sensação de travamento.
- [ ] **4.2 Painel de Conversação ("Pergunte ao Documento")**
  - [ ] Interface de chat contextualizado com o documento inspecionado (utilizando texto extraído + notas + metadados).
  - [ ] Perguntas direcionadas sobre metodologia, limitações, hipóteses e conclusões do artigo.
- [ ] **4.3 Embeddings Vetoriais Locais**
  - [ ] Integração com modelo de embeddings local no Ollama (ex: `nomic-embed-text` ou `bge-m3`).
  - [ ] Vetorização do título, resumo, texto extraído e notas dos artigos com persistência no IndexedDB.
- [ ] **4.4 Busca Semântica Real (RAG Local)**
  - [ ] Similaridade de cosseno calculada localmente no navegador.
  - [ ] Busca conceitual inteligente mesmo sem correspondência literal de palavras-chave.
- [ ] **4.5 Diagnóstico Visual e Onboarding do Ollama**
  - [ ] Detecção automática de status com instruções e comandos prontos para iniciar o Ollama no sistema.
