# Lexicon — Intelligent Research Library & Document Manager (v3 AI)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)
[![Architecture: Vanilla JS](https://img.shields.io/badge/Architecture-Vanilla%20ES6%20%2B%20Modular-green.svg)](#architecture)
[![AI Agent: Local Ollama](https://img.shields.io/badge/AI%20Agent-Ollama%20Local-8A2BE2.svg)](#ai-librarian-agent)
[![Storage: IndexedDB](https://img.shields.io/badge/Storage-IndexedDB%20%2B%20LocalStorage-amber.svg)](#storage--data-model)
[![Styling: Tailwind CDN](https://img.shields.io/badge/Design-Warm%20Academic%20Paper%20Theme-382923.svg)](#design-system)

**Lexicon v3 AI** is a modern, distraction-free, local-first research library manager designed for academics, researchers, students, and avid readers. It organizes, annotates, and launches academic papers, books, monographs, and PDF documents stored on your local computer with zero latency, zero cloud subscriptions, complete data privacy, and a **built-in Autonomous Academic AI Librarian powered by local Ollama models**.

---

## 🤖 AI Librarian Agent (Local Ollama)

Lexicon v3 introduces a dedicated **Local AI Librarian** executing 4 mechanical academic tasks directly within the user workflow:

1. **✨ Auto-Preenchimento e Resumo Inteligente (Document Inspector):**
   - Synthesizes an executive academic abstract strictly in 2–3 sentences highlighting research problem, methodology, and core conclusions, directly updating `#inspector-summary`.
2. **🏷️ Auto-Tagging e Sugestão de Coleção:**
   - Evaluates paper title, abstract, and user collections via strict JSON to suggest precise tags and allocate into the most appropriate collection (or suggest a coherent new collection).
3. **📝 Síntese de Fichamento (Markdown Assistant):**
   - "Estruturar Notas" toolbar button automatically formats quotes, key takeaways, and critical synthesis in academic Markdown standard.
4. **🔍 Busca Semântica no Catálogo (Ctrl + K):**
   - Translates natural language queries (e.g., *"papers sobre modulação óptica que li em 2024"*) into native filter parameters (year, status, tags, search queries) with instant feedback and persistent filter indicators.

---

## 📑 Table of Contents

- [AI Librarian Agent](#-ai-librarian-agent-local-ollama)
- [Key Features](#-key-features)
- [Project Architecture](#-project-architecture)
- [Detailed User Workflows](#-detailed-user-workflows)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [Storage & Data Model](#-storage--data-model)
- [Quick Start & Running Locally](#-quick-start--running-locally)
- [License](#-license)

---

## ✨ Key Features

- **🔙 Smart Navigation History & Return Arrows:** Full browser-style page history. Use the back/forward arrows in the top header, the contextual back button next to page titles, or keyboard shortcuts (`Alt + ←` / `Alt + →`) to effortlessly return to previous filters, collections, and search queries.
- **📁 Expandable & Reducible Collections:** View collections as a collapsible tree in the sidebar, or open the dedicated **Collections & Folders** workflow view to expand or reduce folder cards and manage documents visually.
- **📥 Intelligent Multi-File & Folder Import:** Drag-and-drop or select individual files, multiple documents, or entire directory trees. Lexicon automatically preserves folder structures, creates collections, and applies tags based on folder names.
- **⚡ Multiple Selection & Floating Batch Bar:** Select multiple items via checkboxes (with a 1-click "Select All" in table view) to change reading status, assign tags, move to existing collections, or **create a brand-new collection directly from selected documents**.
- **📖 Native Browser PDF Reading:** Avoid sluggish embedded readers. Lexicon launches documents in your browser's native, hardware-accelerated viewer with 100% fidelity, vector crispness, search, text selection, and annotation capabilities.
- **📝 Fichamento & Markdown Notes:** Take structured notes for each article with a built-in formatting toolbar (Headers, Quotes, Bold, Lists, Timestamps), debounced auto-saving, and one-click Markdown export.
- **🛡️ 3-Step Reset Confirmation Wizard:** Protects your research against accidental data loss with an intentional 3-step verification modal requiring explicit text confirmation before resetting sample data.
- **🎨 Warm Editorial Theme & Collapsible Sidebar:** Carefully chosen color palette inspired by natural papers and botanical inks, with a smoothly collapsing sidebar that keeps the brand icon cleanly aligned without clipping.
- **🔒 100% Local & Offline:** Files are stored in browser-managed IndexedDB while catalog metadata resides in LocalStorage. No accounts, telemetry, or server setup required.

---

## 🏛️ Project Architecture

Lexicon v2 is built with modular Vanilla JavaScript, avoiding complex toolchains, bundlers, or heavy framework runtimes.

> 📘 **Looking for deep technical specifications?**  
> See [ARCHITECTURE.md](ARCHITECTURE.md) for the complete senior developer specification (state machine schemas, IndexedDB transactional lifecycles, memory invariants, and UML sequence flows).

```
research_library_manager/
└── v2/                                   # Modern Modular Application
    ├── index.html                        # Semantic HTML markup, modals & layout templates
    ├── start.sh                          # One-click background launcher & browser opener
    ├── README.md                         # Product & user documentation
    ├── ARCHITECTURE.md                   # In-depth technical & architectural specification
    ├── css/
    │   └── styles.css                    # Design tokens, typography, glassmorphism, transitions
    └── js/
        ├── state.js                      # Centralized reactive state store
        ├── storage.js                    # IndexedDB binary file store & LocalStorage catalog
        ├── collections.js                # Collections management, tree view & count synchronization
        ├── articles.js                   # Document cards/table, inspector, notes & folder workflows
        ├── navigation.js                 # History stack, forward/back actions & button controllers
        ├── app.js                        # App bootstrap, keyboard listeners, search & file handlers
        └── ui/
            ├── modal.js                  # Modal controller with escape/backdrop handlers & focus trap
            └── toast.js                  # Non-intrusive floating toast notifications
```

### Module Responsibilities

| Module | Purpose |
| :--- | :--- |
| [`js/state.js`](file:///home/pedro/Dev/Playground/util/research_library_manager/v2/js/state.js) | Defines `window.Lexicon.State`, holding library collections, articles, active filters, selection arrays, view modes, and search parameters. |
| [`js/storage.js`](file:///home/pedro/Dev/Playground/util/research_library_manager/v2/js/storage.js) | Handles catalog persistence in `localStorage` and binary document storage (PDF/EPUB/DOC) in IndexedDB (`LexiconFilesDB`). Includes sample data seeding and JSON import/export. |
| [`js/navigation.js`](file:///home/pedro/Dev/Playground/util/research_library_manager/v2/js/navigation.js) | Manages view history (`historyStack`, `forwardStack`). Provides `back()`, `forward()`, view state restoration, and button state management. |
| [`js/collections.js`](file:///home/pedro/Dev/Playground/util/research_library_manager/v2/js/collections.js) | Renders the sidebar collection list, handles folder collapse/expansion, creation, deletion, and dropdown population. |
| [`js/articles.js`](file:///home/pedro/Dev/Playground/util/research_library_manager/v2/js/articles.js) | Controls visual grid and table rendering, inspector overview modal, note auto-saving, batch operations bar, and the dedicated "Collections & Folders" view. |
| [`js/app.js`](file:///home/pedro/Dev/Playground/util/research_library_manager/v2/js/app.js) | Bootstraps the application, registers global shortcuts, manages search debouncing, sorting, view mode switching, and sidebar toggling. |
| [`js/ui/modal.js`](file:///home/pedro/Dev/Playground/util/research_library_manager/v2/js/ui/modal.js) | Modal open/close lifecycle, click-outside dismissal, and accessibility management. |
| [`js/ui/toast.js`](file:///home/pedro/Dev/Playground/util/research_library_manager/v2/js/ui/toast.js) | Shows toast feedback banners (Success, Info, Error) with automatic dismissal. |

---

## 📖 Detailed User Workflows

### 1. Page History & Navigation

As you explore your research library by filtering by category (e.g. *Inbox*, *Reading List*, *Favorites*), switching collections, or clicking `#tags`, Lexicon records each state snapshot:

- **Top Header Arrows:** The `<header>` contains a back arrow (`#btn-nav-back`) and forward arrow (`#btn-nav-forward`) that dynamically enable or disable based on available history.
- **Contextual Page Back Button:** When you navigate to a specific collection, tag, or workflow view, a back arrow (`#page-back-button`) appears next to the main title (e.g. `← Machine Learning`), allowing a 1-click return to where you were before.
- **Keyboard Navigation:** Press <kbd>Alt</kbd> + <kbd>←</kbd> to step backward or <kbd>Alt</kbd> + <kbd>→</kbd> to step forward.

---

### 2. Research Pipeline & Categorization

Move documents through clear academic stages:

- **📥 Inbox:** New documents waiting to be triaged, cataloged, or assigned to collections.
- **📖 Reading List:** Papers and books actively scheduled for study.
- **✍️ Fichamento & Synthesis:** Materials currently under deep analytical reading with structured notes and excerpts.
- **⭐ Favorites:** Pinned core references and seminal papers for quick access.
- **📦 Archived:** Completed literature retained for citations and long-term reference.
- **🏷️ Interactive Tags:** Click any `#tag` chip to instantly isolate related research across all collections.

---

### 3. Collections & Folder Management

Lexicon gives you two ways to interact with collections:

#### A. Sidebar Collection Tree
- Each collection in the sidebar features a small caret toggle.
- Click the caret to expand the collection and preview its nested articles directly inside the sidebar.
- Click the collection name to filter the main library view.

#### B. Dedicated "Collections & Folders" Workflow View
- Click **Collections & Folders** under the *WORKFLOW* section in the sidebar.
- Displays all collections as folder cards with metadata counts.
- **Expand / Reduce:** Collapse individual folders or use the top **Expand All** / **Reduce All** buttons.
- **Add Document Directly:** Click "+ Add Document" on any folder card to open the upload dialog with the collection pre-selected.
- **Document Quick Tiles:** Expanded folders display mini document cards with status badges, star toggles, and direct **READ** buttons.

---

### 4. Multi-File & Directory Import

Click **"Add Document"** in the sidebar or header (or press <kbd>Ctrl + N</kbd>) to access three upload modes:

1. **Single File:** Fill out title, authors, year, DOI, tags, and attach a local file.
2. **Bulk Files:** Select multiple PDF, EPUB, or document files at once.
3. **Entire Folder Tree:**
   - Use the **"Folder"** tab to select an entire folder from your computer.
   - Preserves directory names and automatically creates matching collections in Lexicon.
   - Option to automatically tag imported documents with their parent folder names.
   - Option to specify an initial pipeline status (*Inbox*, *Reading*, *Fichamento*, or *Archived*).

---

### 5. Document Inspector & Native Reading

Clicking on any card or table row opens the comprehensive **Document Overview & Inspector**:

- **Prominent "READ" Button:** Located at the top of the inspector. Opens the document file from IndexedDB in a new browser tab with native zoom, text search, thumbnail sidebar, and printing.
- **Comprehensive Metadata:** View and edit Title, Authors, Publication Year, Journal / Conference, and DOI / URL (with a 1-click external link).
- **Physical File Reference:** Inspect filename, file size, format icon, and local storage state.
- **Tag Management:** Add new tags or remove existing tags using interactive chips.
- **Status & Collection Selectors:** Reclassify or move documents with instant live updating.

---

### 6. Fichamento & Markdown Research Synthesis

Every document in Lexicon includes a dedicated academic note-taking editor (*Fichamento*):

- **Live Auto-Save:** Notes are debounced and saved automatically as you type (`Auto-saved` confirmation indicator).
- **Markdown Toolbar:**
  - **Bold** (`**text**`) and *Italic* (`*text*`)
  - **Headings** (`## Section`)
  - **Blockquotes** (`> Quote`)
  - **Bullet Lists** (`- Item`)
  - **Timestamp Insertion** (Adds current date and time header)
- **Export Single Notes:** Click the download icon to save a clean `.md` file titled after your document.
- **Consolidated Export:** Use batch selection to merge notes from multiple papers into a unified literature review document.

---

### 7. Multiple Selection & Batch Actions

Organize large volumes of literature efficiently:

1. **Select Documents:** Use the checkboxes on cards or table rows. Use the table header checkbox to select all filtered documents.
2. **Floating Action Bar:** A floating toolbar smoothly slides up from the bottom showing the number of selected documents.
3. **Available Batch Operations:**
   - **Batch Status:** Set status to *Inbox*, *Reading List*, *Fichamento*, or *Archived*.
   - **Batch Move to Collection:** Select an existing collection or choose **"+ Create New Collection..."** to type a new collection name and move all selected files into it in one step.
   - **Batch Tag:** Add a `#tag` to all selected documents.
   - **Batch Favorites:** Mark or unmark selection as favorites.
   - **Batch Notes Export:** Download a consolidated `Batch_Research_Notes_YYYY-MM-DD.md` containing all summaries, metadata, and notes from selected papers.
   - **Batch Delete:** Safely remove selected documents and their associated local files from storage.

---

### 8. 3-Step Sample Data Reset Wizard

To prevent accidental data loss, resetting to sample demonstration data requires passing a 3-step security wizard:

1. **Step 1 — Warning & Details:** Clear explanation of what will be erased (catalog entries, notes, and custom collections).
2. **Step 2 — Phrase Confirmation:** Requires the user to type the word `RESET` into a confirmation field. The next button remains disabled until the exact text matches.
3. **Step 3 — Final Verification:** Final review screen displaying a caution summary before confirming the purge.

---

## ⌨️ Keyboard Shortcuts

Boost your research productivity with built-in hotkeys:

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> / <kbd>Cmd</kbd> + <kbd>K</kbd> | Focus instant multi-field search bar | Global |
| <kbd>Ctrl</kbd> + <kbd>N</kbd> / <kbd>Cmd</kbd> + <kbd>N</kbd> | Open "Add Document" / Import modal | Global |
| <kbd>Alt</kbd> + <kbd>←</kbd> | Return to previous page / filter / collection | Global |
| <kbd>Alt</kbd> + <kbd>→</kbd> | Step forward in page history | Global |
| <kbd>Escape</kbd> | Close any open modal or inspector window | Global |

---

## 💾 Storage & Data Model

Lexicon uses an offline, client-side persistence architecture:

### 1. Catalog & Metadata (`localStorage`)
- **Key:** `lexicon_v2_catalog`
- Stores article metadata (ID, title, authors, year, publication, DOI, tags, status, collection, summary, and notes).
- Stores collection lists and system preferences (sorting order, view mode, sidebar state).

### 2. Physical Binary Files (`IndexedDB`)
- **Database Name:** `LexiconFilesDB` (Store: `files`)
- Binary blobs (PDF, EPUB, DOC, images) are stored directly in IndexedDB.
- Circumvents the 5MB quota limitation of `localStorage`, allowing tens of gigabytes of research literature stored locally in your browser sandbox.

### 3. Backup & Portability
- **Backup Catalog (JSON):** Export your complete catalog and reading notes as a clean, structured JSON file.
- **Restore Catalog:** Import a previously exported JSON catalog to restore your library on another device or browser.

---

## 🚀 Quick Start & Running Locally

Lexicon requires no compilation, `npm install`, or Node.js runtime.

### Option 1: One-Click Auto-Launcher (Recommended)

Run the included shell launcher:
```bash
./start.sh
```
* Automatically checks if the server is already running.
* Starts a lightweight Python HTTP server on port `8000` in the background if needed.
* Automatically opens your default system browser to `http://localhost:8000`.

---

### Option 2: Python HTTP Server

If you prefer starting manually from terminal:
```bash
# Navigate to the v2 directory
cd path/to/research_library_manager/v2

# Start Python HTTP server
python3 -m http.server 8000
```
Then navigate to: **[http://localhost:8000](http://localhost:8000)**

---

### Option 3: Node / NPX

```bash
npx serve .
```

---

### Option 4: Direct File Opening

You can also double-click [`index.html`](file:///home/pedro/Dev/Playground/util/research_library_manager/v2/index.html) or open it directly in modern browsers (`file:///path/to/index.html`).

> [!TIP]
> Running via a local HTTP server (`./start.sh` or `python3 -m http.server`) is recommended for the smoothest IndexedDB binary blob rendering and browser PDF viewer delegation.

---

## 🌐 Browser Compatibility

Tested and supported on modern browsers with ES6, IndexedDB, and File API support:

- **Google Chrome** (v88+)
- **Mozilla Firefox** (v85+)
- **Apple Safari** (v14.1+)
- **Microsoft Edge** (v88+)
- **Brave / Opera / Vivaldi**

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — free to use, modify, and distribute for personal, academic, and commercial research purposes.
