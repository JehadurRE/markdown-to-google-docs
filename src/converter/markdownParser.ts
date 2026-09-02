import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import * as fs from 'fs';
import * as path from 'path';
import { ConverterOptions, FrontmatterData, ThemeColors, TocItem } from './types';
import { getTheme } from './themes';

// Syntax highlighting inline style mappings
// Ensures colors are preserved when importing or pasting into Google Docs
const HIGHLIGHT_STYLES_LIGHT: Record<string, string> = {
  'hljs-keyword': 'color: #D73A49; font-weight: 600;',
  'hljs-built_in': 'color: #005CC5;',
  'hljs-type': 'color: #005CC5; font-weight: 600;',
  'hljs-literal': 'color: #005CC5;',
  'hljs-number': 'color: #005CC5;',
  'hljs-operator': 'color: #D73A49;',
  'hljs-punctuation': 'color: #24292E;',
  'hljs-string': 'color: #032F62;',
  'hljs-subst': 'color: #24292E;',
  'hljs-symbol': 'color: #E36209;',
  'hljs-class': 'color: #6F42C1; font-weight: 600;',
  'hljs-function': 'color: #6F42C1;',
  'hljs-title': 'color: #6F42C1; font-weight: 600;',
  'hljs-params': 'color: #24292E;',
  'hljs-comment': 'color: #6A737D; font-style: italic;',
  'hljs-doctag': 'color: #D73A49;',
  'hljs-meta': 'color: #005CC5;',
  'hljs-attr': 'color: #22863A;',
  'hljs-attribute': 'color: #005CC5;',
  'hljs-variable': 'color: #E36209;',
  'hljs-tag': 'color: #22863A;',
  'hljs-name': 'color: #22863A; font-weight: 600;',
  'hljs-selector-tag': 'color: #22863A;',
  'hljs-selector-id': 'color: #6F42C1;',
  'hljs-selector-class': 'color: #6F42C1;',
  'hljs-section': 'color: #005CC5; font-weight: 600;',
  'hljs-bullet': 'color: #735C0F;',
  'hljs-emphasis': 'font-style: italic;',
  'hljs-strong': 'font-weight: 700;',
  'hljs-addition': 'color: #22863A; background-color: #F0FFF4;',
  'hljs-deletion': 'color: #B31D28; background-color: #FFEEF0;'
};

const HIGHLIGHT_STYLES_DARK: Record<string, string> = {
  'hljs-keyword': 'color: #FF7B72; font-weight: 600;',
  'hljs-built_in': 'color: #79C0FF;',
  'hljs-type': 'color: #FFA657; font-weight: 600;',
  'hljs-literal': 'color: #79C0FF;',
  'hljs-number': 'color: #79C0FF;',
  'hljs-operator': 'color: #FF7B72;',
  'hljs-punctuation': 'color: #C9D1D9;',
  'hljs-string': 'color: #A5D6FF;',
  'hljs-subst': 'color: #C9D1D9;',
  'hljs-symbol': 'color: #FFA657;',
  'hljs-class': 'color: #D2A8FF; font-weight: 600;',
  'hljs-function': 'color: #D2A8FF;',
  'hljs-title': 'color: #D2A8FF; font-weight: 600;',
  'hljs-params': 'color: #C9D1D9;',
  'hljs-comment': 'color: #8B949E; font-style: italic;',
  'hljs-doctag': 'color: #FF7B72;',
  'hljs-meta': 'color: #79C0FF;',
  'hljs-attr': 'color: #7EE787;',
  'hljs-attribute': 'color: #79C0FF;',
  'hljs-variable': 'color: #FFA657;',
  'hljs-tag': 'color: #7EE787;',
  'hljs-name': 'color: #7EE787; font-weight: 600;',
  'hljs-selector-tag': 'color: #7EE787;',
  'hljs-selector-id': 'color: #D2A8FF;',
  'hljs-selector-class': 'color: #D2A8FF;',
  'hljs-section': 'color: #79C0FF; font-weight: 600;',
  'hljs-bullet': 'color: #F2CC60;',
  'hljs-emphasis': 'font-style: italic;',
  'hljs-strong': 'font-weight: 700;',
  'hljs-addition': 'color: #7EE787; background-color: #033A16;',
  'hljs-deletion': 'color: #FFA198; background-color: #4C0C14;'
};

export class MarkdownParser {
  private md: MarkdownIt;
  private theme: ThemeColors;
  private options: ConverterOptions;
  private toc: TocItem[] = [];

