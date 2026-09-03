import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class PdfViewerProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = 'md2gdocs.pdfEditor';

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new PdfViewerProvider(context);
    return vscode.window.registerCustomEditorProvider(
      PdfViewerProvider.viewType,
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
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
      ]
    };

    const fileName = path.basename(document.uri.fsPath);
    webviewPanel.title = `PDF: ${fileName}`;

    const render = async () => {
      try {
        const fileBytes = await vscode.workspace.fs.readFile(document.uri);
        const base64Pdf = Buffer.from(fileBytes).toString('base64');
        const fileSize = fileBytes.length;

        // Local resource URIs for offline PDF.js scripts
        const pdfJsUri = webviewPanel.webview.asWebviewUri(
          vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'pdf', 'pdf.min.js'))
        );
        const pdfWorkerUri = webviewPanel.webview.asWebviewUri(
          vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'pdf', 'pdf.worker.min.js'))
        );

        webviewPanel.webview.html = this.buildHtml(
          fileName,
          base64Pdf,
          fileSize,
          pdfJsUri.toString(),
          pdfWorkerUri.toString()
        );
      } catch (err: any) {
        webviewPanel.webview.html = `
          <!DOCTYPE html>
          <html>
            <body style="font-family: sans-serif; padding: 40px; text-align: center; color: #ef4444;">
              <h2>Unable to open PDF Document</h2>
              <p>${err.message}</p>
            </body>
          </html>`;
      }
    };

    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.command === 'openExternal') {
        vscode.env.openExternal(document.uri);
      } else if (msg.command === 'showError') {
        vscode.window.showErrorMessage(msg.message);
      }
    });

    await render();
  }

  private buildHtml(
    fileName: string,
    base64Pdf: string,
    fileSize: number,
    pdfJsUri: string,
    pdfWorkerUri: string
  ): string {
    const sizeKb = (fileSize / 1024).toFixed(1);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <style>
    * { box-sizing: border-box; }
    :root {
      --bg-app: #0F172A;
      --bg-toolbar: #1E293B;
      --border-toolbar: #334155;
      --text-main: #F8FAFC;
      --text-muted: #94A3B8;
      --primary: #2563EB;
      --primary-hover: #1D4ED8;
      --page-bg: #FFFFFF;
      --page-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
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
      user-select: none;
    }

    /* Top Control Toolbar */
    .toolbar {
      height: 48px;
      background: var(--bg-toolbar);
      border-bottom: 1px solid var(--border-toolbar);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      flex-shrink: 0;
      z-index: 20;
    }
    .toolbar-left, .toolbar-center, .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
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
      background: #0F172A;
      padding: 2px 8px;
      border-radius: 10px;
      border: 1px solid #334155;
    }

    /* Button Groups & Controls */
    .btn-group {
      display: inline-flex;
      background: #0F172A;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 2px;
      gap: 2px;
    }
    .btn-icon {
      padding: 4px 8px;
      background: transparent;
      color: #CBD5E1;
      border: none;
      cursor: pointer;
      border-radius: 4px;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .btn-icon:hover {
      background: #334155;
      color: #FFFFFF;
    }
    .btn-icon:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .page-input {
      width: 38px;
      background: #0F172A;
      border: 1px solid #334155;
      color: #FFFFFF;
      text-align: center;
      font-size: 12px;
      padding: 3px;
      border-radius: 4px;
    }
    .page-label {
      font-size: 12px;
      color: var(--text-muted);
    }

    .select-zoom {
      background: #0F172A;
      border: 1px solid #334155;
      color: #CBD5E1;
      font-size: 12px;
      padding: 4px 6px;
      border-radius: 6px;
      cursor: pointer;
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
      transition: background 0.15s;
    }
    .btn:hover { background: var(--primary-hover); }
    .btn-secondary {
      background: #334155;
      color: #F1F5F9;
    }
    .btn-secondary:hover { background: #475569; }

    /* PDF Pages Viewport */
    .viewport {
      flex: 1;
      overflow: auto;
      padding: 24px 20px 60px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }

    .page-wrapper {
      position: relative;
      background: var(--page-bg);
      box-shadow: var(--page-shadow);
      border-radius: 3px;
      transition: transform 0.15s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .page-wrapper.night-mode canvas {
      filter: invert(0.9) hue-rotate(180deg);
    }

    .page-tag {
      position: absolute;
      top: -12px;
      right: 12px;
      background: #1E293B;
      color: #94A3B8;
      border: 1px solid #334155;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 4px;
      pointer-events: none;
    }

    canvas {
      display: block;
      border-radius: 3px;
    }

    /* Loading Spinner */
    .loading-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.85);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      z-index: 50;
      transition: opacity 0.2s;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255, 255, 255, 0.15);
      border-top-color: #38BDF8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media print {
      .toolbar { display: none !important; }
      body { background: transparent !important; }
      .viewport { padding: 0 !important; gap: 0 !important; }
      .page-wrapper { box-shadow: none !important; margin: 0 !important; }
      .page-tag { display: none !important; }
    }
  </style>
  <script src="${pdfJsUri}"></script>
