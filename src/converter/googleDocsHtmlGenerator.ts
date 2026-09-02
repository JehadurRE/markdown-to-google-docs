import { ConversionResult, ConverterOptions, FrontmatterData, ThemeColors, TocItem } from './types';
import { getTheme } from './themes';
import { MarkdownParser } from './markdownParser';

export class GoogleDocsHtmlGenerator {
  private options: ConverterOptions;
  private theme: ThemeColors;

  constructor(options: ConverterOptions = {}) {
    this.options = options;
    this.theme = getTheme(options.theme);
  }

  public convert(markdownContent: string): ConversionResult {
    const parser = new MarkdownParser(this.options);
    const { frontmatter, parsedHtml, toc } = parser.parse(markdownContent);

    // Determine document title: frontmatter title > first H1 > fallback
    let docTitle = frontmatter.title || '';
    if (!docTitle) {
      const h1Match = markdownContent.match(/^#\s+(.+)$/m);
      if (h1Match) {
        docTitle = h1Match[1].trim();
      } else {
        docTitle = 'Untitled Document';
      }
    }

    // 1. Build Executive Header Card from Frontmatter
    const headerHtml = this.generateExecutiveHeader(frontmatter, docTitle);

    // 2. Build Table of Contents (if requested & sufficient headings exist)
    const tocHtml = (this.options.includeToc !== false && toc.length >= 2)
      ? this.generateTableOfContents(toc)
      : '';

    // 3. Style and transform body elements with inline Google Docs CSS
    const styledBodyHtml = this.applyGoogleDocsStyles(parsedHtml);

    // Combine all components
    const contentFragment = `
<!-- Google Docs Compatible Formatted Document -->
<div style="font-family: ${this.theme.fontFamily}; font-size: 10.5pt; line-height: 1.55; color: ${this.theme.text}; background-color: ${this.theme.bgDocument}; max-width: 820px; margin: 0 auto; padding: 24pt 32pt;">
  ${headerHtml}
  ${tocHtml}
  <div class="doc-body">
    ${styledBodyHtml}
  </div>
</div>
`.trim();

    // Full standalone HTML with head and print styles
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(docTitle)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300&display=swap');
    
    body {
      margin: 0;
      padding: 0;
      background-color: #F1F5F9;
      font-family: ${this.theme.fontFamily};
      color: ${this.theme.text};
      -webkit-font-smoothing: antialiased;
    }
    .page-container {
      background: #FFFFFF;
      max-width: 850px;
      margin: 28px auto;
      padding: 54px 64px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      border-radius: 4px;
      min-height: 1056px; /* US Letter ratio */
    }
    @media print {
      body { background: transparent; }
      .page-container {
        margin: 0;
        padding: 0;
        box-shadow: none;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="page-container">
    ${contentFragment}
  </div>
</body>
</html>`;

    return {
      html: fullHtml,
      clipboardHtml: contentFragment,
      frontmatter,
      title: docTitle,
      toc
    };
  }

  private generateExecutiveHeader(frontmatter: FrontmatterData, fallbackTitle: string): string {
    const hasFrontmatter = Object.keys(frontmatter).length > 0;
    const title = frontmatter.title || fallbackTitle;
    const subtitle = frontmatter.subtitle || frontmatter.description || '';
    const author = frontmatter.author || (frontmatter.authors ? frontmatter.authors.join(', ') : '');
    const date = frontmatter.date ? String(frontmatter.date) : '';
    const version = frontmatter.version ? `v${frontmatter.version}` : '';
    const status = frontmatter.status || '';
    const tags = frontmatter.tags || [];

    const hasMeta = author || date || version || status || tags.length > 0 || subtitle;

    if (!hasFrontmatter && !hasMeta) {
      return '';
    }

    let metaBadges = '';
    if (author) {
      metaBadges += `<span style="display: inline-block; margin-right: 14pt; margin-bottom: 4pt; color: ${this.theme.textMuted}; font-size: 9.5pt;"><strong>Author:</strong> ${this.escapeHtml(author)}</span>`;
    }
    if (date) {
      metaBadges += `<span style="display: inline-block; margin-right: 14pt; margin-bottom: 4pt; color: ${this.theme.textMuted}; font-size: 9.5pt;"><strong>Date:</strong> ${this.escapeHtml(date)}</span>`;
    }
    if (version) {
      metaBadges += `<span style="display: inline-block; margin-right: 14pt; margin-bottom: 4pt; background-color: ${this.theme.primaryLight}; color: ${this.theme.secondary}; padding: 2pt 8pt; border-radius: 12px; font-weight: 600; font-size: 9pt;">${this.escapeHtml(version)}</span>`;
    }
    if (status) {
      metaBadges += `<span style="display: inline-block; margin-right: 14pt; margin-bottom: 4pt; background-color: #FEF3C7; color: #92400E; padding: 2pt 8pt; border-radius: 12px; font-weight: 600; font-size: 9pt; text-transform: uppercase;">${this.escapeHtml(status)}</span>`;
    }

    let tagsHtml = '';
    if (tags.length > 0) {
      tagsHtml = `<div style="margin-top: 6pt;">` + tags.map((t: string) => 
        `<span style="display: inline-block; margin-right: 6pt; margin-bottom: 4pt; background-color: #F1F5F9; color: ${this.theme.textMuted}; padding: 2pt 7pt; border-radius: 4pt; font-size: 8.5pt;">#${this.escapeHtml(t)}</span>`
      ).join('') + `</div>`;
    }

    return `
<!-- Executive Title & Metadata Header -->
<table style="width: 100%; border-collapse: collapse; margin-bottom: 24pt; border: none; border-bottom: 2pt solid ${this.theme.primary}; padding-bottom: 12pt;">
  <tr>
    <td style="padding: 0 0 16pt 0;">
      <h1 style="font-family: ${this.theme.headingFontFamily}; font-size: 26pt; font-weight: 800; color: ${this.theme.primary}; line-height: 1.25; margin: 0 0 8pt 0; letter-spacing: -0.5px;">
        ${this.escapeHtml(title)}
      </h1>
      ${subtitle ? `<div style="font-family: ${this.theme.fontFamily}; font-size: 13pt; color: ${this.theme.textMuted}; line-height: 1.4; margin-bottom: 12pt; font-weight: 400;">${this.escapeHtml(subtitle)}</div>` : ''}
      ${metaBadges ? `<div style="font-family: ${this.theme.fontFamily}; line-height: 1.6;">${metaBadges}</div>` : ''}
      ${tagsHtml}
    </td>
  </tr>
</table>
`;
  }

  private generateTableOfContents(toc: TocItem[]): string {
    const itemsHtml = toc
      .filter(item => item.level >= 1 && item.level <= 3)
      .map(item => {
        const indent = (item.level - 1) * 16;
        const bullet = item.level === 1 ? '●' : item.level === 2 ? '○' : '▪';
        return `
        <div style="margin-left: ${indent}pt; margin-bottom: 5pt; font-size: 10pt; line-height: 1.4;">
          <span style="color: ${this.theme.accent}; margin-right: 6pt; font-size: 8pt;">${bullet}</span>
          <a href="#${item.slug}" style="color: ${this.theme.secondary}; text-decoration: none; font-weight: ${item.level === 1 ? '600' : '400'};">
            ${this.escapeHtml(item.text)}
          </a>
        </div>`;
      })
      .join('');

    return `
<!-- Table of Contents -->
<table style="width: 100%; border-collapse: collapse; margin: 18pt 0 26pt 0; background-color: ${this.theme.bgCard}; border: 1pt solid ${this.theme.border}; border-radius: 6pt;">
  <tr>
    <td style="padding: 14pt 18pt;">
      <div style="font-family: ${this.theme.headingFontFamily}; font-size: 12pt; font-weight: 700; color: ${this.theme.primary}; margin-bottom: 10pt; text-transform: uppercase; letter-spacing: 0.5px;">
        Table of Contents
      </div>
      <div style="font-family: ${this.theme.fontFamily};">
        ${itemsHtml}
      </div>
    </td>
  </tr>
</table>
`;
  }

  private applyGoogleDocsStyles(html: string): string {
    let output = html;

    // 1. Headings (H1 to H6)
    output = output.replace(/<h1(\s+id="[^"]*")?>([\s\S]*?)<\/h1>/gi, (match, idAttr, content) => {
      const id = idAttr || '';
      return `<h1${id} style="font-family: ${this.theme.headingFontFamily}; font-size: 21pt; font-weight: 700; color: ${this.theme.primary}; line-height: 1.3; margin: 24pt 0 10pt 0; padding-bottom: 5pt; border-bottom: 1pt solid ${this.theme.border}; letter-spacing: -0.3px;">${content}</h1>`;
    });

    output = output.replace(/<h2(\s+id="[^"]*")?>([\s\S]*?)<\/h2>/gi, (match, idAttr, content) => {
      const id = idAttr || '';
      return `<h2${id} style="font-family: ${this.theme.headingFontFamily}; font-size: 16pt; font-weight: 600; color: ${this.theme.primary}; line-height: 1.35; margin: 20pt 0 8pt 0; letter-spacing: -0.2px;">${content}</h2>`;
    });

