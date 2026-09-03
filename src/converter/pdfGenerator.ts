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

    // Create print-optimized standalone HTML with table-based repeating header/footer
    const paperSize = this.options.paperFormat || 'Letter';
    const orientation = this.options.landscape ? 'landscape' : 'portrait';

    const headerText = result.frontmatter.header || (this.options.headerText as string) || '';
    const footerText = result.frontmatter.footer || (this.options.footerText as string) || (result.frontmatter.page_numbers !== false ? 'Confidential' : '');
    const docTitle = result.frontmatter.title || 'Document';

    const theadHtml = headerText ? `
    <thead>
      <tr>
        <td style="border: none; padding: 0 0 10pt 0; height: 14mm; vertical-align: top;">
          <div style="display: flex; justify-content: space-between; font-size: 8.5pt; color: #64748B; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px; font-family: Inter, Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
            <span>${this.escapeHtml(headerText)}</span>
            <span>${this.escapeHtml(docTitle)}</span>
          </div>
        </td>
      </tr>
    </thead>` : '';

    const tfootHtml = footerText ? `
    <tfoot>
      <tr>
        <td style="border: none; padding: 10pt 0 0 0; height: 12mm; vertical-align: bottom;">
          <div style="display: flex; justify-content: space-between; font-size: 8.5pt; color: #64748B; border-top: 1px solid #CBD5E1; padding-top: 4px; font-family: Inter, Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
            <span>${this.escapeHtml(footerText)}</span>
            <span>${this.escapeHtml(docTitle)}</span>
          </div>
        </td>
      </tr>
    </tfoot>` : '';

    // Remove static running header/footer divs from body so they don't duplicate
    let cleanHtml = result.html;
    cleanHtml = cleanHtml.replace(/<div class="doc-running-header"[\s\S]*?<\/div>/i, '');
    cleanHtml = cleanHtml.replace(/<div class="doc-running-footer"[\s\S]*?<\/div>/i, '');

    // Inject table wrapper around the content inside .page-container
    cleanHtml = cleanHtml.replace('<div class="page-container">', `<div class="page-container">
  <table style="width: 100%; border-collapse: collapse; border: none;">
    ${theadHtml}
    <tbody>
      <tr>
        <td style="border: none; padding: 0; vertical-align: top;">`);

    cleanHtml = cleanHtml.replace('</div>\n</body>', `        </td>
      </tr>
    </tbody>
    ${tfootHtml}
  </table>
</div>
</body>`);

    const printHtml = cleanHtml.replace('</head>', `
  <style>
    @page {
      size: ${paperSize} ${orientation};
      margin: 14mm 16mm;
    }
    @media print {
      body {
        background: transparent !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .page-container {
        margin: 0 !important;
        padding: 0 !important;
        max-width: 100% !important;
        box-shadow: none !important;
        border-radius: 0 !important;
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
      table.doc-toc-container, table.gdoc-callout, table.gdoc-diagram, table.gdoc-code-block, table.gdoc-blockquote, table.gdoc-table, .math-block, pre, blockquote, dl {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid !important;
        break-after: avoid !important;
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

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