</head>
<body>
  <!-- Loading Overlay -->
  <div class="loading-overlay" id="loadingOverlay">
    <div class="spinner"></div>
    <div style="font-size: 13px; color: #94A3B8;">Rendering PDF pages...</div>
  </div>

  <!-- Top Toolbar -->
  <div class="toolbar">
    <div class="toolbar-left">
      <div class="file-badge">
        <span>📄</span>
        <span>${fileName}</span>
      </div>
      <span class="badge-pill">${sizeKb} KB</span>
      <span class="badge-pill" id="pageCountPill">-- pages</span>
    </div>

    <div class="toolbar-center">
      <!-- Page Navigation -->
      <div class="btn-group">
        <button class="btn-icon" onclick="firstPage()" title="First Page">⏮</button>
        <button class="btn-icon" onclick="prevPage()" id="prevBtn" title="Previous Page (PageUp)">◀</button>
      </div>

      <div style="display: flex; align-items: center; gap: 4px;">
        <input type="number" class="page-input" id="pageNumberInput" value="1" min="1" onchange="goToPage(this.value)" />
        <span class="page-label" id="pageTotalLabel">/ --</span>
      </div>

      <div class="btn-group">
        <button class="btn-icon" onclick="nextPage()" id="nextBtn" title="Next Page (PageDown)">▶</button>
        <button class="btn-icon" onclick="lastPage()" title="Last Page">⏭</button>
      </div>

      <!-- Zoom Controls -->
      <div class="btn-group" style="margin-left: 8px;">
        <button class="btn-icon" onclick="zoomOut()" title="Zoom Out (Ctrl+ -)">−</button>
        <select class="select-zoom" id="zoomSelect" onchange="onZoomSelect(this.value)">
          <option value="fit-width">Fit Width</option>
          <option value="fit-page">Fit Page</option>
          <option value="0.75">75%</option>
          <option value="1.0" selected>100%</option>
          <option value="1.25">125%</option>
          <option value="1.5">150%</option>
          <option value="2.0">200%</option>
        </select>
        <button class="btn-icon" onclick="zoomIn()" title="Zoom In (Ctrl+ +)">+</button>
      </div>

      <!-- Rotate -->
      <button class="btn-icon btn-group" onclick="rotateClockwise()" title="Rotate Clockwise 90°">↷ Rotate</button>
    </div>

    <div class="toolbar-right">
      <button class="btn btn-secondary" onclick="toggleNightMode()" id="nightModeBtn" title="Toggle Night / Invert Mode">🌓 Night Mode</button>
      <button class="btn btn-secondary" onclick="window.print()" title="Print PDF">🖨️ Print</button>
      <button class="btn" onclick="openExternal()" title="Open in Adobe Acrobat / System Reader">🖥️ Open External</button>
    </div>
  </div>

  <!-- PDF Viewport -->
  <div class="viewport" id="viewport"></div>

  <script>
    const vscode = acquireVsCodeApi();

    // Configure PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = '${pdfWorkerUri}';

    const base64Data = "${base64Pdf}";
    const binaryData = atob(base64Data);
    const uint8Array = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      uint8Array[i] = binaryData.charCodeAt(i);
    }

    let pdfDoc = null;
    let totalPages = 0;
    let currentPage = 1;
    let currentScale = 1.0;
    let currentRotation = 0;
    let isNightMode = false;
    const pageViewports = {};

    // Load PDF
    pdfjsLib.getDocument({ data: uint8Array }).promise.then((pdf) => {
      pdfDoc = pdf;
      totalPages = pdf.numPages;
      document.getElementById('pageCountPill').innerText = totalPages + (totalPages === 1 ? ' page' : ' pages');
      document.getElementById('pageTotalLabel').innerText = '/ ' + totalPages;
      document.getElementById('pageNumberInput').max = totalPages;

      renderAllPages();
    }).catch((err) => {
      document.getElementById('loadingOverlay').style.display = 'none';
      vscode.postMessage({ command: 'showError', message: 'Failed to parse PDF: ' + err.message });
    });

    async function renderAllPages() {
      const viewport = document.getElementById('viewport');
      viewport.innerHTML = '';
      document.getElementById('loadingOverlay').style.display = 'flex';

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'page-wrapper' + (isNightMode ? ' night-mode' : '');
        pageWrapper.id = 'page-wrapper-' + pageNum;

        const pageTag = document.createElement('div');
        pageTag.className = 'page-tag';
        pageTag.innerText = 'Page ' + pageNum;
        pageWrapper.appendChild(pageTag);

        const canvas = document.createElement('canvas');
        canvas.id = 'pdf-canvas-' + pageNum;
        pageWrapper.appendChild(canvas);

        viewport.appendChild(pageWrapper);

        await renderPage(pageNum, canvas);
      }

      document.getElementById('loadingOverlay').style.display = 'none';
      setupIntersectionObserver();
    }

    async function renderPage(pageNum, canvas) {
      if (!pdfDoc) return;
      const page = await pdfDoc.getPage(pageNum);
      
      // Calculate effective scale
      let scale = currentScale;
      const initialViewport = page.getViewport({ scale: 1.0, rotation: currentRotation });

      const containerWidth = document.getElementById('viewport').clientWidth - 80;
      const containerHeight = document.getElementById('viewport').clientHeight - 60;

      if (scale === 'fit-width') {
        scale = containerWidth / initialViewport.width;
      } else if (scale === 'fit-page') {
        scale = Math.min(containerWidth / initialViewport.width, containerHeight / initialViewport.height);
      }

      const pViewport = page.getViewport({ scale: typeof scale === 'number' ? scale : 1.0, rotation: currentRotation });
      pageViewports[pageNum] = pViewport;

      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(pViewport.width * outputScale);
      canvas.height = Math.floor(pViewport.height * outputScale);
      canvas.style.width = Math.floor(pViewport.width) + 'px';
      canvas.style.height = Math.floor(pViewport.height) + 'px';

      const ctx = canvas.getContext('2d');
      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

      await page.render({
        canvasContext: ctx,
        transform: transform,
        viewport: pViewport
      }).promise;
    }

    function setupIntersectionObserver() {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            const pageNum = parseInt(id.replace('page-wrapper-', ''), 10);
            if (pageNum) {
              currentPage = pageNum;
              document.getElementById('pageNumberInput').value = pageNum;
              updateNavButtons();
            }
          }
        });
      }, { threshold: 0.5 });

      for (let p = 1; p <= totalPages; p++) {
        const el = document.getElementById('page-wrapper-' + p);
        if (el) observer.observe(el);
      }
    }

    function updateNavButtons() {
      document.getElementById('prevBtn').disabled = currentPage <= 1;
      document.getElementById('nextBtn').disabled = currentPage >= totalPages;
    }

    function goToPage(num) {
      const target = Math.max(1, Math.min(totalPages, parseInt(num, 10) || 1));
      currentPage = target;
      document.getElementById('pageNumberInput').value = target;
      const el = document.getElementById('page-wrapper-' + target);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      updateNavButtons();
    }

    function prevPage() {
      if (currentPage > 1) goToPage(currentPage - 1);
    }
    function nextPage() {
      if (currentPage < totalPages) goToPage(currentPage + 1);
    }
    function firstPage() {
      goToPage(1);
    }
    function lastPage() {
      goToPage(totalPages);
    }

    function onZoomSelect(val) {
      if (val === 'fit-width' || val === 'fit-page') {
        currentScale = val;
      } else {
        currentScale = parseFloat(val);
      }
      renderAllPages();
    }

    function zoomIn() {
      if (typeof currentScale !== 'number') currentScale = 1.0;
      currentScale = Math.min(3.0, currentScale + 0.25);
      syncZoomSelect();
      renderAllPages();
    }

    function zoomOut() {
      if (typeof currentScale !== 'number') currentScale = 1.0;
      currentScale = Math.max(0.4, currentScale - 0.25);
      syncZoomSelect();
      renderAllPages();
    }

    function syncZoomSelect() {
      const select = document.getElementById('zoomSelect');
      select.value = currentScale.toFixed(2);
      if (!select.value) {
        select.value = '1.0';
      }
    }

    function rotateClockwise() {
      currentRotation = (currentRotation + 90) % 360;
      renderAllPages();
    }

    function toggleNightMode() {
      isNightMode = !isNightMode;
      const wrappers = document.querySelectorAll('.page-wrapper');
      wrappers.forEach(w => {
        if (isNightMode) {
          w.classList.add('night-mode');
        } else {
          w.classList.remove('night-mode');
        }
      });
      const btn = document.getElementById('nightModeBtn');
      btn.style.background = isNightMode ? '#3B82F6' : '#334155';
    }

    function openExternal() {
      vscode.postMessage({ command: 'openExternal' });
    }

    // Keyboard navigation
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
          currentScale = 1.0;
          syncZoomSelect();
          renderAllPages();
        }
      } else if (e.key === 'PageDown' || e.key === 'ArrowRight') {
        nextPage();
      } else if (e.key === 'PageUp' || e.key === 'ArrowLeft') {
        prevPage();
      } else if (e.key === 'Home') {
        firstPage();
      } else if (e.key === 'End') {
        lastPage();
      }
    });
  </script>
</body>
</html>`;
  }
}