  constructor(options: ConverterOptions = {}) {
    this.options = options;
    this.theme = getTheme(options.theme);

    const isDarkCode = options.codeBlockTheme === 'github-dark' || options.theme === 'tech-violet';
    const highlightStyleMap = isDarkCode ? HIGHLIGHT_STYLES_DARK : HIGHLIGHT_STYLES_LIGHT;

    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      highlight: (str: string, lang: string): string => {
        let highlighted = '';
        if (lang && hljs.getLanguage(lang)) {
          try {
            highlighted = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
          } catch (__) {
            highlighted = this.md.utils.escapeHtml(str);
          }
        } else {
          try {
            highlighted = hljs.highlightAuto(str).value;
          } catch (__) {
            highlighted = this.md.utils.escapeHtml(str);
          }
        }

        // Convert hljs-* CSS classes into inline CSS styles for Google Docs
        highlighted = highlighted.replace(/<span class="([^"]+)">/g, (match, classNames) => {
          const classes = classNames.split(/\s+/);
          let inlineStyle = '';
          for (const cls of classes) {
            if (highlightStyleMap[cls]) {
              inlineStyle += highlightStyleMap[cls] + ' ';
            }
          }
          if (inlineStyle) {
            return `<span style="${inlineStyle.trim()}">`;
          }
          return match;
        });

        return highlighted;
      }
    });

    this.configureCustomRules();
  }

  private configureCustomRules(): void {
    // Custom heading rule to extract TOC items and inject clean anchors
    this.md.core.ruler.push('extract_toc', (state) => {
      this.toc = [];
      const tokens = state.tokens;

      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type === 'heading_open') {
          const level = parseInt(tokens[i].tag.substring(1), 10);
          const inlineToken = tokens[i + 1];
          if (inlineToken && inlineToken.type === 'inline') {
            const title = inlineToken.content;
            const slug = title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '');

            tokens[i].attrSet('id', slug);
            this.toc.push({ level, text: title, slug });
          }
        }
      }
      return true;
    });
  }

  public parse(markdownInput: string): {
    frontmatter: FrontmatterData;
    bodyMarkdown: string;
    parsedHtml: string;
    toc: TocItem[];
  } {
    // 1. Extract Frontmatter using gray-matter
    let frontmatter: FrontmatterData = {};
    let content = markdownInput;

    try {
      const parsed = matter(markdownInput);
      frontmatter = parsed.data || {};
      content = parsed.content;
    } catch (e) {
      // Fallback if frontmatter has invalid YAML
      content = markdownInput;
    }

    // 2. Preprocess custom Markdown syntax (Alerts, Task lists, Math, Page breaks, Local images)
    content = this.preprocessMarkdown(content);

    // 3. Render Markdown to HTML
    let html = this.md.render(content);

    // 4. Post-process HTML (Apply Google Docs specific table/blockquote/callout inline formatting)
    html = this.postprocessHtml(html);

    return {
      frontmatter,
      bodyMarkdown: content,
      parsedHtml: html,
      toc: this.toc
    };
  }

  private preprocessMarkdown(markdown: string): string {
    let result = markdown;

    // A. Page Breaks: <!-- pagebreak --> or \pagebreak
    result = result.replace(/<!--\s*pagebreak\s*-->|\\pagebreak/gi, () => {
      return '\n\n<div style="page-break-after: always; break-after: page; height: 0; margin: 0; padding: 0;"></div>\n\n';
    });

    // B. GitHub / Obsidian style callouts (> [!NOTE], > [!TIP], etc.)
    // We convert these into semantic custom markers that survive Markdown parsing
    result = result.replace(
      /^>[^\S\r\n]*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:[^\S\r\n]+([^\r\n]*))?$/gim,
      (match, type, title) => {
        const cleanType = type.toLowerCase();
        const customTitle = title && title.trim().length > 0 ? title.trim() : '';
        return `> [[CALLOUT:${cleanType}:${customTitle}]]`;
      }
    );

    // C. Task Lists (- [ ] or - [x])
    result = result.replace(/^(\s*[-*+]\s+)\[ \]\s+(.*)$/gm, '$1☐ $2');
    result = result.replace(/^(\s*[-*+]\s+)\[x\]\s+(.*)$/gim, '$1☑ ~~$2~~');

    // D. Math blocks: $$ equation $$
    result = result.replace(/\$\$([\s\S]*?)\$\$/g, (match, equation) => {
      const trimmed = equation.trim();
      return `\n<div style="margin: 14pt 0; padding: 12pt; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; text-align: center; font-family: 'Cambria Math', 'Latin Modern Math', 'Times New Roman', serif; font-size: 13pt; color: #0F172A;"><em>${this.escapeHtml(trimmed)}</em></div>\n`;
    });

    // E. Inline math: $equation$ (ensuring not currency like $100)
    result = result.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (match, prefix, equation) => {
      return `${prefix}<span style="font-family: 'Cambria Math', 'Latin Modern Math', 'Times New Roman', serif; font-size: 11pt; font-style: italic; color: #0F172A; padding: 0 2pt;">${this.escapeHtml(equation.trim())}</span>`;
    });

    // F. Resolve Local Relative Images to Base64 Data URIs
    if (this.options.baseDir) {
      result = this.resolveLocalImages(result, this.options.baseDir);
    }

    return result;
  }

  private resolveLocalImages(markdown: string, baseDir: string): string {
    // Matches ![alt](path "title") or <img src="path" />
    return markdown.replace(/!\[(.*?)\]\((.+?)(?:\s+"(.*?)")?\)/g, (match, alt, imgPath, title) => {
      const cleanPath = imgPath.trim();
      // If already data URI or web URL, keep as is
      if (cleanPath.startsWith('data:') || cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
        return match;
      }

      try {
        const resolvedPath = path.isAbsolute(cleanPath)
          ? cleanPath
          : path.join(baseDir, cleanPath);

        if (fs.existsSync(resolvedPath)) {
          const ext = path.extname(resolvedPath).toLowerCase().replace('.', '');
          const mimeType = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
          const fileData = fs.readFileSync(resolvedPath);
          const base64 = fileData.toString('base64');
          const dataUri = `data:${mimeType};base64,${base64}`;
          const titleAttr = title ? ` "${title}"` : '';
          return `![${alt}](${dataUri}${titleAttr})`;
        }
      } catch (err) {
        // Fallback: keep original if error reading file
      }

      return match;
    });
  }

  private postprocessHtml(html: string): string {
    let output = html;

    // Convert [[CALLOUT:type:title]] inside blockquotes into Google Docs 1x1 table
    // Google Docs preserves table cell background colors and borders flawlessly!
    const calloutRegex = /<blockquote>\s*<p>\s*\[\[CALLOUT:(note|tip|important|warning|caution):(.*?)\]\]([\s\S]*?)<\/blockquote>/gi;
    output = output.replace(calloutRegex, (match, type, customTitle, innerContent) => {
      const calloutType = type.toLowerCase() as keyof typeof this.theme.callouts;
      const calloutStyle = this.theme.callouts[calloutType] || this.theme.callouts.note;
      const defaultTitles: Record<string, string> = {
        note: 'Note',
        tip: 'Tip',
        important: 'Important',
        warning: 'Warning',
        caution: 'Caution'
      };

      const title = customTitle.trim() || defaultTitles[calloutType] || 'Note';
      const icon = calloutStyle.icon;

      let cleanContent = innerContent.trim();
      cleanContent = cleanContent.replace(/<\/p>\s*$/i, '').trim();
      if (cleanContent && !cleanContent.startsWith('<p')) {
        cleanContent = `<p style="margin: 0; font-family: ${this.theme.fontFamily}; font-size: 10.5pt; line-height: 1.5; color: ${this.theme.text};">${cleanContent}</p>`;
      }

      // Single cell table formatted for Google Docs
      return `
<table style="width: 100%; border-collapse: collapse; margin: 14pt 0; border: none; background-color: ${calloutStyle.bg}; border-left: 4.5pt solid ${calloutStyle.border}; border-radius: 0 6pt 6pt 0;">
  <tr>
    <td style="padding: 10pt 14pt; vertical-align: top;">
      <div style="font-weight: 700; font-size: 11pt; color: ${calloutStyle.text}; font-family: ${this.theme.headingFontFamily}; margin-bottom: 4pt;">
        <span style="font-size: 12pt; margin-right: 6pt;">${icon}</span>${this.escapeHtml(title)}
      </div>
      <div style="font-size: 10.5pt; line-height: 1.5; color: ${this.theme.text}; font-family: ${this.theme.fontFamily};">
        ${cleanContent}
      </div>
    </td>
  </tr>
</table>`;
    });

    return output;
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
