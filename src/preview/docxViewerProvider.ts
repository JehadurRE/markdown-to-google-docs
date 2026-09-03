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
        const result = await mammoth.convertToHtml({ buffer });
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

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background-color: #F1F5F9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
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
    }
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .file-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #FFFFFF;
    }
    .file-size {
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
    .btn {
      background: #2563EB;
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
      transition: background 0.15s;
    }
    .btn:hover { background: #1D4ED8; }
    .btn-secondary {
      background: #334155;
      color: #F1F5F9;
    }
    .btn-secondary:hover { background: #475569; }

    .viewport {
      flex: 1;
      overflow-y: auto;
      padding: 36px 20px;
      display: flex;
      justify-content: center;
    }
    .gdoc-page {
      background: #FFFFFF;
      width: 100%;
      max-width: 840px;
      min-height: 1056px;
      padding: 56px 64px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);
      border-radius: 3px;
      font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1E293B;
    }
    .gdoc-page h1 {
      font-size: 22pt;
      color: #0F172A;
      margin-top: 0;
      margin-bottom: 12pt;
      font-weight: 700;
      border-bottom: 2pt solid #2563EB;
      padding-bottom: 6pt;
    }
    .gdoc-page h2 {
      font-size: 16pt;
      color: #1E293B;
      margin-top: 18pt;
      margin-bottom: 8pt;
      font-weight: 600;
    }
    .gdoc-page h3 {
      font-size: 13pt;
      color: #334155;
      margin-top: 14pt;
      margin-bottom: 6pt;
      font-weight: 600;
    }
    .gdoc-page p {
      margin-top: 0;
      margin-bottom: 8pt;
    }
    .gdoc-page table {
      width: 100%;
      border-collapse: collapse;
      margin: 14pt 0;
    }
    .gdoc-page table, .gdoc-page th, .gdoc-page td {
      border: 1px solid #CBD5E1;
    }
    .gdoc-page th, .gdoc-page td {
      padding: 7pt 10pt;
      text-align: left;
    }
    .gdoc-page th {
      background-color: #F8FAFC;
      font-weight: 600;
    }
    .gdoc-page img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    }
    .gdoc-page ul, .gdoc-page ol {
      padding-left: 24px;
      margin-bottom: 8pt;
    }
    .gdoc-page blockquote {
      border-left: 4px solid #2563EB;
      margin: 12pt 0;
      padding: 6pt 16pt;
      background: #F8FAFC;
      color: #475569;
    }

    @media print {
      .toolbar { display: none !important; }
      body { background: transparent !important; }
      .viewport { padding: 0 !important; }
      .gdoc-page {
        box-shadow: none !important;
        max-width: 100% !important;
        padding: 0 !important;
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
      <span class="file-size">${sizeKb} KB</span>
    </div>
    <div class="toolbar-actions">
      <button class="btn btn-secondary" onclick="window.print()">🖨️ Print</button>
      <button class="btn btn-secondary" onclick="copyText()">📋 Copy All Text</button>
      <button class="btn" onclick="openExternal()">🖥️ Open in Word</button>
    </div>
  </div>

  <div class="viewport" id="viewport">
    <div class="gdoc-page" id="docContent">
      ${bodyContent}
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

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
