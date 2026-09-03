import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

export class ClipboardHelper {
  /**
   * Copies formatted HTML to the system clipboard with text/html MIME type
   * so that it can be pasted into Google Docs with full formatting intact.
   */
  public static async copyHtml(htmlContent: string, plainText: string): Promise<boolean> {
    const platform = os.platform();

    try {
      if (platform === 'win32') {
        const success = await this.copyWindowsHtml(htmlContent, plainText);
        if (success) return true;
      } else if (platform === 'darwin') {
        const success = await this.copyMacHtml(htmlContent, plainText);
        if (success) return true;
      } else if (platform === 'linux') {
        const success = await this.copyLinuxHtml(htmlContent, plainText);
        if (success) return true;
      }
    } catch (e) {
      console.warn('Native HTML clipboard copy failed, falling back to VS Code clipboard:', e);
    }

    // Fallback: write HTML text to VS Code clipboard
    await vscode.env.clipboard.writeText(htmlContent);
    return false;
  }

  private static copyWindowsHtml(html: string, plainText: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Build CF_HTML Windows standard clipboard format
      const cfHtml = this.buildCfHtml(html);

      // Create a temporary script file to prevent shell escaping issues
      const tempDir = os.tmpdir();
      const tempHtmlFile = path.join(tempDir, `md2gdocs_${Date.now()}.html`);
      const tempPsFile = path.join(tempDir, `md2gdocs_${Date.now()}.ps1`);

      try {
        fs.writeFileSync(tempHtmlFile, cfHtml, 'utf8');

        // PowerShell script using Windows Forms or PresentationCore
        const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$htmlData = [System.IO.File]::ReadAllText("${tempHtmlFile.replace(/\\/g, '\\\\')}", [System.Text.Encoding]::UTF8)
$dataObject = New-Object System.Windows.Forms.DataObject
$dataObject.SetData([System.Windows.Forms.DataFormats]::Html, $htmlData)
[System.Windows.Forms.Clipboard]::SetDataObject($dataObject, $true)
`;

        fs.writeFileSync(tempPsFile, psScript, 'utf8');

        const child = spawn('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          tempPsFile
        ]);

        child.on('close', (code) => {
          // Cleanup temp files
          try {
            if (fs.existsSync(tempHtmlFile)) fs.unlinkSync(tempHtmlFile);
            if (fs.existsSync(tempPsFile)) fs.unlinkSync(tempPsFile);
          } catch (_) {}

          resolve(code === 0);
        });

        child.on('error', () => {
          resolve(false);
        });
      } catch (err) {
        resolve(false);
      }
    });
  }

  private static copyMacHtml(html: string, plainText: string): Promise<boolean> {
    return new Promise((resolve) => {
      // osascript or textutil
      const child = spawn('osascript', ['-e', `
        use framework "Foundation"
        use framework "AppKit"
        set pb to current application's NSPasteboard's generalPasteboard()
        pb's clearContents()
        set htmlData to (current application's NSString's stringWithString:"${html.replace(/"/g, '\\"')}")'s dataUsingEncoding:(current application's NSUTF8StringEncoding)
        pb's setData:htmlData forType:(current application's NSPasteboardTypeHTML)
      `]);

      child.on('close', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    });
  }

  private static copyLinuxHtml(html: string, plainText: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Auto-detect Wayland vs X11
      const isWayland = Boolean(process.env['WAYLAND_DISPLAY']);
      const primaryCmd = isWayland ? 'wl-copy' : 'xclip';
      const primaryArgs = isWayland ? ['-t', 'text/html'] : ['-selection', 'clipboard', '-t', 'text/html'];

      const child = spawn(primaryCmd, primaryArgs);
      child.stdin.write(html);
      child.stdin.end();

      child.on('close', (code) => {
        if (code === 0) return resolve(true);
        // Fallback to xclip if wl-copy wasn't present or vice-versa
        const fallbackCmd = isWayland ? 'xclip' : 'wl-copy';
        const fallbackArgs = isWayland ? ['-selection', 'clipboard', '-t', 'text/html'] : ['-t', 'text/html'];
        try {
          const fb = spawn(fallbackCmd, fallbackArgs);
          fb.stdin.write(html);
          fb.stdin.end();
          fb.on('close', (fbCode) => resolve(fbCode === 0));
          fb.on('error', () => resolve(false));
        } catch (_) {
          resolve(false);
        }
      });

      child.on('error', () => {
        // Try fallback tool
        const fallbackCmd = isWayland ? 'xclip' : 'wl-copy';
        const fallbackArgs = isWayland ? ['-selection', 'clipboard', '-t', 'text/html'] : ['-t', 'text/html'];
        try {
          const fb = spawn(fallbackCmd, fallbackArgs);
          fb.stdin.write(html);
          fb.stdin.end();
          fb.on('close', (fbCode) => resolve(fbCode === 0));
          fb.on('error', () => resolve(false));
        } catch (_) {
          resolve(false);
        }
      });
    });
  }

  /**
   * Windows standard CF_HTML format header
   */
  private static buildCfHtml(htmlContent: string): string {
    const headerPrefix = 
      'Version:0.9\r\n' +
      'StartHTML:<<<<<<<<1\r\n' +
      'EndHTML:<<<<<<<<2\r\n' +
      'StartFragment:<<<<<<<<3\r\n' +
      'EndFragment:<<<<<<<<4\r\n';

    const startHtml = '<html>\r\n<body>\r\n<!--StartFragment-->';
    const endHtml = '<!--EndFragment-->\r\n</body>\r\n</html>';

    const fullDoc = headerPrefix + startHtml + htmlContent + endHtml;
    const utf8Bytes = Buffer.from(fullDoc, 'utf8');

    const startHtmlPos = Buffer.from(headerPrefix, 'utf8').length;
    const startFragPos = startHtmlPos + Buffer.from(startHtml, 'utf8').length;
    const endFragPos = startFragPos + Buffer.from(htmlContent, 'utf8').length;
    const endHtmlPos = endFragPos + Buffer.from(endHtml, 'utf8').length;

    const pad = (n: number) => n.toString().padStart(10, '0');

    return fullDoc
      .replace('<<<<<<<<1', pad(startHtmlPos))
      .replace('<<<<<<<<2', pad(endHtmlPos))
      .replace('<<<<<<<<3', pad(startFragPos))
      .replace('<<<<<<<<4', pad(endFragPos));
  }
}
