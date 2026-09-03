import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec, execSync } from 'child_process';
import { GoogleDocsHtmlGenerator } from './googleDocsHtmlGenerator';
import { ConverterOptions } from './types';

export interface PdfExportOptions extends ConverterOptions {
  paperFormat?: 'Letter' | 'A4' | 'Legal';
  landscape?: boolean;
}

export class PdfGenerator {
  private options: PdfExportOptions;

  constructor(options: PdfExportOptions = {}) {
    this.options = options;
  }

  /**
   * Finds the path to an installed Chromium-based browser on the current system
   */
  public static findChromiumBrowser(): string | null {
    const platform = os.platform();

    if (platform === 'win32') {
      const candidates = [
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
        path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe'),
        path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(process.env['LOCALAPPDATA'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(process.env['LOCALAPPDATA'] || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
        path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe')
      ];

      for (const p of candidates) {
        if (p && fs.existsSync(p)) {
          return p;
        }
      }

      // Try PATH via 'where'
      for (const bin of ['msedge.exe', 'chrome.exe', 'brave.exe']) {
        try {
          const stdout = execSync(`where ${bin}`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
          const firstLine = stdout.split(/\r?\n/)[0].trim();
          if (firstLine && fs.existsSync(firstLine)) {
            return firstLine;
          }
        } catch (_) {}
      }
    } else if (platform === 'darwin') {
      const candidates = [
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        '/Applications/Chromium.app/Contents/MacOS/Chromium'
      ];

      for (const p of candidates) {
        if (fs.existsSync(p)) {
          return p;
        }
      }
    } else {
      // Linux
      const candidates = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/microsoft-edge',
        '/usr/bin/microsoft-edge-stable',
        '/usr/bin/brave-browser'
      ];

      for (const p of candidates) {
        if (fs.existsSync(p)) {
          return p;
        }
      }

      for (const bin of ['google-chrome', 'chromium', 'microsoft-edge']) {
        try {
          const stdout = execSync(`which ${bin}`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
          if (stdout && fs.existsSync(stdout)) {
            return stdout;
          }
        } catch (_) {}
      }
    }

    return null;
  }

  /**
   * Generates a PDF file from Markdown content
   */
  public async generatePdf(markdownContent: string, outputPdfPath: string): Promise<string> {
    const htmlGen = new GoogleDocsHtmlGenerator(this.options);
    const result = htmlGen.convert(markdownContent);

    // Create print-optimized standalone HTML
    const paperSize = this.options.paperFormat || 'Letter';
    const orientation = this.options.landscape ? 'landscape' : 'portrait';

    const printHtml = result.html.replace('</head>', `
  <style>
    @page {
      size: ${paperSize} ${orientation};
      margin: 18mm 16mm;
    }
    @media print {
      body {
        background-color: transparent !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .page-container {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 14mm 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      .doc-running-header {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        display: flex !important;
        justify-content: space-between !important;
        border-bottom: 1px solid #CBD5E1 !important;
        padding-bottom: 4px !important;
        font-size: 8.5pt !important;
        color: #64748B !important;
      }
      .doc-running-footer {
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        display: flex !important;
        justify-content: space-between !important;
        border-top: 1px solid #CBD5E1 !important;
        padding-top: 4px !important;
        font-size: 8.5pt !important;
        color: #64748B !important;
      }
      .gdoc-pagebreak {
        page-break-before: always !important;
        break-before: page !important;
        height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        border-top: none !important;
      }
      .gdoc-pagebreak::after {
        display: none !important;
      }
      a {
        text-decoration: none !important;
      }
    }
  </style>
</head>`);

    const tempHtmlDir = os.tmpdir();
    const tempHtmlFile = path.join(tempHtmlDir, `md2gdocs_${Date.now()}_${Math.random().toString(36).substring(7)}.html`);
    fs.writeFileSync(tempHtmlFile, printHtml, 'utf8');

    const browserPath = PdfGenerator.findChromiumBrowser();
    if (!browserPath) {
      try { fs.unlinkSync(tempHtmlFile); } catch (_) {}
      throw new Error('No Chromium-based browser (Microsoft Edge, Google Chrome, or Chromium) was found to generate PDF. Please ensure Edge or Chrome is installed.');
    }

    try {
      const fileUrl = `file:///${tempHtmlFile.replace(/\\/g, '/')}`;
      const cmd = `"${browserPath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${outputPdfPath}" "${fileUrl}"`;

      await new Promise<void>((resolve, reject) => {
        exec(cmd, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      if (!fs.existsSync(outputPdfPath)) {
        throw new Error('PDF output file was not generated by browser.');
      }

      return outputPdfPath;
    } finally {
      try {
        if (fs.existsSync(tempHtmlFile)) {
          fs.unlinkSync(tempHtmlFile);
        }
      } catch (_) {}
    }
  }
}
