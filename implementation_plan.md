# Implementation Plan: Markdown to Google Docs Professional VS Code Extension (`md2gdocs`)

Build a production-grade VS Code extension that converts any Markdown file into a beautiful, modern, and professional Google Docs document. The extension provides direct Google Drive/Docs cloud upload via Google OAuth/API, zero-configuration 1-click Rich Clipboard copy (for instant paste into Google Docs), standalone Google Docs-optimized HTML/DOCX export, and a live side-by-side preview panel.

---

## User Review Required

> [!IMPORTANT]
> **Google Cloud Authentication Model**:
> Google Drive API requires OAuth credentials to upload directly to a user's Google Drive. We implement a **hybrid 3-tier architecture**:
> 1. **Zero-Configuration Instant Mode (Default / No setup needed)**: "Copy for Google Docs (Rich Formatted)" & "Export to Google Docs HTML/DOCX". Converts markdown to pre-styled Google Docs clipboard format — you simply press `Ctrl+V` into any Google Doc with 100% fidelity.
> 2. **1-Click OAuth2 Browser Login**: Uses a local loopback server (`http://127.0.0.1:<port>/callback`) where users can plug in their Google OAuth Client ID or use the extension flow.
> 3. **Service Account Key Mode**: For corporate or automated environments, users can select a Service Account JSON key.
> Tokens are securely stored in VS Code's encrypted `context.secrets` (OS Keychain).

---

## Key Architecture & Industrial-Standard Features

```
                   ┌──────────────────────────────────────┐
                   │            Markdown File             │
                   │ (CommonMark, GFM, Frontmatter, Math) │
                   └──────────────────┬───────────────────┘
                                      │
                                      ▼
                   ┌──────────────────────────────────────┐
                   │    Enhanced Markdown Parser (AST)    │
                   │  - YAML Frontmatter metadata parser  │
                   │  - GFM Tables & alignment parser     │
                   │  - GitHub Callouts ([!NOTE], etc.)   │
                   │  - Syntax Highlighting (highlight.js)│
                   │  - Task lists, Footnotes, Math (TeX) │
                   │  - Image resolver (local to base64)  │
                   └──────────────────┬───────────────────┘
                                      │
                                      ▼
                   ┌──────────────────────────────────────┐
                   │   Google Docs Style & Theme Engine   │
                   │  - Inline CSS Generator (GDocs spec) │
                   │  - 5 Curated Themes (Modern Slate,   │
                   │    Executive Navy, Emerald, Crimson, │
                   │    Minimalist Clean)                 │
                   │  - Single-cell table layout for      │
                   │    callouts & syntax code blocks     │
                   └──────────────────┬───────────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│  Cloud Sync API  │        │  Rich Clipboard  │        │   Live Preview   │
│ Google Drive API │        │  Copy text/html  │        │  Side-by-side    │
│ Direct Doc Gen   │        │  Instant Ctrl+V  │        │  Webview Panel   │
└──────────────────┘        └──────────────────┘        └──────────────────┘
```

### 1. Document Styling & Design System ("Modern & Professional")
Google Docs does not evaluate external CSS stylesheets or modern CSS Grid/Flexbox layouts when importing or pasting HTML. To achieve state-of-the-art aesthetics:
- **Typography**: Curated font pairings (Inter/Roboto/Merriweather) with proportional type scale:
  - Title: 26pt, bold, primary accent color, letter-spacing -0.5px.
  - Subtitle / Metadata block: 11pt, muted slate, formatted as a modern executive header card.
  - H1: 20pt, bold, bottom accent bar / border.
  - H2: 15pt, semi-bold, 16pt margin top, 6pt margin bottom.
  - H3: 13pt, semi-bold, 12pt margin top, 4pt margin bottom.
  - Body: 10.5pt, 1.45 line spacing, 6pt paragraph bottom margin.
- **Tables**: Styled using Google Docs-compliant table properties:
  - Header: Deep slate/indigo background (`#1E293B` or `#2563EB`), crisp white bold text, padded cells (8pt 12pt).
  - Rows: Zebra-striped alternating rows (`#F8FAFC` and `#FFFFFF`), subtle 1px border (`#E2E8F0`).
  - Alignments: Text-align left, center, or right matching Markdown syntax.
