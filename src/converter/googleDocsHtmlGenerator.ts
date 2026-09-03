import { ConversionResult, ConverterOptions, FootnoteItem, FrontmatterData, ThemeColors, TocItem } from './types';
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
    // 1. Initial Parse
    const initialParser = new MarkdownParser(this.options);
    const { frontmatter, parsedHtml, toc, footnotes, hasManualToc } = initialParser.parse(markdownContent);

    // 2. Apply per-document Frontmatter overrides
    const effectiveThemeName = frontmatter.theme || this.options.theme;
    this.theme = getTheme(effectiveThemeName);

    const effectiveFontFamily = frontmatter.font || this.options.fontFamily || this.theme.fontFamily;
    const includeToc = frontmatter.toc !== undefined ? Boolean(frontmatter.toc) : (this.options.includeToc !== false);
    const tocDepth = typeof frontmatter.toc_depth === 'number' ? frontmatter.toc_depth : (this.options.tocDepth || 3);
    const tableZebra = frontmatter.zebra_stripes !== undefined ? Boolean(frontmatter.zebra_stripes) : (this.options.tableZebraStriping !== false);

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

    // 3. Build Executive Header Card from Frontmatter
    const headerHtml = this.generateExecutiveHeader(frontmatter, docTitle);

    // 4. Build Table of Contents
    const tocHtml = (includeToc && toc.length >= 2)
      ? this.generateTableOfContents(toc, tocDepth)
      : '';

    // 5. Style and transform body elements with inline Google Docs CSS
    let styledBodyHtml = this.applyGoogleDocsStyles(parsedHtml, tableZebra);

    // If author placed a manual [TOC] marker, replace it with the generated TOC
    if (hasManualToc) {
      styledBodyHtml = styledBodyHtml.replace('<!-- DOCUMENT_TOC_PLACEHOLDER -->', tocHtml);
    }

    // 6. Build Footnotes Section if any exist
    const footnotesHtml = (footnotes && footnotes.length > 0)
      ? this.generateFootnotesSection(footnotes)
      : '';

    // Combine all components (top TOC is only prepended if NO manual [TOC] was placed)
    const topToc = (!hasManualToc && includeToc && toc.length >= 2) ? tocHtml : '';

    const contentFragment = `
<!-- Google Docs Compatible Formatted Document -->
<div style="font-family: ${effectiveFontFamily}; font-size: 10.5pt; line-height: 1.55; color: ${this.theme.text}; background-color: ${this.theme.bgDocument}; max-width: 820px; margin: 0 auto; padding: 24pt 32pt;">
  <a name="top"></a>
  ${headerHtml}
  ${topToc}
  <div class="doc-body">
    ${styledBodyHtml}
  </div>
  ${footnotesHtml}
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
    
    html {
      scroll-behavior: smooth;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: #F1F5F9;
      font-family: ${effectiveFontFamily};
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
      min-height: 1056px;
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
      toc,
      footnotes
    };
  }

  private generateExecutiveHeader(frontmatter: FrontmatterData, fallbackTitle: string): string {
    const title = frontmatter.title || fallbackTitle;
    const subtitle = frontmatter.subtitle || frontmatter.description || '';
    const author = frontmatter.author || (frontmatter.authors ? frontmatter.authors.join(', ') : '');
    const date = frontmatter.date ? String(frontmatter.date) : '';
    const version = frontmatter.version ? String(frontmatter.version) : '';
    const status = frontmatter.status || '';
    const organization = frontmatter.organization || '';
    const tags = frontmatter.tags || [];

    const hasAnyMeta = subtitle || author || date || version || status || organization || (tags && tags.length > 0);
    if (!hasAnyMeta && title === fallbackTitle) {
      return '';
    }

    // Metadata items badges
    const metaBadges: string[] = [];
    if (author) {
      metaBadges.push(`<span style="margin-right: 14pt; color: ${this.theme.textMuted}; font-size: 9.5pt;"><strong style="color: ${this.theme.primary}; font-weight: 600;">Author:</strong> ${this.escapeHtml(author)}</span>`);
    }
    if (organization) {
      metaBadges.push(`<span style="margin-right: 14pt; color: ${this.theme.textMuted}; font-size: 9.5pt;"><strong style="color: ${this.theme.primary}; font-weight: 600;">Org:</strong> ${this.escapeHtml(organization)}</span>`);
    }
    if (date) {
      metaBadges.push(`<span style="margin-right: 14pt; color: ${this.theme.textMuted}; font-size: 9.5pt;"><strong style="color: ${this.theme.primary}; font-weight: 600;">Date:</strong> ${this.escapeHtml(date)}</span>`);
    }
    if (version) {
      metaBadges.push(`<span style="margin-right: 14pt; color: ${this.theme.textMuted}; font-size: 9.5pt;"><strong style="color: ${this.theme.primary}; font-weight: 600;">Version:</strong> <span style="background-color: ${this.theme.primaryLight}; color: ${this.theme.primary}; padding: 1.5pt 5.5pt; border-radius: 3pt; font-weight: 600; font-size: 8.5pt;">v${this.escapeHtml(version)}</span></span>`);
    }
    if (status) {
      metaBadges.push(`<span style="margin-right: 14pt; color: ${this.theme.textMuted}; font-size: 9.5pt;"><strong style="color: ${this.theme.primary}; font-weight: 600;">Status:</strong> <span style="background-color: #DEF7EC; color: #03543F; padding: 1.5pt 5.5pt; border-radius: 3pt; font-weight: 600; font-size: 8.5pt; text-transform: uppercase;">${this.escapeHtml(status)}</span></span>`);
    }

    let tagsHtml = '';
    if (tags && tags.length > 0) {
      tagsHtml = `<div style="margin-top: 10pt;">` + tags.map(tag =>
        `<span style="display: inline-block; background-color: ${this.theme.primaryLight}; color: ${this.theme.secondary}; font-size: 8.5pt; font-weight: 600; padding: 2pt 7pt; border-radius: 10pt; margin-right: 5pt; border: 1pt solid ${this.theme.border};">#${this.escapeHtml(tag)}</span>`
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
      ${metaBadges.length > 0 ? `<div style="font-family: ${this.theme.fontFamily}; line-height: 1.6;">${metaBadges.join('')}</div>` : ''}
      ${tagsHtml}
    </td>
  </tr>
