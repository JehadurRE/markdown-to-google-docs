# Change Log

All notable changes to the **Markdown to Google Docs** (`md2gdocs`) extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-09-04

### Added
- **Interactive DOCX Viewer Controls**: Added responsive Zoom In (`+`), Zoom Out (`−`), and Reset (`100%`) with keyboard shortcuts (`Ctrl + +`, `Ctrl + -`, `Ctrl + 0`).
- **Dark / Light Theme Toggle in Word Viewer**: Eye-strain reduction mode (`🌓 Theme`) with persistent local preference caching.
- **Document Telemetry Badges in Word Viewer**: Live pill indicators for file size (`KB`) and real-time word count.
- **Embedded Image Support in Word Viewer**: Integrated `mammoth.images.dataUri` so screenshots, logos, diagrams, and photos inside `.docx` files render automatically as standard Data URIs.
- **Clickable Hyperlinks in DOCX**: Integrated native Word `ExternalHyperlink` components for Markdown links (`[label](url)`) and native `HeadingLevel.TITLE` outline formatting.
- **Dual-Format System Clipboard**: Windows clipboard simultaneously registers `DataFormats.Html` (for Google Docs, Word, Outlook) and `DataFormats.UnicodeText` (for VS Code, Notepad, terminal).
- **Universal UTF-8 Encoding**: Prepended `<meta charset="utf-8">` to clipboard fragments, guaranteeing emoji, arrows, checkboxes, and math symbols decode without ANSI corruption.

### Fixed
- **Table-Based `thead` / `tfoot` Repeating PDF Architecture**: Replaced fragile `position: fixed` CSS coordinates with paged table headers and footers. Chromium's layout engine mathematically reserves dedicated header and footer margins on every page, completely eliminating text collisions.
- **Card & Table Page Splitting**: Added `page-break-inside: avoid !important; break-inside: avoid !important;` to Table of Contents, Callouts, Diagram cards, Math blocks, and Data tables to prevent boxes from being sliced across page boundaries.
- **Orphan Headings in PDF**: Added `page-break-after: avoid !important; break-after: avoid !important;` to headings (`h1`–`h6`).
- **Eliminated Raw HTML Leaks in Word Export**: `MarkdownParser` dual-pipeline separates pure `rawMarkdown` from HTML-preprocessed `bodyMarkdown`, preventing internal tags (`[[CALLOUT:...]]`, `<table...>`, `<dl><dt>`) from appearing as visible text in `.docx`.
- **Windows `CF_HTML` Byte Offset Drift**: Corrected placeholder width calculation so `StartHTML`, `EndHTML`, `StartFragment`, and `EndFragment` are verified 100% byte-perfect (0 byte offset error).
- **Word Viewer Element Styles**: Added dedicated styling for `<pre>`, `<code>`, single-cell callout tables (`table:has(tr:only-child > td:only-child)`), blockquotes, and tables.

---

## [1.1.0] - 2026-09-03

