import * as https from 'https';

export interface DriveUploadOptions {
  title: string;
  htmlContent: string;
  folderId?: string;
  accessToken: string;
}

export interface DriveUploadResult {
  id: string;
  name: string;
  webViewLink: string;
  editUrl: string;
}

export class GoogleDriveClient {
  /**
   * Uploads HTML to Google Drive with mimeType application/vnd.google-apps.document
   * Google Drive automatically converts it into a native Google Doc with high fidelity!
   */
  public static async uploadToGoogleDocs(options: DriveUploadOptions): Promise<DriveUploadResult> {
    return new Promise((resolve, reject) => {
      const boundary = `-------md2gdocs_boundary_${Date.now()}`;
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const metadata: Record<string, any> = {
        name: options.title,
        mimeType: 'application/vnd.google-apps.document'
      };

      if (options.folderId && options.folderId.trim().length > 0) {
        metadata.parents = [options.folderId.trim()];
      }

      const metadataPart = 
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata);

      const mediaPart =
        delimiter +
        'Content-Type: text/html; charset=UTF-8\r\n\r\n' +
        options.htmlContent;

      const multipartBody = metadataPart + mediaPart + closeDelimiter;
      const bodyBuffer = Buffer.from(multipartBody, 'utf8');

      const requestOptions: https.RequestOptions = {
        hostname: 'www.googleapis.com',
        port: 443,
        path: '/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${options.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': bodyBuffer.length
        }
      };

      const req = https.request(requestOptions, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const fileData = JSON.parse(responseData);
              const editUrl = `https://docs.google.com/document/d/${fileData.id}/edit`;
              resolve({
                id: fileData.id,
                name: fileData.name,
                webViewLink: fileData.webViewLink || editUrl,
                editUrl
              });
            } catch (err) {
              reject(new Error(`Failed to parse Drive response: ${responseData}`));
            }
          } else {
            let errorMessage = `Google Drive upload failed (${res.statusCode}): ${responseData}`;
            try {
              const parsed = JSON.parse(responseData);
              if (parsed.error && parsed.error.message) {
                errorMessage = `Google Drive error: ${parsed.error.message}`;
              }
            } catch (_) {}
            reject(new Error(errorMessage));
          }
        });
      });

      req.on('error', reject);
      req.write(bodyBuffer);
      req.end();
    });
  }
}