    output = output.replace(/<h3(\s+id="[^"]*")?>([\s\S]*?)<\/h3>/gi, (match, idAttr, content) => {
      const id = idAttr || '';
      return `<h3${id} style="font-family: ${this.theme.headingFontFamily}; font-size: 13pt; font-weight: 600; color: ${this.theme.secondary}; line-height: 1.4; margin: 16pt 0 6pt 0;">${content}</h3>`;
    });

    output = output.replace(/<h4(\s+id="[^"]*")?>([\s\S]*?)<\/h4>/gi, (match, idAttr, content) => {
      const id = idAttr || '';
      return `<h4${id} style="font-family: ${this.theme.headingFontFamily}; font-size: 11.5pt; font-weight: 600; color: ${this.theme.text}; line-height: 1.4; margin: 12pt 0 4pt 0; text-transform: uppercase; letter-spacing: 0.5px;">${content}</h4>`;
    });

    output = output.replace(/<h5(\s+id="[^"]*")?>([\s\S]*?)<\/h5>/gi, (match, idAttr, content) => {
      const id = idAttr || '';
      return `<h5${id} style="font-family: ${this.theme.headingFontFamily}; font-size: 10.5pt; font-weight: 600; color: ${this.theme.textMuted}; line-height: 1.4; margin: 10pt 0 4pt 0;">${content}</h5>`;
    });

    output = output.replace(/<h6(\s+id="[^"]*")?>([\s\S]*?)<\/h6>/gi, (match, idAttr, content) => {
      const id = idAttr || '';
      return `<h6${id} style="font-family: ${this.theme.headingFontFamily}; font-size: 10pt; font-style: italic; color: ${this.theme.textMuted}; line-height: 1.4; margin: 8pt 0 4pt 0;">${content}</h6>`;
    });

    // 2. Paragraphs (Skip paragraphs that already have inline styles or are inside custom blocks)
    output = output.replace(/<p>(?!<table|<div)/gi, `<p style="font-family: ${this.theme.fontFamily}; font-size: 10.5pt; line-height: 1.55; color: ${this.theme.text}; margin: 0 0 8pt 0;">`);

    // 3. Blockquotes (Normal blockquotes that weren't converted to callouts)
    output = output.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (match, content) => {
      return `
<table style="width: 100%; border-collapse: collapse; margin: 12pt 0; border: none; background-color: ${this.theme.bgCard}; border-left: 3.5pt solid ${this.theme.accent};">
  <tr>
    <td style="padding: 8pt 14pt; font-style: italic; color: ${this.theme.text}; font-family: ${this.theme.fontFamily}; font-size: 10.5pt; line-height: 1.5;">
      ${content.trim()}
    </td>
  </tr>
</table>`;
    });

    // 4. Code Blocks (<pre><code ...>...</code></pre>)
    // In Google Docs, wrapping code blocks in a single-cell table preserves background shading and borders 100%!
    output = output.replace(/<pre><code(?:\s+class="[^"]*")?>([\s\S]*?)<\/code><\/pre>/gi, (match, codeContent) => {
      return `
<table style="width: 100%; border-collapse: collapse; margin: 12pt 0; background-color: ${this.theme.codeBg}; border: 1pt solid ${this.theme.codeBorder}; border-radius: 4pt;">
  <tr>
    <td style="padding: 10pt 14pt; vertical-align: top;">
      <pre style="margin: 0; font-family: ${this.theme.codeFontFamily}; font-size: 9.5pt; line-height: 1.45; color: ${this.theme.codeText}; white-space: pre-wrap; word-wrap: break-word;"><code>${codeContent}</code></pre>
    </td>
  </tr>
</table>`;
    });

    // 5. Inline Code (`code`)
    output = output.replace(/<code>([^<]+)<\/code>/gi, (match, code) => {
      return `<code style="font-family: ${this.theme.codeFontFamily}; font-size: 9pt; background-color: ${this.theme.inlineCodeBg}; color: ${this.theme.inlineCodeText}; padding: 1.5pt 4.5pt; border-radius: 3pt; border: 1pt solid ${this.theme.border};">${code}</code>`;
    });

    // 6. Tables - High fidelity GDocs formatting
    output = this.styleTables(output);

    // 7. Lists (ul, ol, li)
    output = output.replace(/<ul>/gi, `<ul style="font-family: ${this.theme.fontFamily}; font-size: 10.5pt; line-height: 1.55; color: ${this.theme.text}; margin: 6pt 0 10pt 0; padding-left: 20pt;">`);
    output = output.replace(/<ol>/gi, `<ol style="font-family: ${this.theme.fontFamily}; font-size: 10.5pt; line-height: 1.55; color: ${this.theme.text}; margin: 6pt 0 10pt 0; padding-left: 20pt;">`);
    output = output.replace(/<li>/gi, `<li style="margin-bottom: 3.5pt;">`);

    // 8. Links
    output = output.replace(/<a\s+href="([^"]+)">([\s\S]*?)<\/a>/gi, (match, href, text) => {
      return `<a href="${href}" style="color: ${this.theme.secondary}; text-decoration: underline; font-weight: 500;">${text}</a>`;
    });

    // 9. Horizontal Rules (<hr>)
    output = output.replace(/<hr\s*\/?>/gi, `<hr style="border: none; border-top: 1.5pt solid ${this.theme.border}; margin: 20pt 0;" />`);

    // 10. Images: center and style
    output = output.replace(/<img\s+src="([^"]+)"\s*alt="([^"]*)"(?:\s+title="([^"]*)")?\s*\/?>/gi, (match, src, alt, title) => {
      const caption = title || alt;
      return `
<div style="text-align: center; margin: 16pt 0;">
  <img src="${src}" alt="${alt}" style="max-width: 100%; height: auto; border-radius: 6pt; box-shadow: 0 2px 4px rgba(0,0,0,0.08); border: 1pt solid ${this.theme.border};" />
  ${caption ? `<div style="font-size: 9pt; color: ${this.theme.textMuted}; margin-top: 5pt; font-style: italic;">${caption}</div>` : ''}
</div>`;
    });

    return output;
  }

  private styleTables(html: string): string {
    // Only style markdown data tables, not our custom layout tables
    const tableRegex = /<table>([\s\S]*?)<\/table>/gi;

    return html.replace(tableRegex, (match, innerTable) => {
      // Apply table container styling
      let styledTable = innerTable;

      // Style Table Header (thead / th)
      styledTable = styledTable.replace(/<thead>([\s\S]*?)<\/thead>/gi, (theadMatch: string, theadContent: string) => {
        const styledHeaders = theadContent.replace(/<th(\s+style="[^"]*")?>([\s\S]*?)<\/th>/gi, (thMatch: string, existingStyle: string, content: string) => {
          let textAlign = 'left';
          if (existingStyle && existingStyle.includes('text-align:center')) textAlign = 'center';
          if (existingStyle && existingStyle.includes('text-align:right')) textAlign = 'right';

          return `<th style="background-color: ${this.theme.tableHeaderBg}; color: ${this.theme.tableHeaderText}; font-family: ${this.theme.headingFontFamily}; font-size: 10pt; font-weight: 700; padding: 9pt 12pt; text-align: ${textAlign}; border: 1pt solid ${this.theme.tableHeaderBg};">${content}</th>`;
        });
        return `<thead style="background-color: ${this.theme.tableHeaderBg};">${styledHeaders}</thead>`;
      });

      // Style Table Body (tbody / tr / td)
      let rowIndex = 0;
      styledTable = styledTable.replace(/<tr>([\s\S]*?)<\/tr>/gi, (trMatch: string, trContent: string) => {
        // Check if this row contains th (header row)
        if (trContent.includes('<th')) {
          return trMatch;
        }

        const isZebra = this.options.tableZebraStriping !== false && rowIndex % 2 === 1;
        const rowBg = isZebra ? this.theme.tableZebraBg : '#FFFFFF';
        rowIndex++;

        const styledCells = trContent.replace(/<td(\s+style="[^"]*")?>([\s\S]*?)<\/td>/gi, (tdMatch: string, existingStyle: string, content: string) => {
          let textAlign = 'left';
          if (existingStyle && existingStyle.includes('text-align:center')) textAlign = 'center';
          if (existingStyle && existingStyle.includes('text-align:right')) textAlign = 'right';

          return `<td style="background-color: ${rowBg}; color: ${this.theme.text}; font-family: ${this.theme.fontFamily}; font-size: 10pt; padding: 8pt 12pt; text-align: ${textAlign}; border: 1pt solid ${this.theme.border}; vertical-align: top;">${content}</td>`;
        });

        return `<tr style="background-color: ${rowBg};">${styledCells}</tr>`;
      });

      return `
<table style="width: 100%; border-collapse: collapse; margin: 16pt 0; border: 1pt solid ${this.theme.border}; border-radius: 4pt; overflow: hidden;">
  ${styledTable}
</table>`;
    });
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
