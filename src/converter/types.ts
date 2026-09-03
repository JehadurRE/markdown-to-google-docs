export interface CalloutStyle {
  bg: string;
  border: string;
  text: string;
  icon: string;
}

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
    note: CalloutStyle;
    tip: CalloutStyle;
    important: CalloutStyle;
    warning: CalloutStyle;
    caution: CalloutStyle;
    info: CalloutStyle;
    success: CalloutStyle;
    danger: CalloutStyle;
    question: CalloutStyle;
    quote: CalloutStyle;
    todo: CalloutStyle;
    example: CalloutStyle;
    [key: string]: CalloutStyle;
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
  // Per-document override options
  theme?: string;
  toc?: boolean;
  toc_depth?: number;
  zebra_stripes?: boolean;
  code_theme?: 'github-light' | 'github-dark' | 'solarized-light' | 'monokai-subtle';
  font?: string;
  [key: string]: any;
}

export interface TocItem {
  level: number;
  text: string;
  slug: string;
}

export interface FootnoteItem {
  id: string;
  label: string;
  content: string;
}

export interface ConverterOptions {
  theme?: string;
  customTheme?: Partial<ThemeColors>;
  fontFamily?: string;
  includeToc?: boolean;
  tocDepth?: number;
  tocTitle?: string;
  tableZebraStriping?: boolean;
  codeBlockTheme?: 'github-light' | 'github-dark' | 'solarized-light' | 'monokai-subtle';
  codeBlockLanguageBadges?: boolean;
  enableFootnotes?: boolean;
  baseDir?: string;
}

export interface ConversionResult {
  html: string;
  clipboardHtml: string;
  frontmatter: FrontmatterData;
  title: string;
  toc: TocItem[];
  footnotes: FootnoteItem[];
}