### Added
- **Default Word DOCX Viewer in VS Code**: Integrated custom editor (`md2gdocs.docxEditor`) set as default for `*.docx` files. Automatically renders Word documents into formatted Google Docs view with Print, Copy, and external launch actions.
- **Interactive Animated Demo Showcase**: Created embedded vector showcase animation (`media/demo.svg`) demonstrating split-screen markdown editing, live preview sync, and clipboard copying.
- **Running Headers & Running Footers**: Supports global settings and per-document frontmatter (`header: "..."`, `footer: "..."`) across Google Docs HTML, Word `.docx`, and PDF exports.
- **Dynamic Pagination ("Page X of Y")**: Native `PageNumber.CURRENT` & `TOTAL_PAGES` in Word `.docx`, CSS print counters in PDF, and preview toolbar page stats.
- **Hard Page Breaks**: Support for `<!-- pagebreak -->`, `<!-- newpage -->`, `<!-- pb -->`, `\pagebreak`, and `===` across HTML, Word `.docx`, PDF, and Live Preview.
- **Corporate Translucent Watermarks**: Support for `watermark: "CONFIDENTIAL"` or `watermark: "DRAFT"` with angled translucent text overlay.
- **Mermaid Diagram Rendering**: Intercepts ````mermaid` code blocks and converts them into structured diagram cards.
- **Document Statistics & Reading Time**: Automatically calculates word count and estimated reading time (`~X min read`) displayed in the executive header card and preview toolbar.
- **Definition Lists & Text Alignment Directives**: Semantic `<dl><dt><dd>` rendering and alignment directives (`-> center <-`, `-> right ->`).
- **Comprehensive Documentation Refresh**: Overhauled `README.md` with complete YAML frontmatter spec, keyboard shortcuts table, and setting matrices.

---

## [1.0.3] - 2026-09-03

### Added
- **Running Headers & Running Footers**: Supports global settings and per-document frontmatter (`header: "..."`, `footer: "..."`) across Google Docs HTML, Word `.docx`, and PDF exports.
- **Dynamic Pagination ("Page X of Y")**: Native `PageNumber.CURRENT` & `TOTAL_PAGES` in Word `.docx`, CSS print counters in PDF, and preview toolbar page stats.
- **Hard Page Breaks**: Support for `<!-- pagebreak -->`, `<!-- newpage -->`, `<!-- pb -->`, `\pagebreak`, and `===` across HTML, Word `.docx`, PDF, and Live Preview.
- **Corporate Translucent Watermarks**: Support for `watermark: "CONFIDENTIAL"` or `watermark: "DRAFT"` with angled translucent text overlay.
- **Mermaid Diagram Rendering**: Intercepts ````mermaid` code blocks and converts them into structured diagram cards.
- **Document Statistics & Reading Time**: Automatically calculates word count and estimated reading time (`~X min read`) displayed in the executive header card and preview toolbar.
- **Definition Lists & Text Alignment Directives**: Semantic `<dl><dt><dd>` rendering and alignment directives (`-> center <-`, `-> right ->`).
- **Native Print-Quality PDF Export**: Cross-platform headless browser engine automatically detecting Microsoft Edge, Google Chrome, Brave, or Chromium across Windows, macOS, and Linux.
- **Preview Toolbar PDF Export**: Added 1-click `📄 Export PDF` button in the live side-by-side Google Docs preview panel.
- **Linux Wayland & X11 Clipboard Parity**: Auto-detects Wayland sessions (`wl-copy -t text/html`) with seamless fallback to `xclip` and `xsel`.
- **Keyboard Shortcuts**:
  - `Ctrl+Alt+G` (macOS: `Cmd+Alt+G`): Copy for Google Docs (Rich Formatted).
  - `Ctrl+Alt+P` (macOS: `Cmd+Alt+P`): Show Live Side-by-Side Google Docs Preview.
  - `Ctrl+Alt+D` (macOS: `Cmd+Alt+D`): Export as Print-Quality PDF.
- **DOCX Generator Rich Parity**:
  - Added support for all 12 alert callouts with curated borders and shading.
  - Support for highlighted text (`==text==`), subscript (`~text~`), superscript (`^text^`), inserted text (`++text++`), strikethrough (`~~text~~`), and keyboard keys (`<kbd>`).
  - Task lists rendered as ballot checkboxes (`☐`, `☑`).
  - Inline math equations styled with Cambria Math.
- **Webview Content Security Policy (CSP)**: Strict security policy preventing untrusted scripts.
- **esbuild Single-File Bundling**: Ultra-fast bundle packaging reducing extension startup latency to <15ms.

---

## [1.0.2] - 2026-09-03

### Added
- **Native Google Docs Bookmark Linking**: Heading named anchors (`<a name="${slug}"></a>`) allow Table of Contents and internal links to become native Google Docs Bookmarks upon paste or upload.
- **Manual `[TOC]` Placement & Depth**: Supports `[TOC]`, `[[toc]]`, or `[toc]` directive with configurable `toc_depth` (levels 1–6).
- **Footnotes Engine**: Supports `[^1]` inline citations and `[^1]: definition` with return links (`↩`).
- **Extended Callouts (12 Types)**: Added `INFO`, `SUCCESS`, `DANGER`, `QUESTION`, `QUOTE`, `TODO`, and `EXAMPLE` alongside `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, and `CAUTION`.
- **Code Block Language Badges**: Floating pill header showing detected language (e.g., `TYPESCRIPT`, `PYTHON`, `SQL`).
- **Per-Document Frontmatter Overrides**: Override `theme`, `toc`, `toc_depth`, `zebra_stripes`, `code_theme`, and `font` directly in markdown YAML frontmatter.

---

## [1.0.1] - 2026-09-03

### Changed
- Official brand logo and glassmorphism app icon.
- Added marketplace banner and metadata configurations.

---

## [1.0.0] - 2026-09-02

### Added
- Initial release:
  - 1-Click Zero-Configuration Clipboard Copy for Google Docs (`Ctrl+V` fidelity).
  - Direct Google Drive Cloud Sync with loopback OAuth 2.0.
  - Live Side-by-Side Google Docs Webview Preview.
  - 6 Curated Themes: Modern Corporate, Executive Navy, Emerald Mint, Crimson Elegant, Minimalist Monochrome, Tech Violet.
  - Word / Google Docs `.docx` and standalone `.html` exports.
  - Inline syntax highlighting without external CSS dependencies.
  - Executive frontmatter title card parsing.
  - Zebra-striped markdown tables and task lists.