</table>
`;
  }

  private generateTableOfContents(toc: TocItem[], maxDepth: number = 3): string {
    const itemsHtml = toc
      .filter(item => item.level >= 1 && item.level <= maxDepth)
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

  private generateFootnotesSection(footnotes: FootnoteItem[]): string {
    const itemsHtml = footnotes.map(fn => {
      return `
      <div style="font-family: ${this.theme.fontFamily}; font-size: 9.5pt; color: ${this.theme.textMuted}; margin-bottom: 6pt; line-height: 1.45;">
        <a name="fn-${fn.id}"></a>
        <span style="font-weight: 700; color: ${this.theme.secondary}; margin-right: 5pt;">[${this.escapeHtml(fn.label)}]</span>
        <span style="color: ${this.theme.text};">${fn.content}</span>
        <a href="#fnref-${fn.id}" style="color: ${this.theme.secondary}; text-decoration: none; margin-left: 5pt; font-weight: 700;" title="Jump back to reference">↩</a>
      </div>`;
    }).join('');

    return `
<!-- Footnotes Section -->
<table style="width: 100%; border-collapse: collapse; margin-top: 32pt; border-top: 1.5pt solid ${this.theme.border}; padding-top: 14pt;">
  <tr>
    <td style="padding: 14pt 0 0 0;">
      <div style="font-family: ${this.theme.headingFontFamily}; font-size: 11pt; font-weight: 700; color: ${this.theme.primary}; margin-bottom: 10pt; text-transform: uppercase; letter-spacing: 0.5px;">
        Footnotes
      </div>
      ${itemsHtml}
    </td>
  </tr>
