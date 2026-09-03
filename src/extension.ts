import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GoogleDocsHtmlGenerator } from './converter/googleDocsHtmlGenerator';
import { DocxGenerator } from './converter/docxGenerator';
import { PdfGenerator } from './converter/pdfGenerator';
import { ClipboardHelper } from './clipboard/clipboardHelper';
import { GoogleAuthService } from './google/googleAuth';
import { GoogleDriveClient } from './google/googleDriveClient';
import { GoogleDocsPreviewPanel } from './preview/previewPanel';
import { ALL_THEMES, getTheme } from './converter/themes';

let authService: GoogleAuthService;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  authService = new GoogleAuthService(context);

  // Status Bar Item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'md2gdocs.copyForGoogleDocs';
  statusBarItem.text = '$(copy) Copy for GDocs';
  statusBarItem.tooltip = 'Copy formatted document for Google Docs (Markdown to Google Docs)';
  context.subscriptions.push(statusBarItem);

  // Update status bar on editor change
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateStatusBar)
  );
  updateStatusBar(vscode.window.activeTextEditor);

  // 1. Command: Copy for Google Docs (Rich Formatted)
  const copyCommand = vscode.commands.registerCommand(
    'md2gdocs.copyForGoogleDocs',
    async (uri?: vscode.Uri) => {
      const document = await getTargetDocument(uri);
      if (!document) return;

      try {
        const config = vscode.workspace.getConfiguration('md2gdocs');
        const theme = config.get<string>('defaultTheme', 'modern-corporate');
        const includeToc = config.get<boolean>('includeTableOfContents', true);
        const tableZebraStriping = config.get<boolean>('tableZebraStriping', true);
        const baseDir = path.dirname(document.uri.fsPath);

        const generator = new GoogleDocsHtmlGenerator({
          theme,
          includeToc,
          tableZebraStriping,
          baseDir
        });

        const result = generator.convert(document.getText());
        await ClipboardHelper.copyHtml(result.clipboardHtml, document.getText());

        const action = await vscode.window.showInformationMessage(
          `✅ Copied "${result.title}" formatted for Google Docs! Paste (Ctrl+V / Cmd+V) directly into Google Docs.`,
          'Open Google Docs (docs.new)'
        );

        if (action === 'Open Google Docs (docs.new)') {
          vscode.env.openExternal(vscode.Uri.parse('https://docs.new'));
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to copy for Google Docs: ${err.message}`);
      }
    }
  );

  // 2. Command: Upload to Google Docs (Cloud Sync)
  const uploadCommand = vscode.commands.registerCommand(
    'md2gdocs.convertToGoogleDocs',
    async (uri?: vscode.Uri) => {
      const document = await getTargetDocument(uri);
      if (!document) return;

      try {
        let token = await authService.getValidAccessToken();

        if (!token) {
          const authPrompt = await vscode.window.showInformationMessage(
            'Google authentication is required to upload directly to Google Drive. Sign in with Google now?',
            'Sign In',
            'Cancel'
          );

          if (authPrompt !== 'Sign In') return;

          vscode.window.showInformationMessage('Starting Google sign-in. Please complete authorization in your browser...');
          const tokens = await authService.signIn();
          token = tokens.access_token;
        }

        const config = vscode.workspace.getConfiguration('md2gdocs');
        const theme = config.get<string>('defaultTheme', 'modern-corporate');
        const includeToc = config.get<boolean>('includeTableOfContents', true);
        const folderId = config.get<string>('googleDriveFolderId', '');
        const autoOpen = config.get<boolean>('openAfterUpload', true);
        const baseDir = path.dirname(document.uri.fsPath);

        const generator = new GoogleDocsHtmlGenerator({
          theme,
          includeToc,
          baseDir
        });

        const result = generator.convert(document.getText());

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Converting & uploading "${result.title}" to Google Docs...`,
            cancellable: false
          },
          async () => {
            const uploadRes = await GoogleDriveClient.uploadToGoogleDocs({
              title: result.title,
              htmlContent: result.html,
              folderId: folderId || undefined,
              accessToken: token!
            });

            if (autoOpen) {
              vscode.env.openExternal(vscode.Uri.parse(uploadRes.editUrl));
            }

            const selection = await vscode.window.showInformationMessage(
              `🎉 Created Google Doc: "${uploadRes.name}"!`,
              'Open in Browser',
              'Copy Link'
            );

            if (selection === 'Open in Browser') {
              vscode.env.openExternal(vscode.Uri.parse(uploadRes.editUrl));
            } else if (selection === 'Copy Link') {
              await vscode.env.clipboard.writeText(uploadRes.editUrl);
              vscode.window.showInformationMessage('Document link copied to clipboard!');
            }
          }
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Upload to Google Docs failed: ${err.message}`);
      }
    }
  );

  // 3. Command: Show Live Preview
  const previewCommand = vscode.commands.registerCommand(
    'md2gdocs.showPreview',
    async (uri?: vscode.Uri) => {
      const document = await getTargetDocument(uri);
      if (!document) return;

      GoogleDocsPreviewPanel.createOrShow(context.extensionUri, document.uri);
    }
  );

  // 4. Command: Export as Google Docs HTML
  const exportHtmlCommand = vscode.commands.registerCommand(
    'md2gdocs.exportHtml',
    async (uri?: vscode.Uri) => {
      const document = await getTargetDocument(uri);
      if (!document) return;

      try {
        const config = vscode.workspace.getConfiguration('md2gdocs');
        const theme = config.get<string>('defaultTheme', 'modern-corporate');
        const baseDir = path.dirname(document.uri.fsPath);

        const generator = new GoogleDocsHtmlGenerator({ theme, baseDir });
        const result = generator.convert(document.getText());

        const defaultName = path.basename(document.uri.fsPath, path.extname(document.uri.fsPath)) + '.html';
        const defaultUri = vscode.Uri.file(path.join(baseDir, defaultName));

        const targetUri = await vscode.window.showSaveDialog({
          defaultUri,
          filters: { 'HTML Files': ['html', 'htm'] },
          saveLabel: 'Export Google Docs HTML'
        });

        if (targetUri) {
          fs.writeFileSync(targetUri.fsPath, result.html, 'utf8');
          const choice = await vscode.window.showInformationMessage(
            `Saved Google Docs HTML: ${path.basename(targetUri.fsPath)}`,
            'Open File'
          );
          if (choice === 'Open File') {
            vscode.env.openExternal(targetUri);
          }
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Export HTML failed: ${err.message}`);
      }
    }
  );

  // 5. Command: Export as DOCX
  const exportDocxCommand = vscode.commands.registerCommand(
    'md2gdocs.exportDocx',
    async (uri?: vscode.Uri) => {
      const document = await getTargetDocument(uri);
      if (!document) return;

      try {
        const config = vscode.workspace.getConfiguration('md2gdocs');
        const theme = config.get<string>('defaultTheme', 'modern-corporate');
        const baseDir = path.dirname(document.uri.fsPath);

        const docxGenerator = new DocxGenerator({ theme, baseDir });
        const buffer = await docxGenerator.generateDocx(document.getText());

        const defaultName = path.basename(document.uri.fsPath, path.extname(document.uri.fsPath)) + '.docx';
        const defaultUri = vscode.Uri.file(path.join(baseDir, defaultName));

        const targetUri = await vscode.window.showSaveDialog({
          defaultUri,
          filters: { 'Word / Google Doc': ['docx'] },
          saveLabel: 'Export DOCX'
        });

        if (targetUri) {
          fs.writeFileSync(targetUri.fsPath, buffer);
          const choice = await vscode.window.showInformationMessage(
            `Saved DOCX: ${path.basename(targetUri.fsPath)}`,
            'Open File'
          );
          if (choice === 'Open File') {
            vscode.env.openExternal(targetUri);
          }
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Export DOCX failed: ${err.message}`);
      }
    }
  );

  // 6. Command: Export as PDF
  const exportPdfCommand = vscode.commands.registerCommand(
    'md2gdocs.exportPdf',
    async (uri?: vscode.Uri) => {
      const document = await getTargetDocument(uri);
      if (!document) return;

      try {
        const config = vscode.workspace.getConfiguration('md2gdocs');
        const theme = config.get<string>('defaultTheme', 'modern-corporate');
        const baseDir = path.dirname(document.uri.fsPath);

        const defaultName = path.basename(document.uri.fsPath, path.extname(document.uri.fsPath)) + '.pdf';
        const defaultUri = vscode.Uri.file(path.join(baseDir, defaultName));

        const targetUri = await vscode.window.showSaveDialog({
          defaultUri,
          filters: { 'PDF Document': ['pdf'] },
          saveLabel: 'Export PDF'
        });

        if (!targetUri) return;

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Exporting "${path.basename(targetUri.fsPath)}" to PDF...`,
            cancellable: false
          },
          async () => {
            const pdfGen = new PdfGenerator({ theme, baseDir });
            await pdfGen.generatePdf(document.getText(), targetUri.fsPath);

            const choice = await vscode.window.showInformationMessage(
              `🎉 Saved PDF: ${path.basename(targetUri.fsPath)}`,
              'Open File',
              'Reveal in File Explorer'
            );
            if (choice === 'Open File') {
              vscode.env.openExternal(targetUri);
            } else if (choice === 'Reveal in File Explorer') {
              vscode.commands.executeCommand('revealFileInOS', targetUri);
            }
          }
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Export PDF failed: ${err.message}`);
      }
    }
  );

  // 6. Command: Select Theme
  const selectThemeCommand = vscode.commands.registerCommand(
    'md2gdocs.selectTheme',
    async () => {
      const config = vscode.workspace.getConfiguration('md2gdocs');
      const currentTheme = config.get<string>('defaultTheme', 'modern-corporate');

      const items = Object.keys(ALL_THEMES).map((key) => {
        const t = ALL_THEMES[key];
        return {
          label: `${key === currentTheme ? '$(check) ' : ''}${t.displayName}`,
          description: t.name,
          detail: t.description,
          themeKey: key
        };
      });

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a professional theme for Google Docs conversion'
      });

      if (selected) {
        await config.update('defaultTheme', selected.themeKey, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Theme set to: ${ALL_THEMES[selected.themeKey].displayName}`);
      }
    }
  );

  // 7. Command: Authenticate Google Account
  const authCommand = vscode.commands.registerCommand(
    'md2gdocs.authenticateGoogle',
    async () => {
      try {
        vscode.window.showInformationMessage('Initiating Google sign-in. Please authorize in browser...');
        await authService.signIn();
        vscode.window.showInformationMessage('✅ Google account connected successfully!');
      } catch (err: any) {
        vscode.window.showErrorMessage(`Google authentication failed: ${err.message}`);
      }
    }
  );

  // 8. Command: Sign Out
  const logoutCommand = vscode.commands.registerCommand(
    'md2gdocs.logoutGoogle',
    async () => {
      await authService.logout();
      vscode.window.showInformationMessage('Signed out of Google account.');
    }
  );

  context.subscriptions.push(
    copyCommand,
    uploadCommand,
    previewCommand,
    exportHtmlCommand,
    exportDocxCommand,
    exportPdfCommand,
    selectThemeCommand,
    authCommand,
    logoutCommand
  );
}

function updateStatusBar(editor: vscode.TextEditor | undefined) {
  if (editor && editor.document.languageId === 'markdown') {
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

async function getTargetDocument(uri?: vscode.Uri): Promise<vscode.TextDocument | undefined> {
  if (uri) {
    try {
      return await vscode.workspace.openTextDocument(uri);
    } catch {
      // Fall through to active editor
    }
  }

  const editor = vscode.window.activeTextEditor;
  if (editor && editor.document.languageId === 'markdown') {
    return editor.document;
  }

  vscode.window.showWarningMessage('Please open a Markdown (.md) file to convert to Google Docs.');
  return undefined;
}

export function deactivate() {}