- **Code Blocks**: Formatted inside a single-cell Google Docs-compatible table with `#0F172A` (dark) or `#F8FAFC` (light) background, rounded borders, and syntax tokens highlighted with inline `style="color: ..."` so colors paste into Google Docs.
- **Callouts & Admonitions**: `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!IMPORTANT]`, `> [!CAUTION]` rendered as executive callout boxes with 4px left accent border, tinted background, and icon badge.
- **Frontmatter**: Converts YAML frontmatter (`title`, `author`, `date`, `version`, `tags`) into a professional header banner with title and metadata grid.
- **Images**: Automatically resolves local relative images (`./assets/chart.png`) and inlines them as base64 data URIs so they paste or upload seamlessly.
- **Page Breaks**: `<!-- pagebreak -->`, `\pagebreak`, or `===` triggers Google Docs page breaks.

---

## Proposed Changes

### Project Initialization & Workspace Setup
We will scaffold a full TypeScript VS Code extension in `e:\JehadurRE\VSCodeExtension`.

#### [NEW] [package.json](file:///e:/JehadurRE/VSCodeExtension/package.json)
- Extension manifest defining:
  - Commands:
    - `md2gdocs.convertToGoogleDocs`: Upload directly to Google Drive as a native Google Doc.
    - `md2gdocs.copyForGoogleDocs`: Copy rich formatted HTML to clipboard for 1-click paste into Google Docs.
    - `md2gdocs.exportHtml`: Export Google Docs-optimized HTML file.
    - `md2gdocs.exportDocx`: Export formatted DOCX file.
    - `md2gdocs.showPreview`: Open side-by-side Google Docs live preview.
    - `md2gdocs.authenticateGoogle`: Configure Google OAuth credentials / sign in.
    - `md2gdocs.selectTheme`: Choose between 5 professional themes.
  - Context menus (Editor title bar icon, Right-click editor context menu for `.md` files, Explorer context menu).
  - Settings (`md2gdocs.defaultTheme`, `md2gdocs.googleClientId`, `md2gdocs.googleClientSecret`, `md2gdocs.targetFolderId`, `md2gdocs.includeTableOfContents`, etc.).

#### [NEW] [tsconfig.json](file:///e:/JehadurRE/VSCodeExtension/tsconfig.json)
- Strict TypeScript configuration targeting Node 18+ / ES2022.

---

### Core Converter Engine (`src/converter/`)

#### [NEW] [types.ts](file:///e:/JehadurRE/VSCodeExtension/src/converter/types.ts)
- Type definitions for themes, frontmatter, document metadata, converter options, and conversion results.

#### [NEW] [themes.ts](file:///e:/JehadurRE/VSCodeExtension/src/converter/themes.ts)
- 5 Professional themes designed specifically for Google Docs:
  1. **Modern Corporate (Default)**: Deep Navy (`#0F172A`), Tech Blue (`#2563EB`), Slate Gray (`#475569`), crisp white/light gray tables.
  2. **Emerald Executive**: Forest Green (`#064E3B`), Mint Accent (`#059669`), warm cream background accents.
  3. **Crimson Elegant**: Deep Burgundy (`#881337`), Rose Accent (`#E11D48`), warm editorial style.
  4. **Minimalist Monochrome**: Grayscale palette, high contrast, clean typography, editorial feel.
  5. **Tech Violet**: Indigo/Purple accent (`#4F46E5`), modern dark code blocks, vibrant callout boxes.

#### [NEW] [markdownParser.ts](file:///e:/JehadurRE/VSCodeExtension/src/converter/markdownParser.ts)
- Parser utilizing `markdown-it` with plugins:
  - YAML frontmatter parser (`gray-matter`).
  - GitHub-style callouts / alerts (`markdown-it-container`).
  - Table alignments & headers.
  - Inline & block math renderer.
  - Task lists (`- [x]` / `- [ ]`) with ballot glyphs.
  - Footnotes support.
  - Syntax highlighting via `highlight.js` emitting inline CSS styles per token.
  - Local image reader & base64 embedder (resolves relative image paths against markdown file folder).

#### [NEW] [googleDocsHtmlGenerator.ts](file:///e:/JehadurRE/VSCodeExtension/src/converter/googleDocsHtmlGenerator.ts)
- Generates HTML engineered specifically for Google Docs:
  - All styles inlined directly into tags (`style="..."`) so Google Docs paste/upload doesn't drop styling.
  - Google Docs-compatible single-cell table wrapper for callouts and code blocks.
  - Executive header card for frontmatter metadata.
  - Clean page break tags (`<hr style="page-break-after: always; display: none;">`).

