<p align="center">
  <img src="media/icon.png" width="128" height="128" alt="Markdown to Google Docs Logo" style="border-radius: 24px;" />
</p>

# Markdown to Google Docs (`md2gdocs`)

**Convert any Markdown file into a beautiful, modern, and professional Google Doc with 1-click cloud sync, rich clipboard copy, live preview, and executive themes.**

---

## ✨ Features

- **🚀 Zero-Configuration 1-Click Clipboard Copy**: Run **"Copy for Google Docs"** (`Ctrl+Shift+P` -> `Copy for Google Docs`), then press `Ctrl+V` (or `Cmd+V`) inside any Google Doc. All typography, headings, tables, callout boxes, and code blocks paste with 100% fidelity!
- **🔗 Native Google Docs Bookmark Linking**: Injects `<a name="slug"></a>` into all headings so Table of Contents and cross-references (`[Section](#heading)`) become real, clickable **Google Docs Bookmarks**!
- **📑 Author-Defined `[TOC]` Placement & Depth Control**: Place `[TOC]`, `[[toc]]`, or `[toc]` anywhere in your markdown file to position your Table of Contents precisely where you want it. Configure `toc_depth: 2..6` per document.
- **📚 Footnotes with Return Links**: Supports `[^1]` inline citations and `[^1]: text` definitions, creating superscript references and a formatted bottom Footnotes section with return links (`↩`).
- **🎨 6 Curated Professional Themes**:
  - **Modern Corporate (Default)**: Clean tech slate & vibrant indigo aesthetic.
  - **Executive Navy**: Prestigious navy & gold accents for formal business reports and proposals.
  - **Emerald Mint**: Fresh forest green & mint for sustainability, health, and modern tech.
  - **Crimson Elegant**: Deep burgundy & rose for academic, legal, and editorial publications.
  - **Minimalist Monochrome**: Timeless Swiss-style high-contrast typography.
  - **Tech Violet**: Vibrant developer documentation aesthetic with dark code blocks.
- **🏷️ Extended Alert Admonitions (12 Types)**: Transforms `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`, `[!INFO]`, `[!SUCCESS]`, `[!DANGER]`, `[!QUESTION]`, `[!QUOTE]`, `[!TODO]`, and `[!EXAMPLE]` into single-cell Google Docs tables with colored borders and tinted backgrounds.
- **✍️ Rich Typography Extensions**: Highlights (`==text==`), Subscript (`H~2~O`), Superscript (`2^32^`), Inserted text (`++text++`), and Keyboard keys (`<kbd>Ctrl</kbd> + <kbd>C</kbd>`).
- **💻 Code Blocks with Floating Language Badges**: Displays a clean language pill (e.g. `TYPESCRIPT`, `PYTHON`, `SQL`) with inline syntax highlighting that survives clipboard paste.
- **⚙️ Per-Document YAML Frontmatter Overrides**: Control `theme`, `toc`, `toc_depth`, `zebra_stripes`, `code_theme`, and `font` directly inside individual markdown files.
- **🖼️ Image Dimension Sizing**: Supports `![alt](url =300x200)` and `![alt|300](url)` with centered captions.
- **👁️ Live Side-by-Side Preview**: Interactive Webview panel with smooth anchor scrolling simulating the exact Google Docs page layout with a toolbar to switch themes, copy, upload, and export.
- **☁️ Direct Google Drive Cloud Sync**: Authenticate with Google and upload markdown files directly as native Google Docs (`application/vnd.google-apps.document`) with a single click.
- **💾 Local Formats**: Export directly to Google Docs-optimized `.html` or native `.docx`.

---

## ⚡ Quick Start

### Option 1: Zero Setup Clipboard Mode (Instant)
1. Open any Markdown (`.md`) file in VS Code.
2. Click the **"Copy for GDocs"** icon in the editor title bar, or press `Ctrl+Shift+P` and choose:
   ```
   Markdown to Google Docs: Copy for Google Docs (Rich Formatted)
   ```
3. Open a Google Doc (or type `docs.new` in your browser) and press **`Ctrl+V` / `Cmd+V`**.
4. Enjoy a formatted, styled Google Doc!

### Option 2: Live Preview
1. Click the Preview icon in the editor title bar or run:
   ```
   Markdown to Google Docs: Show Google Docs Style Preview
   ```
2. Use the preview toolbar to change themes, copy, upload, or export.

### Option 3: Cloud Sync to Google Drive
1. Run:
   ```
   Markdown to Google Docs: Upload to Google Docs (Cloud Sync)
   ```
2. On first use, complete the secure browser authorization (loopback OAuth 2.0).
3. The extension creates the Google Doc in your Google Drive and automatically opens it in your browser.

---

## ⚙️ Configuration Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| `md2gdocs.defaultTheme` | `modern-corporate` | Theme for Google Docs (`modern-corporate`, `executive-navy`, `emerald-mint`, `crimson-elegant`, `minimalist-mono`, `tech-violet`). |
| `md2gdocs.includeTableOfContents` | `true` | Automatically generate a styled Table of Contents. |
| `md2gdocs.tableZebraStriping` | `true` | Enable alternating row backgrounds on tables. |
| `md2gdocs.googleClientId` | `""` | Custom Google Cloud OAuth 2.0 Client ID for Drive uploads. |
| `md2gdocs.googleClientSecret` | `""` | Custom Google Cloud OAuth 2.0 Client Secret. |
| `md2gdocs.googleDriveFolderId` | `""` | Target Google Drive folder ID (optional, defaults to root Drive). |
| `md2gdocs.openAfterUpload` | `true` | Automatically open the Google Doc in your browser after upload. |

---

## 🔒 Security & Privacy

- Authentication tokens are stored in your operating system's secure credential store using the VS Code `SecretStorage` API (Windows Credential Manager, macOS Keychain, Linux Secret Service).
- Your markdown files and credentials are never transmitted to any third-party servers. All conversion runs locally on your machine.

---

## 👤 Author

**Jehadur Rahman (JehadurRE)**
- Email: [emran.jehadur+ch@gmail.com](mailto:emran.jehadur+ch@gmail.com)
- GitHub: [@JehadurRE](https://github.com/JehadurRE)

---

## 📄 License
MIT

