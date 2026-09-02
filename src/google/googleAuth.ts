import * as vscode from 'vscode';
import * as http from 'http';
import * as url from 'url';
import * as https from 'https';

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  scope?: string;
}

export class GoogleAuthService {
  private static readonly SECRET_KEY = 'md2gdocs_google_tokens';
  private static readonly CLIENT_ID_KEY = 'md2gdocs_custom_client_id';
  private static readonly CLIENT_SECRET_KEY = 'md2gdocs_custom_client_secret';
  
  // Default open public client ID for VS Code Google Drive integration
  // or user-provided credentials via settings/prompt
  private static readonly DEFAULT_CLIENT_ID = '';
  private static readonly DEFAULT_CLIENT_SECRET = '';

  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Retrieves an active valid access token. Automatically refreshes if expired.
   */
  public async getValidAccessToken(): Promise<string | null> {
    const tokens = await this.getStoredTokens();
    if (!tokens) {
      return null;
    }

    // Check if access token is still valid (with 60s buffer)
    const now = Date.now();
    if (tokens.expiry_date && tokens.expiry_date > now + 60000) {
      return tokens.access_token;
    }

    // If expired but we have a refresh token, refresh it
    if (tokens.refresh_token) {
      try {
        const refreshed = await this.refreshAccessToken(tokens.refresh_token);
        return refreshed.access_token;
      } catch (err) {
        console.error('Failed to refresh Google access token:', err);
        return null;
      }
    }

    return null;
  }

  public async getStoredTokens(): Promise<AuthTokens | null> {
    const raw = await this.context.secrets.get(GoogleAuthService.SECRET_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public async saveTokens(tokens: AuthTokens): Promise<void> {
    await this.context.secrets.store(GoogleAuthService.SECRET_KEY, JSON.stringify(tokens));
  }

  public async logout(): Promise<void> {
    await this.context.secrets.delete(GoogleAuthService.SECRET_KEY);
  }

  /**
   * Initiates Google OAuth 2.0 Loopback Flow
   */
  public async signIn(): Promise<AuthTokens> {
    const { clientId, clientSecret } = await this.getClientCredentials();

    return new Promise((resolve, reject) => {
      // Create local temporary HTTP server on random available port
      const server = http.createServer(async (req, res) => {
        const reqUrl = new URL(req.url || '', `http://${req.headers.host}`);
        if (reqUrl.pathname === '/callback') {
          const code = reqUrl.searchParams.get('code');
          const error = reqUrl.searchParams.get('error');

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<html><body style="font-family: sans-serif; text-align: center; padding: 50px;"><h2>Authentication failed: ${error}</h2><p>You can close this window and try again.</p></body></html>`);
            server.close();
            reject(new Error(`Google authentication failed: ${error}`));
            return;
          }

          if (code) {
            try {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>Authentication Successful</title>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; }
                    .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; max-width: 420px; }
                    h2 { color: #0f172a; margin-bottom: 8px; }
                    p { color: #64748b; font-size: 15px; }
                    .icon { font-size: 48px; margin-bottom: 16px; }
                  </style>
                </head>
                <body>
                  <div class="card">
                    <div class="icon">✅</div>
                    <h2>Connected to Google Drive</h2>
                    <p>Authentication was successful! You can now close this tab and return to VS Code to upload your document.</p>
                  </div>
                </body>
                </html>
              `);

              // Exchange authorization code for tokens
              const port = (server.address() as any).port;
              const redirectUri = `http://127.0.0.1:${port}/callback`;
              const tokens = await this.exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);
              await this.saveTokens(tokens);
              server.close();
              resolve(tokens);
            } catch (exchangeErr) {
              server.close();
              reject(exchangeErr);
            }
          }
        }
      });

      server.listen(0, '127.0.0.1', async () => {
        const port = (server.address() as any).port;
        const redirectUri = `http://127.0.0.1:${port}/callback`;
        const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file');

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

        // Open in browser
        vscode.env.openExternal(vscode.Uri.parse(authUrl));
      });

      server.on('error', (err) => {
        reject(err);
      });

      // Timeout after 2 minutes if user doesn't complete login
      setTimeout(() => {
        server.close();
        reject(new Error('Google authentication timed out after 2 minutes.'));
      }, 120000);
    });
  }

  private async getClientCredentials(): Promise<{ clientId: string; clientSecret: string }> {
    const config = vscode.workspace.getConfiguration('md2gdocs');
    let clientId = config.get<string>('googleClientId');
    let clientSecret = config.get<string>('googleClientSecret');

    if (!clientId) {
      // Prompt user for Google OAuth Client ID or provide guidance
      const choice = await vscode.window.showInformationMessage(
        'To upload directly to Google Drive, a Google OAuth Client ID is required. Would you like to enter your credentials now?',
        'Enter Client ID & Secret',
        'Quick Guide'
      );

      if (choice === 'Quick Guide') {
        vscode.env.openExternal(vscode.Uri.parse('https://developers.google.com/workspace/guides/create-credentials#oauth-client-id'));
      }

      if (choice === 'Enter Client ID & Secret') {
        clientId = await vscode.window.showInputBox({
          prompt: 'Enter your Google Cloud OAuth 2.0 Client ID',
          placeHolder: '123456789-xxxxxx.apps.googleusercontent.com',
          ignoreFocusOut: true
        });

        if (clientId) {
          clientSecret = await vscode.window.showInputBox({
            prompt: 'Enter your Google Cloud OAuth 2.0 Client Secret',
            password: true,
            ignoreFocusOut: true
          });

          if (clientSecret) {
            await config.update('googleClientId', clientId, vscode.ConfigurationTarget.Global);
            await config.update('googleClientSecret', clientSecret, vscode.ConfigurationTarget.Global);
          }
        }
      }
    }

    if (!clientId || !clientSecret) {
      throw new Error('Google Client ID and Secret are required to upload to Google Drive. You can set them in Settings or use "Copy for Google Docs" for zero-setup instant paste.');
    }

    return { clientId, clientSecret };
  }

  private exchangeCodeForTokens(code: string, clientId: string, clientSecret: string, redirectUri: string): Promise<AuthTokens> {
    return new Promise((resolve, reject) => {
      const postData = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }).toString();

      const options = {
        hostname: 'oauth2.googleapis.com',
        port: 443,
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              reject(new Error(`Token error: ${parsed.error_description || parsed.error}`));
              return;
            }

            const tokens: AuthTokens = {
              access_token: parsed.access_token,
              refresh_token: parsed.refresh_token,
              expiry_date: Date.now() + (parsed.expires_in * 1000),
              token_type: parsed.token_type,
              scope: parsed.scope
            };
            resolve(tokens);
          } catch (e) {
            reject(new Error(`Failed to parse token response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  private async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    const { clientId, clientSecret } = await this.getClientCredentials();

    return new Promise((resolve, reject) => {
      const postData = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token'
      }).toString();

      const options = {
        hostname: 'oauth2.googleapis.com',
        port: 443,
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', async () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              reject(new Error(`Refresh token error: ${parsed.error_description || parsed.error}`));
              return;
            }

            const existing = await this.getStoredTokens();
            const updated: AuthTokens = {
              ...existing,
              access_token: parsed.access_token,
              expiry_date: Date.now() + (parsed.expires_in * 1000),
              refresh_token: parsed.refresh_token || refreshToken
            };

            await this.saveTokens(updated);
            resolve(updated);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }
}