</table>
`;
  }

  private applyGoogleDocsStyles(html: string, tableZebraStriping: boolean = true): string {
    let output = html;

    // 1. Headings (H1 to H6) with Google Docs Named Bookmark Anchors (<a name="slug"></a>)
    output = output.replace(/<h1(?:\s+id="([^"]*)")?>([\s\S]*?)<\/h1>/gi, (match, id, content) => {
      const slug = id || '';
      const anchor = slug && !content.includes(`name="${slug}"`) ? `<a name="${slug}"></a>` : '';
      return `<h1${slug ? ` id="${slug}"` : ''} style="font-family: ${this.theme.headingFontFamily}; font-size: 21pt; font-weight: 700; color: ${this.theme.primary}; line-height: 1.3; margin: 24pt 0 10pt 0; padding-bottom: 5pt; border-bottom: 1pt solid ${this.theme.border}; letter-spacing: -0.3px;">${anchor}${content}</h1>`;
    });

    output = output.replace(/<h2(?:\s+id="([^"]*)")?>([\s\S]*?)<\/h2>/gi, (match, id, content) => {
      const slug = id || '';
      const anchor = slug && !content.includes(`name="${slug}"`) ? `<a name="${slug}"></a>` : '';
      return `<h2${slug ? ` id="${slug}"` : ''} style="font-family: ${this.theme.headingFontFamily}; font-size: 16pt; font-weight: 600; color: ${this.theme.primary}; line-height: 1.35; margin: 20pt 0 8pt 0; letter-spacing: -0.2px;">${anchor}${content}</h2>`;
    });

    output = output.replace(/<h3(?:\s+id="([^"]*)")?>([\s\S]*?)<\/h3>/gi, (match, id, content) => {
      const slug = id || '';
      const anchor = slug && !content.includes(`name="${slug}"`) ? `<a name="${slug}"></a>` : '';
      return `<h3${slug ? ` id="${slug}"` : ''} style="font-family: ${this.theme.headingFontFamily}; font-size: 13pt; font-weight: 600; color: ${this.theme.secondary}; line-height: 1.4; margin: 16pt 0 6pt 0;">${anchor}${content}</h3>`;
    });

    output = output.replace(/<h4(?:\s+id="([^"]*)")?>([\s\S]*?)<\/h4>/gi, (match, id, content) => {
      const slug = id || '';
      const anchor = slug && !content.includes(`name="${slug}"`) ? `<a name="${slug}"></a>` : '';
      return `<h4${slug ? ` id="${slug}"` : ''} style="font-family: ${this.theme.headingFontFamily}; font-size: 11.5pt; font-weight: 600; color: ${this.theme.text}; line-height: 1.4; margin: 12pt 0 4pt 0; text-transform: uppercase; letter-spacing: 0.5px;">${anchor}${content}</h4>`;
    });

    output = output.replace(/<h5(?:\s+id="([^"]*)")?>([\s\S]*?)<\/h5>/gi, (match, id, content) => {
      const slug = id || '';
      const anchor = slug && !content.includes(`name="${slug}"`) ? `<a name="${slug}"></a>` : '';
      return `<h5${slug ? ` id="${slug}"` : ''} style="font-family: ${this.theme.headingFontFamily}; font-size: 10.5pt; font-weight: 600; color: ${this.theme.textMuted}; line-height: 1.4; margin: 10pt 0 4pt 0;">${anchor}${content}</h5>`;
    });

    output = output.replace(/<h6(?:\s+id="([^"]*)")?>([\s\S]*?)<\/h6>/gi, (match, id, content) => {
      const slug = id || '';
      const anchor = slug && !content.includes(`name="${slug}"`) ? `<a name="${slug}"></a>` : '';
      return `<h6${slug ? ` id="${slug}"` : ''} style="font-family: ${this.theme.headingFontFamily}; font-size: 10pt; font-style: italic; color: ${this.theme.textMuted}; line-height: 1.4; margin: 8pt 0 4pt 0;">${anchor}${content}</h6>`;
    });

    // 2. Paragraphs
    output = output.replace(/<p>(?!<table|<div)/gi, `<p style="font-family: ${this.theme.fontFamily}; font-size: 10.5pt; line-height: 1.55; color: ${this.theme.text}; margin: 0 0 8pt 0;">`);

    // 3. Blockquotes
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

    // 4. Code Blocks (<pre><code ...>...</code></pre>) with floating language badges
    output = output.replace(/<pre><code(?:\s+class="([^"]*)")?>([\s\S]*?)<\/code><\/pre>/gi, (match, classAttr, codeContent) => {
      let lang = '';
      if (classAttr) {
        const langMatch = classAttr.match(/language-([a-zA-Z0-9_\-]+)/i);
        if (langMatch) {
          lang = langMatch[1].trim();
        }
      }

      const showBadges = this.options.codeBlockLanguageBadges !== false;
      const langBadge = (showBadges && lang)
        ? `<div style="float: right; font-size: 7.5pt; font-family: ${this.theme.codeFontFamily}; text-transform: uppercase; color: ${this.theme.textMuted}; background-color: ${this.theme.border}; padding: 1.5pt 5pt; border-radius: 3pt; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 6pt;">${this.escapeHtml(lang.toUpperCase())}</div>`
        : '';

      return `
