import * as vscode from 'vscode';
import * as path from 'path';
import * as mammoth from 'mammoth';

export class DocxViewerProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = 'md2gdocs.docxEditor';

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new DocxViewerProvider(context);
    return vscode.window.registerCustomEditorProvider(
      DocxViewerProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
          enableFindWidget: true
        },
        supportsMultipleEditorsPerDocument: false
      }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    token: vscode.CancellationToken
  ): Promise<vscode.CustomDocument> {
    return {
      uri,
      dispose: () => {}
    };
  }

  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true
    };

    const fileName = path.basename(document.uri.fsPath);
    webviewPanel.title = `Word: ${fileName}`;

    const render = async () => {
      try {
        const fileBytes = await vscode.workspace.fs.readFile(document.uri);
        const buffer = Buffer.from(fileBytes);
        const mammothAny = mammoth as any;
        const options: any = {
          styleMap: [
            "p[style-name='Title'] => h1.doc-title:fresh",
            "p[style-name='Subtitle'] => p.doc-subtitle:fresh"
          ]
        };
        if (mammothAny.images?.dataUri) {
          options.convertImage = mammothAny.images.dataUri;
        }
        const result = await mammothAny.convertToHtml({ buffer }, options);
        webviewPanel.webview.html = this.buildHtml(fileName, result.value, buffer.length);
      } catch (err: any) {
        webviewPanel.webview.html = `
          <!DOCTYPE html>
          <html>
            <body style="font-family: sans-serif; padding: 40px; text-align: center; color: #ef4444;">
              <h2>Unable to open Word Document</h2>
              <p>${err.message}</p>
            </body>
          </html>`;
      }
    };

    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.command === 'openExternal') {
        vscode.env.openExternal(document.uri);
      } else if (msg.command === 'copyText') {
        vscode.env.clipboard.writeText(msg.text || '');
        vscode.window.showInformationMessage('Content copied to clipboard!');
      }
    });

    await render();
  }

  private buildHtml(fileName: string, bodyContent: string, fileSize: number): string {
    const sizeKb = (fileSize / 1024).toFixed(1);

    // Calculate approximate word count
    const plainText = bodyContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = plainText ? plainText.split(/\s+/).length : 0;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <style>
    * { box-sizing: border-box; }
    :root {
      --bg-app: #F1F5F9;
      --bg-page: #FFFFFF;
      --text-main: #0F172A;
      --text-muted: #64748B;
      --border-color: #E2E8F0;
      --table-border: #CBD5E1;
      --callout-bg: #F8FAFC;
      --code-bg: #0F172A;
      --code-text: #F8FAFC;
      --inline-code-bg: #F1F5F9;
      --primary: #2563EB;
      --primary-hover: #1D4ED8;
    }

    body.dark-theme {
      --bg-app: #0B0F19;
      --bg-page: #1E293B;
      --text-main: #F8FAFC;
      --text-muted: #94A3B8;
      --border-color: #334155;
      --table-border: #334155;
      --callout-bg: #0F172A;
      --code-bg: #030712;
      --code-text: #38BDF8;
      --inline-code-bg: #0F172A;
      --primary: #3B82F6;
      --primary-hover: #60A5FA;
    }

    body {
      margin: 0;
      padding: 0;
      background-color: var(--bg-app);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: var(--text-main);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      transition: background-color 0.2s;
    }

    .toolbar {
      height: 48px;
      background: #0F172A;
      border-bottom: 1px solid #1E293B;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      flex-shrink: 0;
      color: #F8FAFC;
      z-index: 10;
    }
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .file-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #FFFFFF;
    }
    .badge-pill {
      font-size: 11px;
      color: #94A3B8;
      background: #1E293B;
      padding: 2px 8px;
      border-radius: 10px;
    }
    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-group {
      display: inline-flex;
      background: #1E293B;
      border-radius: 6px;
      padding: 2px;
      gap: 2px;
    }
    .btn {
      background: var(--primary);
      color: white;
      border: none;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: background 0.15s, transform 0.05s;
    }
    .btn:hover { background: var(--primary-hover); }
    .btn:active { transform: scale(0.98); }
    .btn-secondary {
      background: #334155;
      color: #F1F5F9;
    }
    .btn-secondary:hover { background: #475569; }
    .btn-icon {
      padding: 5px 8px;
      background: transparent;
      color: #94A3B8;
      border: none;
      cursor: pointer;
      border-radius: 4px;
      font-size: 12px;
    }
    .btn-icon:hover {
      background: #334155;
      color: #F8FAFC;
    }

    .viewport {
      flex: 1;
      overflow: auto;
      padding: 36px 20px;
      display: flex;
      justify-content: center;
    }
    .gdoc-page {
      background: var(--bg-page);
      width: 100%;
      max-width: 840px;
      min-height: 1056px;
      padding: 56px 64px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);
      border-radius: 4px;
      font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.55;
      color: var(--text-main);
      transform-origin: top center;
      transition: transform 0.15s ease, background 0.2s, color 0.2s;
    }

    /* Headings */
    .gdoc-page h1 {
      font-size: 22pt;
      color: var(--text-main);
      margin-top: 0;
      margin-bottom: 12pt;
      font-weight: 700;
      border-bottom: 2pt solid var(--primary);
      padding-bottom: 6pt;
    }
    .gdoc-page h2 {
      font-size: 16pt;
      color: var(--text-main);
      margin-top: 20pt;
      margin-bottom: 8pt;
      font-weight: 600;
    }
    .gdoc-page h3 {
      font-size: 13pt;
      color: var(--text-muted);
      margin-top: 14pt;
      margin-bottom: 6pt;
      font-weight: 600;
    }

    /* Paragraphs & Text */
    .gdoc-page p {
      margin-top: 0;
      margin-bottom: 8pt;
    }
    .gdoc-page a {
      color: var(--primary);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .gdoc-page a:hover {
      color: var(--primary-hover);
    }
    .gdoc-page sup {
      font-size: 0.75em;
      vertical-align: super;
      font-weight: 600;
      color: var(--primary);
    }
    .gdoc-page sub {
      font-size: 0.75em;
      vertical-align: sub;
    }
    .gdoc-page hr {
      border: none;
      border-top: 1px solid var(--border-color);
      margin: 18pt 0;
    }

    /* Code Blocks & Monospace */
    .gdoc-page pre {
      background: var(--code-bg);
      color: var(--code-text);
      border-radius: 6px;
      padding: 14px 18px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 9.5pt;
      line-height: 1.5;
      overflow-x: auto;
      margin: 14pt 0;
      border: 1px solid var(--border-color);
    }
    .gdoc-page code {
      font-family: 'Consolas', 'Courier New', monospace;
      background: var(--inline-code-bg);
      border: 1px solid var(--border-color);
      padding: 2px 5px;
      border-radius: 4px;
      font-size: 0.9em;
      color: var(--text-main);
    }
    .gdoc-page pre code {
      background: transparent !important;
      border: none !important;
      padding: 0 !important;
      color: inherit !important;
    }

    /* Tables */
    .gdoc-page table {
      width: 100%;
      border-collapse: collapse;
      margin: 14pt 0;
    }
    .gdoc-page table, .gdoc-page th, .gdoc-page td {
      border: 1px solid var(--table-border);
    }
    .gdoc-page th, .gdoc-page td {
      padding: 7pt 10pt;
      text-align: left;
    }
    .gdoc-page th {
      background-color: var(--callout-bg);
      font-weight: 600;
    }

    /* Single-Cell Callouts & Diagram Cards */
    .gdoc-page table:has(tr:only-child > td:only-child) {
      border: none !important;
      background: var(--callout-bg);
      border-left: 4px solid var(--primary) !important;
      border-radius: 0 6px 6px 0;
      margin: 14pt 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    .gdoc-page table:has(tr:only-child > td:only-child) td {
      border: none !important;
      padding: 12pt 16pt !important;
    }

    /* Images */
    .gdoc-page img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    }

    /* Lists & Quotes */
    .gdoc-page ul, .gdoc-page ol {
      padding-left: 24px;
      margin-bottom: 8pt;
    }
    .gdoc-page blockquote {
      border-left: 4px solid var(--primary);
      margin: 12pt 0;
      padding: 6pt 16pt;
      background: var(--callout-bg);
      color: var(--text-muted);
    }

    @media print {
      .toolbar { display: none !important; }
      body { background: transparent !important; }
      .viewport { padding: 0 !important; }
      .gdoc-page {
        box-shadow: none !important;
        max-width: 100% !important;
        padding: 0 !important;
        transform: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <div class="file-badge">
        <span>📄</span>
        <span>${fileName}</span>
      </div>
      <span class="badge-pill">${sizeKb} KB</span>
      <span class="badge-pill">${wordCount} words</span>
    </div>
    <div class="toolbar-actions">
      <!-- Zoom Controls -->
      <div class="btn-group">
        <button class="btn-icon" onclick="zoomOut()" title="Zoom Out (Ctrl+ -)">−</button>
        <button class="btn-icon" id="zoomLabel" onclick="zoomReset()" title="Reset Zoom">100%</button>
        <button class="btn-icon" onclick="zoomIn()" title="Zoom In (Ctrl+ +)">+</button>
      </div>
      <!-- Theme Toggle -->
      <button class="btn btn-secondary" onclick="toggleTheme()" id="themeBtn" title="Toggle Light/Dark Theme">🌓 Theme</button>
      <!-- Print & Copy -->
      <button class="btn btn-secondary" onclick="window.print()" title="Print document">🖨️ Print</button>
      <button class="btn btn-secondary" onclick="copyText()" title="Copy all text to clipboard">📋 Copy Text</button>
      <button class="btn" onclick="openExternal()" title="Open in Microsoft Word or Desktop App">🖥️ Open in Word</button>
    </div>
  </div>

  <div class="viewport" id="viewport">
    <div class="gdoc-page" id="docContent">
      ${bodyContent}
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentZoom = 1.0;

    function updateZoom() {
      const page = document.getElementById('docContent');
      page.style.transform = 'scale(' + currentZoom + ')';
      document.getElementById('zoomLabel').innerText = Math.round(currentZoom * 100) + '%';
    }

    function zoomIn() {
      if (currentZoom < 2.0) {
        currentZoom = Math.min(2.0, currentZoom + 0.1);
        updateZoom();
      }
    }

    function zoomOut() {
      if (currentZoom > 0.5) {
        currentZoom = Math.max(0.5, currentZoom - 0.1);
        updateZoom();
      }
    }

    function zoomReset() {
      currentZoom = 1.0;
      updateZoom();
    }

    function toggleTheme() {
      document.body.classList.toggle('dark-theme');
      const isDark = document.body.classList.contains('dark-theme');
      try {
        localStorage.setItem('md2gdocs_word_theme', isDark ? 'dark' : 'light');
      } catch (_) {}
    }

    // Restore user theme preference
    try {
      if (localStorage.getItem('md2gdocs_word_theme') === 'dark') {
        document.body.classList.add('dark-theme');
      }
    } catch (_) {}

    // Keyboard shortcuts for zoom
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          zoomIn();
        } else if (e.key === '-') {
          e.preventDefault();
          zoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          zoomReset();
        }
      }
    });

    function openExternal() {
      vscode.postMessage({ command: 'openExternal' });
    }

    function copyText() {
      const text = document.getElementById('docContent').innerText;
      vscode.postMessage({ command: 'copyText', text });
    }
  </script>
</body>
</html>`;
  }
}
