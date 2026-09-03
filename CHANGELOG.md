# Change Log

All notable changes to the **Markdown to Google Docs** (`md2gdocs`) extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.3] - 2026-09-03

### Added
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