#### [NEW] [docxGenerator.ts](file:///e:/JehadurRE/VSCodeExtension/src/converter/docxGenerator.ts)
- Secondary exporter using `docx` library to generate a native `.docx` file with the exact same styling, headings, tables, and callouts, ready for Google Docs import.

---

### Google Cloud Integration (`src/google/`)

#### [NEW] [googleAuth.ts](file:///e:/JehadurRE/VSCodeExtension/src/google/googleAuth.ts)
- OAuth 2.0 loopback authentication flow:
  - Spins up temporary `http://127.0.0.1:<port>/callback` server.
  - Opens system browser for Google sign-in.
  - Exchanges auth code for access & refresh tokens.
  - Stores tokens in VS Code's encrypted `context.secrets`.
  - Supports Service Account JSON file as alternative auth.
  - Provides clear setup instructions and guidance.

#### [NEW] [googleDriveClient.ts](file:///e:/JehadurRE/VSCodeExtension/src/google/googleDriveClient.ts)
- Google Drive API v3 client:
  - Uploads generated HTML or DOCX with `mimeType: application/vnd.google-apps.document`.
  - Automatically handles multipart upload.
  - Places file into optional custom folder or root.
  - Returns direct Google Docs web link: `https://docs.google.com/document/d/<documentId>/edit`.
  - Prompts user with "Open in Google Docs" button.

---

### User Interface & VS Code Integration (`src/`)

#### [NEW] [previewPanel.ts](file:///e:/JehadurRE/VSCodeExtension/src/preview/previewPanel.ts)
- Webview panel showing live side-by-side Google Docs layout:
  - Accurately renders document with Google Docs page margins, font sizes, and selected theme.
  - Toolbar with Theme Switcher, "Copy for Google Docs", "Upload to Google Drive", and "Export HTML".
  - Auto-refreshes when markdown document is edited.

#### [NEW] [clipboardHelper.ts](file:///e:/JehadurRE/VSCodeExtension/src/clipboard/clipboardHelper.ts)
- Writes HTML with MIME type `text/html` and plain text fallback to system clipboard.
- Works cross-platform on Windows, macOS, and Linux.

#### [NEW] [extension.ts](file:///e:/JehadurRE/VSCodeExtension/src/extension.ts)
- Extension entry point: activates commands, status bar item, webview provider, secret storage.

---

## Edge Cases Handled

| Edge Case | Solution |
| :--- | :--- |
| **Local Images** (`./images/pic.png`) | Resolved relative to document URI, converted to base64 Data URIs (`data:image/png;base64,...`) inline. |
| **Callout Boxes** (`> [!NOTE]`) | Rendered as 1x1 table with left border & background color (Google Docs preserves table cell styles). |
| **Code Syntax Highlighting** | `highlight.js` tokens mapped to inline `style="color: ..."` so colors survive Google Docs clipboard paste & upload. |
| **Tables Without Borders** | Explicit inline border styling on all `th`/`td` cells; alternating zebra stripe shading. |
| **YAML Frontmatter** | Parsed and rendered as an Executive Title & Metadata block instead of raw text. |
| **Task Lists** (`- [ ]`, `- [x]`) | Converted to clean ballot checkboxes (`☐`, `☑`) with strikethrough for completed tasks. |
| **Math / Equations** | LaTeX expressions formatted as clean Unicode/rendered HTML blocks. |
| **No Google Account / Offline** | Instant "Copy for Google Docs" copies styled HTML to clipboard — paste into any Google Doc with 0 setup. |
| **Expired OAuth Token** | Stored refresh token automatically renews access token before API call. |

---

## Verification Plan

### Automated Tests
1. Unit tests for Markdown parser with edge cases (tables, callouts, frontmatter, code blocks, task lists).
2. Unit tests for HTML generator: verify all tags have inline CSS styles, no external classes, valid table structures.
3. Unit tests for theme generation: verify all 5 themes produce valid colors and styles.
4. VS Code extension compilation and packaging check (`npm run compile`, `npm test`).

### Manual Verification
1. Create a comprehensive test markdown file (`test-sample.md`) containing all features (frontmatter, H1-H6, tables, callouts, code blocks with syntax highlighting, lists, task lists, blockquotes, images, math).
2. Test "Copy for Google Docs" and verify clipboard content in Google Docs.
3. Test Live Preview panel and theme switching.
4. Test Export to HTML and DOCX.
5. Test Google Drive API upload flow and verify document generation.
