declare module 'mammoth' {
  export interface ConversionResult {
    value: string;
    messages: Array<{
      type: string;
      message: string;
    }>;
  }

  export function convertToHtml(input: { path?: string; buffer?: Buffer }): Promise<ConversionResult>;
  export function convertToMarkdown(input: { path?: string; buffer?: Buffer }): Promise<ConversionResult>;
  export function extractRawText(input: { path?: string; buffer?: Buffer }): Promise<ConversionResult>;
}