<table style="width: 100%; border-collapse: collapse; margin: 12pt 0; background-color: ${this.theme.codeBg}; border: 1pt solid ${this.theme.codeBorder}; border-radius: 4pt;">
  <tr>
    <td style="padding: 10pt 14pt; vertical-align: top;">
      ${langBadge}
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
    output = this.styleTables(output, tableZebraStriping);

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

    // 10. Images: center and style (if not already styled)
    output = output.replace(/<img\s+src="([^"]+)"\s*alt="([^"]*)"(?:\s+title="([^"]*)")?(?:\s+style="([^"]*)")?\s*\/?>/gi, (match, src, alt, title, style) => {
      const caption = title || alt;
      const customStyle = style ? style : `max-width: 100%; height: auto; border-radius: 6pt; box-shadow: 0 2px 4px rgba(0,0,0,0.08); border: 1pt solid ${this.theme.border};`;
      return `
<div style="text-align: center; margin: 16pt 0;">
  <img src="${src}" alt="${alt}" style="${customStyle}" />
  ${caption ? `<div style="font-size: 9pt; color: ${this.theme.textMuted}; margin-top: 5pt; font-style: italic;">${caption}</div>` : ''}
</div>`;
    });

    return output;
  }

  private styleTables(html: string, zebraStriping: boolean = true): string {
    const tableRegex = /<table>([\s\S]*?)<\/table>/gi;

    return html.replace(tableRegex, (match, innerTable) => {
      let styledTable = innerTable;

      // Style Table Header
      styledTable = styledTable.replace(/<thead>([\s\S]*?)<\/thead>/gi, (theadMatch: string, theadContent: string) => {
        const styledHeaders = theadContent.replace(/<th(\s+style="[^"]*")?>([\s\S]*?)<\/th>/gi, (thMatch: string, existingStyle: string, content: string) => {
          let textAlign = 'left';
          if (existingStyle && existingStyle.includes('text-align:center')) textAlign = 'center';
          if (existingStyle && existingStyle.includes('text-align:right')) textAlign = 'right';

          return `<th style="background-color: ${this.theme.tableHeaderBg}; color: ${this.theme.tableHeaderText}; font-family: ${this.theme.headingFontFamily}; font-size: 10pt; font-weight: 700; padding: 9pt 12pt; text-align: ${textAlign}; border: 1pt solid ${this.theme.tableHeaderBg};">${content}</th>`;
        });
        return `<thead style="background-color: ${this.theme.tableHeaderBg};">${styledHeaders}</thead>`;
      });

      // Style Table Body
      let rowIndex = 0;
      styledTable = styledTable.replace(/<tr>([\s\S]*?)<\/tr>/gi, (trMatch: string, trContent: string) => {
        if (trContent.includes('<th')) {
          return trMatch;
        }

        const isZebra = zebraStriping && rowIndex % 2 === 1;
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
