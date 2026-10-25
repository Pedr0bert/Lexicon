# Lexicon — Relatório de Avaliação Técnica, Diagnóstico e Plano de Soluções

> **Versão Avaliada:** Lexicon v4_AI (Arquitetura Vanilla ES6 + LocalStorage/IndexedDB + Local Ollama Agent)  
> **Data:** 12 de Setembro de 2026  
> **Objetivo:** Fornecer um diagnóstico arquitetural e de produto completo, mapeando pontos fortes, vulnerabilidades, recursos ausentes e planos de ação técnicos detalhados para cada gap identificado.

---

## 📑 Sumário

1. [Visão Geral & Diagnóstico Executivo](#1-visão-geral--diagnóstico-executivo)
2. [Pontos Fortes da Implementação Atual](#2-pontos-fortes-da-implementação-atual)
3. [Diagnóstico: O que Está Faltando (Gaps Críticos) & Soluções Propostas](#3-diagnóstico-o-que-está-faltando-gaps-críticos--soluções-propostas)
   - [3.1 Extração Real de Texto de PDFs e Metadados Embutidos](#31-extração-real-de-texto-de-pdfs-e-metadados-embutidos)
   - [3.2 Resolução Automática de Metadados via DOI, ISBN e arXiv](#32-resolução-automática-de-metadados-via-doi-isbn-e-arxiv)
   - [3.3 Gestão, Formatação e Exportação de Citações (BibTeX, ABNT, APA, RIS)](#33-gestão-formatação-e-exportação-de-citações-bibtex-abnt-apa-ris)
   - [3.4 Visualizador Integrado com Marca-texto e Notas Conectadas](#34-visualizador-integrado-com-marca-texto-e-notas-conectadas)
   - [3.5 Rede de Notas Conectadas (Zettelkasten e [[Wikilinks]])](#35-rede-de-notas-conectadas-zettelkasten-e-wikilinks)
   - [3.6 Suporte Real a Livros em Formato EPUB](#36-suporte-real-a-livros-em-formato-epub)
4. [Diagnóstico: Onde Pode Melhorar & Soluções Propostas](#4-diagnóstico-onde-pode-melhorar--soluções-propostas)
   - [4.1 Correção de Vulnerabilidade de Aspas e Handlers Inline (Event Delegation)](#41-correção-de-vulnerabilidade-de-aspas-e-handlers-inline-event-delegation)
   - [4.2 Evolução da IA: Respostas em Streaming (SSE) e Chat com o Documento](#42-evolução-da-ia-respostas-em-streaming-sse-e-chat-com-o-documento)
   - [4.3 Busca Semântica Vetorial Real com Embeddings Locais (RAG)](#43-busca-semântica-vetorial-real-com-embeddings-locais-rag)
   - [4.4 Dashboard de Métricas de Leitura e Produtividade Científica](#44-dashboard-de-métricas-de-leitura-e-produtividade-científica)
   - [4.5 Padronização e Internacionalização de Idioma (i18n)](#45-padronização-e-internacionalização-de-idioma-i18n)
   - [4.6 Tratamento de Falhas e Assistente de Instalação do Ollama](#46-tratamento-de-falhas-e-assistente-de-instalação-do-ollama)
5. [Matriz de Priorização e Cronograma de Execução](#5-matriz-de-priorização-e-cronograma-de-execução)

---

## 1. Visão Geral & Diagnóstico Executivo

O **Lexicon v4_AI** é uma aplicação *local-first*, *zero-build* e focada em privacidade, desenhada para pesquisadores, acadêmicos e leitores intensivos. Seu modelo operacional baseia-se em:
* Execução direta no navegador via ES6 nativo, sem etapas de compilação ou empacotamento (`npm`, `vite`, `webpack`).
* Armazenamento em duas camadas: catálogo e metadados estruturados no IndexedDB (`LexiconFilesDB`), e armazenamento de arquivos binários (PDFs/EPUBs) diretamente no IndexedDB, eliminando restrições do LocalStorage tradicional.
* Delegação da renderização de PDFs ao leitor nativo do navegador via *Blob URLs* epêmeros.
* Integração com modelos LLM locais (Ollama) por meio de um proxy reverso transparente em Python padrão (`server.py`), superando bloqueios de CORS e PNA (*Private Network Access*).

**Diagnóstico Geral:** A fundação técnica e visual da aplicação é de excelente qualidade. No entanto, o sistema ainda atua mais como um *catalogador inteligente de arquivos* do que como uma *estação de trabalho de pesquisa integrada*. Faltam mecanismos essenciais para ler o interior dos arquivos, resolver dados bibliográficos online e exportar citações acadêmicas padronizadas.

---

## 2. Pontos Fortes da Implementação Atual

* **Arquitetura Zero-Build:** Portabilidade extrema. Clonar o repositório e executar `./start.sh` inicia o servidor e abre a aplicação imediatamente.
* **Design Editorial de Alto Nível:** O tema *Warm Academic Paper* com paleta de cores botânicas/terrosas (`sand`, `clay`, `wood`, `earth`, `soil`, `jungle`, `terracotta`) e fontes *Merriweather* e *Inter* proporciona conforto visual prolongado.
* **Funil de Produtividade Acadêmico:** O fluxo **Inbox → Reading List → Fichamento & Notes → Archived / Favorites** organiza perfeitamente o ciclo de vida da leitura científica.
* **Histórico SPA Completo:** O módulo `navigation.js` oferece navegação estilo navegador (pilhas `historyStack`/`forwardStack`, atalhos `Alt + ←` / `Alt + →` e botões visuais sincronizados).
* **Operações em Lote:** A barra flutuante de ações em lote permite mover artigos, atribuir tags, alterar status e criar novas coleções a partir da seleção de múltiplos documentos.
* **Importação Inteligente de Diretórios:** Leitura recursiva de pastas e arquivos via `webkitGetAsEntry`, recriando pastas como coleções e atribuindo tags automáticas.
* **Mitigação de Perda de Dados:** O *Reset Wizard* em 3 passos com confirmação textual explícita (`RESET`) previne perda inadvertida de dados de pesquisa.

---

## 3. Diagnóstico: O que Está Faltando (Gaps Críticos) & Soluções Propostas

### 3.1 Extração Real de Texto de PDFs e Metadados Embutidos

#### O Problema
Ao importar um PDF, o sistema utiliza apenas expressões regulares sobre o nome do arquivo para adivinhar título e ano (`cleanTitle` e `extractYear`). Se um PDF tiver o nome `1-s2.0-S014067362300123X-main.pdf`, o título vira essa sequência alfanumérica.
Além disso, quando o usuário clica em **"Resumir com IA"**, se não houver resumo prévio digitado, o modelo de IA recebe apenas o título e o nome do arquivo, sem acesso ao abstract ou ao texto real das páginas.

#### Possíveis Soluções
1. **Solução A (Web Worker no Frontend com PDF.js Text Extractor — Recomendada):**
   * Integrar a versão mínima do `pdf.js` (`pdfjs-dist/build/pdf.min.js` e `pdf.worker.min.js`) sem o renderizador de canvas.
   * Ao selecionar ou soltar um arquivo, um Web Worker lê os primeiros 4KB/primeira página:
     * Extrai metadados embutidos do cabeçalho do PDF (`Title`, `Author`, `Subject`, `Keywords`, `CreationDate`).
     * Extrai o texto cru da 1ª e 2ª páginas (onde sempre residem o título, autores e *Abstract*).
     * Armazena uma propriedade `extractedText` (ou `abstractSnippet`) no objeto do artigo no IndexedDB.
   * Ao acionar o botão de resumo da IA, o prompt envia esse texto real extraído, gerando resumos analíticos autênticos.
2. **Solução B (Endpoint no Servidor Python):**
   * Adicionar ao `server.py` um endpoint `POST /api/extract-pdf` usando a biblioteca padrão do Python ou módulo opcional (`pypdf` / `pdfplumber`).
   * *Vantagem:* Rápido e não onera o navegador.
   * *Desvantagem:* Perde a capacidade offline estrita se o usuário rodar Lexicon via outro servidor web estático.

---

### 3.2 Resolução Automática de Metadados via DOI, ISBN e arXiv

#### O Problema
O campo DOI atual é apenas um campo de texto que monta um link externo para `https://doi.org/...`. O pesquisador precisa digitar manualmente título, revista, autores, ano e resumo de cada artigo.

#### Possíveis Soluções
1. **Botão "Auto-completar Metadados" com CrossRef REST API:**
   * A API pública da CrossRef (`https://api.crossref.org/works/{doi}`) é aberta, gratuita, não exige chave de API e retorna JSON estruturado completo.
   * Implementar no `js/articles.js` a função `fetchMetadataByDOI(doi)`:
     * Lê título oficial (`message.title[0]`).
     * Formata autores no padrão acadêmico (`message.author.map(a => `${a.given} ${a.family}`).join(', ')`).
     * Extrai ano (`message.created['date-parts'][0][0]`), periódico (`message['container-title'][0]`) e *Abstract* (quando disponível via JATS/XML).
2. **Suporte a arXiv e OpenAlex:**
   * Se o identificador começar com `arxiv:` ou `10.48550/arXiv...`, consultar a API do arXiv ou OpenAlex (`https://api.openalex.org/works/https://doi.org/{doi}`).
   * Preencher automaticamente os campos no formulário de upload ou no modal de inspeção com 1 clique.

---

### 3.3 Gestão, Formatação e Exportação de Citações (BibTeX, ABNT, APA, RIS)

#### O Problema
Não há ferramentas de citação. O pesquisador precisa redigir referências bibliográficas à mão ou alternar para outra ferramenta (como Zotero) para citar seus artigos em monografias, dissertações ou artigos científicos.

#### Possíveis Soluções
1. **Exportador BibTeX (`.bib`):**
   * Criar o utilitário `window.Lexicon.Citation.toBibTeX(article)`:
     ```bibtex
     @article{tropica2024canopy,
       title = {Canopy Ecology and Systems Dynamics in Humid Tropical Forests},
       author = {Tropica, Elena and Thorne, David and Alvarez, S.},
       journal = {Journal of Tropical Forest Science},
       year = {2024},
       doi = {10.1016/j.jtfsci.2024.01.004}
     }
     ```
   * Adicionar botão no Inspector para baixar `.bib` individual e na barra de ações em lote para exportar todos os itens selecionados em um arquivo `.bib` consolidado.
2. **Cópia Rápida Formatada (ABNT NBR 6023, APA 7ª ed., Chicago):**
   * No cabeçalho do Inspector, adicionar menu *"Copiar Referência"*:
     * **ABNT:** `TROPICA, E.; THORNE, D.; ALVAREZ, S. Canopy Ecology and Systems Dynamics in Humid Tropical Forests. Journal of Tropical Forest Science, 2024. DOI: 10.1016/j.jtfsci.2024.01.004.`
     * **APA 7:** `Tropica, E., Thorne, D., & Alvarez, S. (2024). Canopy Ecology and Systems Dynamics in Humid Tropical Forests. Journal of Tropical Forest Science. https://doi.org/10.1016/j.jtfsci.2024.01.004`
3. **Exportação RIS (`.ris`):**
   * Formato padrão para importação direta em Zotero, Mendeley e EndNote.

---

### 3.4 Visualizador Integrado com Marca-texto e Notas Conectadas

#### O Problema
Atualmente, o botão `READ` abre o documento na aba nativa do navegador (`window.open(objectUrl, '_blank')`). Embora ágil e com aceleração gráfica nativa, ela desconecta o leitor do Lexicon: anotações, grifos ou trechos copiados não são sincronizados de volta ao fichamento do artigo.

#### Possíveis Soluções
1. **Modo Duplo / Split-View Opcional (Leitor Integrado + Fichamento Lateral):**
   * Oferecer duas opções ao usuário:
     * *Abrir em Aba Nativa* (para quem prefere o leitor nativo padrão com atalhos do navegador).
     * *Abrir no Painel de Leitura Integrado* (modal maximizado ou tela cheia com split-view):
       * Lado esquerdo (65% da largura): renderizador PDF embutido (ou `<iframe>` apontando para o blob do PDF com viewer nativo embutido).
       * Lado direito (35% da largura): painel com as notas de fichamento em Markdown do artigo e ferramentas de IA abertas lado a lado.
   * O texto selecionado no PDF pode contar com o atalho *"Adicionar às Notas como Citação"* (inserindo `> "trecho selecionado"` no campo de notas com timestamp).

---

### 3.5 Rede de Notas Conectadas (Zettelkasten e [[Wikilinks]])

#### O Problema
As notas de fichamento residem isoladas em cada artigo. O método acadêmico moderno (Zettelkasten) exige cruzar evidências entre diferentes autores e publicações.

#### Possíveis Soluções
1. **Parser de [[Wikilinks]] no Editor de Fichamento:**
   * No `js/articles.js`, estender a renderização de notas com parser que reconheça referências no formato `[[1700000002]]` ou `[[Mycelial Algorithms]]`.
   * Na visualização, o link se torna clicável e abre o artigo referenciado no Inspector com 1 clique.
2. **Menu de Autocomplete no Editor:**
   * Ao digitar `[[` no campo `#inspector-notes`, abrir um popup com sugestões dos títulos dos artigos existentes na biblioteca.
3. **Painel de Citações Reversas (Backlinks):**
   * No Inspector de um documento, exibir a seção: *"Mencionado nas notas de:"*, listando quais outros artigos citam este documento.

---

### 3.6 Suporte Real a Livros em Formato EPUB

#### O Problema
A interface possui ícones e indicações de suporte a livros (`coverType: 'book'`), mas os navegadores web não têm suporte nativo para ler arquivos `.epub`. Ao tentar abrir via `URL.createObjectURL(blob)`, o navegador simplesmente baixa o arquivo em vez de exibi-lo.

#### Possíveis Soluções
1. **Integração do `ePub.js` (Biblioteca pura de renderização):**
   * Adicionar o script `epub.min.js` na pasta `js/vendor/`.
   * Quando o documento for `.epub`, abrir um modal de leitura com paginação, ajuste de fonte (serif/sans), tamanho de texto e navegação pelo índice de capítulos (TOC).

---

## 4. Diagnóstico: Onde Pode Melhorar & Soluções Propostas

### 4.1 Correção de Vulnerabilidade de Aspas e Handlers Inline (Event Delegation)

#### O Problema
Em múltiplos locais em `collections.js` e `articles.js`, o código HTML gerado interpola nomes diretamente dentro de atributos `onclick="... 'STRING' ..."`:
```javascript
// js/collections.js (linha 129)
<button onclick="event.stopPropagation(); Lexicon.Collections.toggleSidebarCollectionExpand('${col.name}')">

// js/articles.js (linha 1086)
<button type="button" onclick="Lexicon.Articles.removeTagFromInspected('${window.Lexicon.Utils.escapeHTML(tag)}')">
```
A função atual `escapeHTML` usa `div.textContent`, que **não escapa aspas simples (`'`)**. Se uma coleção ou tag contiver apóstrofo (ex: `O'Reilly`, `Author's Pick`, `L'Écologie`), o navegador gera o erro fatal:
`Uncaught SyntaxError: Unexpected identifier 'Reilly'`.

#### Solução Técnica
1. **Aprimorar o `escapeHTML` para cobrir aspas e apóstrofos:**
   ```javascript
   window.Lexicon.Utils = {
       escapeHTML(str) {
           if (str === null || str === undefined) return '';
           return String(str)
               .replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#39;');
       }
   };
   ```
2. **Migrar para Atributos de Dados (`data-*`) e Event Delegation:**
   Substituir chamadas inline com strings dinâmicas por `data-collection-id="${col.id}"` e capturar eventos através de um único *listener* no container pai (`#collections-list`). Isso é mais seguro, mais limpo e imune a falhas de interpretação de caracteres.

---

### 4.2 Evolução da IA: Respostas em Streaming (SSE) e Chat com o Documento

#### O Problema
1. O método `callOllama` em `js/ai.js` utiliza `stream: false`. Modelos locais médios (Qwen 7B, Llama 3 8B, Mistral) levam entre 15 e 40 segundos para responder dependendo do hardware do usuário. O botão fica estático em *"Resumindo..."*, transmitindo sensação de travamento da aplicação.
2. A IA está restrita a botões predefinidos (Resumir, Auto-Tags, Estruturar Notas). Não há como o pesquisador dialogar livremente com o documento.

#### Soluções Propostas
1. **Implementação de Streaming via Fetch com `ReadableStream`:**
   * Configurar `stream: true` na chamada ao Ollama.
   * Ler os chunks retornados com `response.body.getReader()`, decodificar os tokens e atualizar o `<textarea>` em tempo real (efeito máquina de escrever).
2. **Aba "Chat com o Documento" no Inspector:**
   * Adicionar uma aba de chat lateral no Inspector Modal:
     * O pesquisador digita: *"Quais as principais limitações metodológicas apontadas?"*
     * O sistema envia a pergunta combinada ao contexto do documento (resumo, notas, texto extraído).
     * O modelo responde com citações e síntese analítica diretamente no painel.

---

### 4.3 Busca Semântica Vetorial Real com Embeddings Locais (RAG)

#### O Problema
A "busca semântica" atual é baseada em uma heurística onde o Ollama extrai palavras-chave do prompt do usuário e o sistema aplica um filtro comum com `.includes()`. Se o usuário buscar por *"inteligência artificial na medicina"* e o artigo falar em *"algoritmos neurais para diagnóstico clínico"*, a busca não encontra correspondência porque nenhuma palavra é idêntica.

#### Soluções Propostas
1. **Geração de Embeddings com Ollama (`/api/embeddings`):**
   * Utilizar um modelo leve de embeddings disponível no Ollama (ex: `nomic-embed-text` ou `all-minilm`).
   * Ao cadastrar um documento ou gerar resumo, calcular o vetor de embedding (384 ou 768 dimensões) e salvar no IndexedDB.
2. **Similaridade de Cosseno em JavaScript:**
   * Ao realizar a busca, gerar o vetor da pergunta do usuário e calcular a similaridade de cosseno em memória contra os vetores dos documentos da biblioteca (operação com complexidade $O(N)$ quase instantânea para até 50.000 artigos).
   * Ordenar e exibir os documentos com os maiores índices de relevância semântica real.

---

### 4.4 Dashboard de Métricas de Leitura e Produtividade Científica

#### O Problema
Não há uma visão analítica consolidada do progresso da pesquisa. O usuário não sabe quantos artigos leu no mês, quanto tempo leva para processar um artigo da caixa de entrada, nem a distribuição das suas áreas de estudo.

#### Soluções Propostas
1. **Nova Rota de Navegação: `Dashboard & Insights`:**
   * Adicionar à barra lateral o item **"Estatísticas de Pesquisa"**.
   * Painéis visuais (com micro-gráficos SVG leves, mantendo a regra de zero dependências):
     * **Pipeline Funnel:** Quantidade de itens em *Inbox*, *Reading*, *Processing* e *Archived*.
     * **Ritmo de Leitura:** Artigos arquivados por mês (gráfico de barras simples).
     * **Nuvem de Tópicos:** As 15 tags mais frequentes com contagem proporcional.
     * **Tempo Médio de Permanência:** Média de dias entre `addedDate` e arquivamento.

---

### 4.5 Padronização e Internacionalização de Idioma (i18n)

#### O Problema
A interface principal está em inglês (*Workflow, Reading List, Collections & Folders, Summary & Abstract, Reset Sample Data*), enquanto os diálogos, mensagens de toast e botões do Bibliotecário IA estão em português (*"Resumir com IA"*, *"Estruturar Notas"*, *"Ollama não conectado"*).

#### Soluções Propostas
1. **Dicionário Central de Textos (`js/i18n.js`):**
   * Criar objeto de internacionalização com suporte a `pt-BR` e `en-US`:
     ```javascript
     window.Lexicon.I18n = {
         locale: localStorage.getItem('lexicon_locale') || 'pt-BR',
         t(key) { ... }
     };
     ```
   * Permitir alternar o idioma nas configurações do sistema, sincronizando tanto a interface visual quanto os prompts de comando do Bibliotecário IA.

---

### 4.6 Tratamento de Falhas e Assistente de Instalação do Ollama

#### O Problema
Se o usuário ainda não tiver o Ollama instalado ou executando, a barra superior apenas exibe um ponto vermelho de status. Usuários não técnicos podem ter dificuldade para entender quais comandos devem executar no terminal.

#### Soluções Propostas
1. **Assistente de Onboarding de IA no Modal de Configurações:**
   * No modal `#librarian-settings-modal`, exibir instruções contextuais baseadas no sistema operacional detectado:
     * Comando para instalar: `curl -fsSL https://ollama.com/install.sh | sh`
     * Comando para iniciar: `ollama serve`
     * Comando para baixar o modelo recomendado: `ollama pull qwen2.5-coder:1.5b`
   * Botão com 1 clique para copiar os comandos necessários.

---

## 5. Matriz de Priorização e Cronograma de Execução

| Fase | Foco | Tarefas Incluídas | Complexidade | Prazo Estimado |
| :--- | :--- | :--- | :--- | :--- |
| **Sprint 1** | **Segurança & Quick Wins** | • Correção definitiva do escaping de aspas (`escapeHTML` e data attributes)<br>• Consulta automática de metadados por DOI (API CrossRef)<br>• Exportação de citações em BibTeX (`.bib`) e cópia ABNT/APA | Baixa | 1 a 2 dias |
| **Sprint 2** | **Extração de Dados & Leitura** | • Extrator leve de texto de PDF no navegador (1ª e 2ª páginas para abstract)<br>• Alimentação do "Resumir com IA" com o texto extraído real<br>• Streaming de respostas (SSE) na chamada ao Ollama | Média | 3 a 5 dias |
| **Sprint 3** | **Estação de Trabalho & Notas** | • Chat interativo com o artigo inspecionado ("Pergunte ao Paper")<br>• Suporte a [[Wikilinks]] entre artigos no fichamento<br>• Visualizador integrado em Split-View (PDF + Fichamento lado a lado) | Média | 5 a 7 dias |
| **Sprint 4** | **Pesquisa Avançada & Insights** | • Busca semântica real via Embeddings vetoriais locais (RAG com Ollama)<br>• Leitor de livros EPUB integrado (`epub.js`)<br>• Dashboard analítico de métricas de pesquisa | Alta | 7 a 10 dias |

---

## 6. Conclusão

O **Lexicon** possui uma das arquiteturas de software mais elegantes do ecossistema moderno: zero dependências de compilação, privacidade local absoluta, carregamento instantâneo e interface acolhedora. 

Com a implementação das correções de segurança de sintaxe e a inclusão das ferramentas acadêmicas primárias (**DOI lookup**, **extração real de texto de PDF** e **geração de citações BibTeX/ABNT**), a aplicação passará de um visualizador e organizador de arquivos para uma **estação de pesquisa científica de primeira classe**, capaz de competir diretamente com softwares consolidados do meio acadêmico, mantendo a autonomia e privacidade de dados locais.
