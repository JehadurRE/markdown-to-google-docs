import * as vscode from 'vscode';
import * as path from 'path';
import { GoogleDocsHtmlGenerator } from '../converter/googleDocsHtmlGenerator';
import { ALL_THEMES, getTheme } from '../converter/themes';

export class GoogleDocsPreviewPanel {
  public static currentPanel: GoogleDocsPreviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private currentDocUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private selectedTheme: string;

  public static createOrShow(extensionUri: vscode.Uri, docUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn === vscode.ViewColumn.One
        ? vscode.ViewColumn.Two
        : vscode.ViewColumn.Beside
      : vscode.ViewColumn.Two;

    if (GoogleDocsPreviewPanel.currentPanel) {
      GoogleDocsPreviewPanel.currentPanel.panel.reveal(column);
      GoogleDocsPreviewPanel.currentPanel.update(docUri);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'md2gdocsPreview',
      'Google Docs Preview',
      column || vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.dirname(docUri.fsPath))]
      }
    );

    GoogleDocsPreviewPanel.currentPanel = new GoogleDocsPreviewPanel(panel, extensionUri, docUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, docUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.currentDocUri = docUri;

    const config = vscode.workspace.getConfiguration('md2gdocs');
    this.selectedTheme = config.get<string>('defaultTheme', 'modern-corporate');

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Listen for messages from webview toolbar
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'changeTheme':
            this.selectedTheme = message.theme;
            this.update();
            break;
          case 'copy':
            vscode.commands.executeCommand('md2gdocs.copyForGoogleDocs');
            break;
          case 'upload':
            vscode.commands.executeCommand('md2gdocs.convertToGoogleDocs');
            break;
          case 'exportHtml':
            vscode.commands.executeCommand('md2gdocs.exportHtml');
            break;
          case 'exportDocx':
            vscode.commands.executeCommand('md2gdocs.exportDocx');
            break;
        }
      },
      null,
      this.disposables
    );

    // Update when active document is saved or changed
    vscode.workspace.onDidSaveTextDocument(
      (doc) => {
        if (doc.uri.fsPath === this.currentDocUri.fsPath) {
          this.update();
        }
      },
      null,
      this.disposables
    );

    vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.fsPath === this.currentDocUri.fsPath) {
          this.update();
        }
      },
      null,
      this.disposables
    );

    this.update();
  }

  public async update(newDocUri?: vscode.Uri) {
    if (newDocUri) {
      this.currentDocUri = newDocUri;
    }

    try {
      const document = await vscode.workspace.openTextDocument(this.currentDocUri);
      const markdownContent = document.getText();
      const baseDir = path.dirname(this.currentDocUri.fsPath);

      const generator = new GoogleDocsHtmlGenerator({
        theme: this.selectedTheme,
        baseDir
      });

      const result = generator.convert(markdownContent);
      this.panel.title = `Preview: ${result.title}`;
      this.panel.webview.html = this.buildWebviewHtml(result.html, this.selectedTheme);
    } catch (e: any) {
      this.panel.webview.html = `<html><body><h3>Error rendering preview: ${e.message}</h3></body></html>`;
    }
  }

  private buildWebviewHtml(documentHtml: string, currentTheme: string): string {
    const themeOptions = Object.keys(ALL_THEMES)
      .map(
        (key) =>
          `<option value="${key}" ${key === currentTheme ? 'selected' : ''}>${ALL_THEMES[key].displayName}</option>`
      )
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background-color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    /* Top Toolbar */
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .toolbar-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #93c5fd;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .theme-select {
      background: #1e293b;
      color: #f8fafc;
      border: 1px solid #334155;
      padding: 5px 10px;
      border-radius: 6px;
      font-size: 12px;
      outline: none;
      cursor: pointer;
    }
    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn {
      background: #2563eb;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: background 0.15s;
    }
    .btn:hover { background: #1d4ed8; }
    .btn-secondary {
      background: #334155;
      color: #f1f5f9;
    }
    .btn-secondary:hover { background: #475569; }

    /* Main Preview Container */
    .preview-viewport {
      flex: 1;
      overflow-y: auto;
      padding: 32px 20px;
      display: flex;
      justify-content: center;
    }
    .gdoc-page {
      background: #ffffff;
      width: 100%;
      max-width: 820px;
      min-height: 1056px;
      padding: 60px 70px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08);
      border-radius: 2px;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <div class="toolbar-title">📄 Google Docs View</div>
      <select class="theme-select" id="themeSelect" onchange="changeTheme()">
        ${themeOptions}
      </select>
    </div>
    <div class="toolbar-actions">
      <button class="btn" onclick="copyForGDocs()">📋 Copy for Google Docs</button>
      <button class="btn btn-secondary" onclick="uploadDrive()">☁️ Upload to Drive</button>
      <button class="btn btn-secondary" onclick="exportHtml()">Export HTML</button>
      <button class="btn btn-secondary" onclick="exportDocx()">Export DOCX</button>
    </div>
  </div>

  <div class="preview-viewport">
    <div class="gdoc-page">
      ${documentHtml}
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function changeTheme() {
      const select = document.getElementById('themeSelect');
      vscode.postMessage({ command: 'changeTheme', theme: select.value });
    }

    function copyForGDocs() {
      vscode.postMessage({ command: 'copy' });
    }

    function uploadDrive() {
      vscode.postMessage({ command: 'upload' });
    }

    function exportHtml() {
      vscode.postMessage({ command: 'exportHtml' });
    }

    function exportDocx() {
      vscode.postMessage({ command: 'exportDocx' });
    }

    // Smooth scroll for internal TOC and footnote bookmark links
    document.addEventListener('click', (e) => {
      const anchor = e.target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const targetId = href.substring(1);
          const targetElem = document.getElementById(targetId) || document.querySelector('[name="' + targetId + '"]');
          if (targetElem) {
            targetElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    });
  </script>
</body>
</html>`;
  }

  public dispose() {
    GoogleDocsPreviewPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
