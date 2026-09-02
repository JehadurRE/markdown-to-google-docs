export interface ThemeColors {
  name: string;
  displayName: string;
  description: string;
  primary: string;         // Main headers, accent text
  primaryLight: string;    // Light tint for tags, badges, header highlights
  secondary: string;       // Subheaders, secondary accents
  accent: string;          // Callout borders, buttons, links
  text: string;            // Main body text
  textMuted: string;       // Metadata, captions, footers
  bgDocument: string;      // Document page background
  bgCard: string;          // Metadata card / blockquote / callout background
  border: string;          // Subtle divider, table border
  borderDark: string;      // Darker border for emphasis
  tableHeaderBg: string;   // Table header row background
  tableHeaderText: string; // Table header row text
  tableZebraBg: string;    // Table alternating row background
  codeBg: string;          // Code block background
  codeText: string;        // Code block default text
  codeBorder: string;      // Code block border
  inlineCodeBg: string;    // Inline `code` background
  inlineCodeText: string;  // Inline `code` text
  callouts: {
    note: { bg: string; border: string; text: string; icon: string };
    tip: { bg: string; border: string; text: string; icon: string };
    important: { bg: string; border: string; text: string; icon: string };
    warning: { bg: string; border: string; text: string; icon: string };
    caution: { bg: string; border: string; text: string; icon: string };
  };
  fontFamily: string;
  headingFontFamily: string;
  codeFontFamily: string;
}

export interface FrontmatterData {
  title?: string;
  subtitle?: string;
  author?: string;
  authors?: string[];
  date?: string;
  version?: string;
  status?: string;
  tags?: string[];
  category?: string;
  description?: string;
  organization?: string;
  [key: string]: any;
}

export interface TocItem {
  level: number;
  text: string;
  slug: string;
}

export interface ConverterOptions {
  theme?: string;
  customTheme?: Partial<ThemeColors>;
  fontFamily?: string;
  includeToc?: boolean;
  tableZebraStriping?: boolean;
  codeBlockTheme?: 'github-light' | 'github-dark' | 'solarized-light' | 'monokai-subtle';
  baseDir?: string;
}

export interface ConversionResult {
  html: string;
  clipboardHtml: string;
  frontmatter: FrontmatterData;
  title: string;
  toc: TocItem[];
}
