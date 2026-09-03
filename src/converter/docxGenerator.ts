import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  BorderStyle,
  WidthType,
  AlignmentType,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  PageBreak
} from 'docx';
import { ConverterOptions, FrontmatterData, ThemeColors } from './types';
import { getTheme } from './themes';
import { MarkdownParser } from './markdownParser';

export class DocxGenerator {
  private options: ConverterOptions;
  private theme: ThemeColors;

  constructor(options: ConverterOptions = {}) {
    this.options = options;
    this.theme = getTheme(options.theme);
  }

  public async generateDocx(markdownContent: string): Promise<Buffer> {
    const parser = new MarkdownParser(this.options);
    const { frontmatter, rawMarkdown, wordCount, readingTimeMinutes } = parser.parse(markdownContent);
    (frontmatter as any).wordCount = wordCount;
    (frontmatter as any).readingTimeMinutes = readingTimeMinutes;

    const docChildren: (Paragraph | Table)[] = [];

    // 1. Executive Header from Frontmatter
    this.buildHeader(frontmatter, docChildren);

    // 2. Parse body markdown lines into docx elements
    this.buildBody(rawMarkdown, docChildren);

    // Clean hex colors (remove leading #)
    const primaryHex = this.theme.primary.replace('#', '');
    const textHex = this.theme.text.replace('#', '');
    const mutedHex = this.theme.textMuted.replace('#', '');

    const headerText = frontmatter.header || this.options.headerText || '';
    const footerText = frontmatter.footer || this.options.footerText || '';
    const showPageNumbers = frontmatter.page_numbers !== undefined ? Boolean(frontmatter.page_numbers) : (this.options.showPageNumbers !== false);

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: 'Calibri',
              size: 22, // 11pt
              color: textHex
            },
            paragraph: {
              spacing: {
                line: 320, // 1.33 line spacing
                after: 160 // 8pt after
              }
            }
          },
          heading1: {
            run: {
              font: 'Calibri',
              size: 36, // 18pt
              bold: true,
              color: primaryHex
            },
            paragraph: {
              spacing: { before: 360, after: 180 }
            }
          },
          heading2: {
            run: {
              font: 'Calibri',
              size: 28, // 14pt
              bold: true,
              color: primaryHex
            },
            paragraph: {
              spacing: { before: 280, after: 140 }
            }
          },
          heading3: {
            run: {
              font: 'Calibri',
              size: 24, // 12pt
              bold: true,
              color: this.theme.secondary.replace('#', '')
            },
            paragraph: {
              spacing: { before: 200, after: 100 }
            }
          }
        }
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch (72pt * 20)
                bottom: 1440,
                left: 1440,
                right: 1440
              }
            }
          },
          headers: headerText ? {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: headerText,
                      size: 18,
                      color: mutedHex
                    })
                  ]
                })
              ]
            })
          } : undefined,
          footers: (footerText || showPageNumbers) ? {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: footerText || 'Confidential',
                      size: 18,
                      color: mutedHex
                    }),
                    ...(showPageNumbers ? [
                      new TextRun({
                        text: '    |    Page ',
                        size: 18,
                        color: mutedHex
                      }),
                      new TextRun({
                        children: [PageNumber.CURRENT]
                      }),
                      new TextRun({
                        text: ' of '
                      }),
                      new TextRun({
                        children: [PageNumber.TOTAL_PAGES]
                      })
                    ] : [])
                  ]
                })
              ]
            })
          } : undefined,
          children: docChildren
        }
      ]
    });

    return await Packer.toBuffer(doc);
  }

  private buildHeader(frontmatter: FrontmatterData, children: (Paragraph | Table)[]): void {
    if (!frontmatter.title && Object.keys(frontmatter).length === 0) {
      return;
    }

    const titleText = frontmatter.title || 'Untitled Document';
    const primaryHex = this.theme.primary.replace('#', '');
    const mutedHex = this.theme.textMuted.replace('#', '');

    // Title
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: titleText,
            bold: true,
            size: 52, // 26pt
            color: primaryHex
          })
        ],
        spacing: { after: 140 }
      })
    );

    // Subtitle
    if (frontmatter.subtitle || frontmatter.description) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: frontmatter.subtitle || frontmatter.description,
              size: 24,
              color: mutedHex
            })
          ],
          spacing: { after: 200 }
        })
      );
    }

    // Metadata items (Author, Date, Version)
    const metaParts: string[] = [];
    if (frontmatter.author) metaParts.push(`Author: ${frontmatter.author}`);
    if (frontmatter.date) metaParts.push(`Date: ${frontmatter.date}`);
    if (frontmatter.version) metaParts.push(`Version: v${frontmatter.version}`);
    if (frontmatter.status) metaParts.push(`Status: ${frontmatter.status.toUpperCase()}`);
    if (frontmatter.show_stats !== false && (frontmatter as any).wordCount) {
      metaParts.push(`Reading Time: ~${(frontmatter as any).readingTimeMinutes} min (${(frontmatter as any).wordCount} words)`);
    }

    if (metaParts.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: metaParts.join('  |  '),
              size: 19,
              color: mutedHex
            })
          ],
          spacing: { after: 360 }
        })
      );
    }
  }

  private buildBody(markdown: string, children: (Paragraph | Table)[]): void {
    const lines = markdown.split('\n');
    let inCodeBlock = false;
    let codeBlockLines: string[] = [];
    let inTable = false;
    let tableRows: string[] = [];
    const footnotesDefs: Array<{ id: string; text: string }> = [];

    const primaryHex = this.theme.primary.replace('#', '');
    const mutedHex = this.theme.textMuted.replace('#', '');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code blocks (including Mermaid)
      if (line.trim().startsWith('```mermaid')) {
        const diagramLines: string[] = [];
        let j = i + 1;
        while (j < lines.length && !lines[j].trim().startsWith('```')) {
          diagramLines.push(lines[j]);
          j++;
        }
        i = j;
        this.addDiagramCard(diagramLines.join('\n'), children);
        continue;
      } else if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          // Finish code block
          this.addCodeBlock(codeBlockLines.join('\n'), children);
          codeBlockLines = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeBlockLines = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      // Footnote definitions: [^1]: Description
      const fnMatch = line.trim().match(/^\[\^([^\]]+)\]:\s*([\s\S]*)$/);
      if (fnMatch) {
        footnotesDefs.push({ id: fnMatch[1], text: fnMatch[2] });
        continue;
      }

      // Markdown Tables (| col | col |)
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        inTable = true;
        tableRows.push(line);
        continue;
      } else if (inTable) {
        this.addTable(tableRows, children);
        tableRows = [];
        inTable = false;
      }

      // Headings
      if (line.startsWith('# ')) {
        children.push(
          new Paragraph({
            text: line.replace('# ', '').trim(),
            heading: HeadingLevel.HEADING_1
          })
        );
      } else if (line.startsWith('## ')) {
        children.push(
          new Paragraph({
            text: line.replace('## ', '').trim(),
            heading: HeadingLevel.HEADING_2
          })
        );
      } else if (line.startsWith('### ')) {
        children.push(
          new Paragraph({
            text: line.replace('### ', '').trim(),
            heading: HeadingLevel.HEADING_3
          })
        );
      } else if (line.startsWith('#### ') || line.startsWith('##### ') || line.startsWith('###### ')) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.replace(/^#+\s*/, '').trim(),
                bold: true,
                size: 22
              })
            ],
            spacing: { before: 180, after: 80 }
          })
        );
      } else if (line.trim().startsWith('> [!')) {
        // Callout box (12 extended types)
        const calloutMatch = line.trim().match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO|SUCCESS|DONE|DANGER|FAIL|ERROR|QUESTION|FAQ|HELP|QUOTE|CITE|TODO|EXAMPLE)\](?:\s*(.*))?$/i);
        let type = calloutMatch ? calloutMatch[1].toLowerCase() : 'note';
        if (type === 'done') type = 'success';
        if (type === 'fail' || type === 'error') type = 'danger';
        if (type === 'faq' || type === 'help') type = 'question';
        if (type === 'cite') type = 'quote';

        const defaultTitles: Record<string, string> = {
          note: 'NOTE', tip: 'TIP', important: 'IMPORTANT', warning: 'WARNING', caution: 'CAUTION',
          info: 'INFORMATION', success: 'SUCCESS', danger: 'DANGER', question: 'QUESTION',
          quote: 'QUOTE', todo: 'TO-DO', example: 'EXAMPLE'
        };
        const title = calloutMatch && calloutMatch[2] && calloutMatch[2].trim() ? calloutMatch[2].trim() : (defaultTitles[type] || type.toUpperCase());
        
        // Read next lines of callout
        const calloutBody: string[] = [];
        let j = i + 1;
        while (j < lines.length && lines[j].trim().startsWith('>')) {
          calloutBody.push(lines[j].trim().replace(/^>\s*/, ''));
          j++;
        }
        i = j - 1;

        this.addCallout(type, title, calloutBody.join(' '), children);
      } else if (line.trim().startsWith('>')) {
        // Standard blockquote
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.replace(/^>\s*/, ''),
                italics: true,
                color: mutedHex
              })
            ],
            spacing: { before: 120, after: 120 }
          })
        );
      } else if (/^[ \t]*(\[TOC\]|\[\[toc\]\]|\[toc\])[ \t]*$/i.test(line)) {
        // Skip manual TOC tag in DOCX
        continue;
      } else if (line.includes('gdoc-pagebreak') || /^[ \t]*(?:<!--[ \t]*(?:pagebreak|newpage|pb)[ \t]*-->|\\pagebreak|===)[ \t]*$/i.test(line)) {
        // Hard Page break
        children.push(
          new Paragraph({
            children: [new PageBreak()]
          })
        );
        continue;
      } else if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
        // Horizontal Rule
        children.push(
          new Paragraph({
            border: {
              bottom: {
                color: this.theme.border.replace('#', ''),
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6
              }
            },
            spacing: { before: 180, after: 180 }
          })
        );
        continue;
      } else if (line.trim().startsWith('$$')) {
        // Math Block
        let mathText = line.trim().slice(2);
        if (mathText.endsWith('$$')) {
          mathText = mathText.slice(0, -2).trim();
        } else {
          const mathLines = [mathText];
          let j = i + 1;
          while (j < lines.length && !lines[j].trim().endsWith('$$')) {
            mathLines.push(lines[j]);
            j++;
          }
          if (j < lines.length) {
            mathLines.push(lines[j].trim().replace(/\$\$$/, ''));
            i = j;
          }
          mathText = mathLines.join(' ').trim();
        }
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: mathText,
                font: 'Cambria Math',
                italics: true,
                size: 24,
                color: primaryHex
              })
            ],
            spacing: { before: 180, after: 180 }
          })
        );
        continue;
      } else if (line.trim().startsWith('->') && line.trim().endsWith('<-')) {
        // Centered paragraph
        const text = line.trim().slice(2, -2).trim();
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: this.parseFormattedRuns(text),
            spacing: { after: 120 }
          })
        );
        continue;
      } else if (line.trim().startsWith('->') && line.trim().endsWith('->')) {
        // Right-aligned paragraph
        const text = line.trim().slice(2, -2).trim();
        children.push(
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: this.parseFormattedRuns(text),
            spacing: { after: 120 }
          })
        );
        continue;
      } else if (i + 1 < lines.length && lines[i + 1].trim().startsWith(': ') && !line.trim().startsWith(': ') && line.trim().length > 0) {
        // Definition List Term
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.trim(),
                bold: true,
                size: 22,
                color: primaryHex
              })
            ],
            spacing: { before: 140, after: 30 }
          })
        );
        continue;
      } else if (line.trim().startsWith(': ')) {
        // Definition List Description
        const defText = line.trim().slice(2).trim();
        children.push(
          new Paragraph({
            indent: { left: 720 }, // 0.5 inch hanging indent
            children: this.parseFormattedRuns(defText),
            spacing: { after: 120 }
          })
        );
        continue;
      } else if (line.trim().startsWith('- [ ] ')) {
        // Unchecked task list
        const text = line.trim().replace(/^- \[ \] /, '');
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: '☐  ', bold: true, size: 22 }),
              ...this.parseFormattedRuns(text)
            ],
            spacing: { after: 100 }
          })
        );
        continue;
      } else if (line.trim().startsWith('- [x] ') || line.trim().startsWith('- [X] ')) {
        // Checked task list with strikethrough
        const text = line.trim().replace(/^- \[[xX]\] /, '');
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: '☑  ', bold: true, size: 22 }),
              new TextRun({ text: text, strike: true, color: mutedHex })
            ],
            spacing: { after: 100 }
          })
        );
      } else if (line.trim().length > 0) {
        // Regular paragraph with rich inline formatting
        children.push(this.createFormattedParagraph(line));
      }
    }

    if (inTable && tableRows.length > 0) {
      this.addTable(tableRows, children);
    }

    // Append Footnotes Section if any were defined
    if (footnotesDefs.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Footnotes',
              bold: true,
              size: 22,
              color: primaryHex
            })
          ],
          spacing: { before: 360, after: 120 },
          border: {
            top: {
              color: this.theme.border.replace('#', ''),
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6
            }
          }
        })
      );

      for (const fn of footnotesDefs) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `[${fn.id}] `,
                bold: true,
                size: 18,
                color: this.theme.secondary.replace('#', '')
              }),
              ...this.parseFormattedRuns(fn.text)
            ],
            spacing: { after: 60 }
          })
        );
      }
    }
  }

  private createFormattedParagraph(text: string): Paragraph {
    const runs = this.parseFormattedRuns(text);
    return new Paragraph({
      children: runs,
      spacing: { after: 140 }
    });
  }

  private parseFormattedRuns(text: string): TextRun[] {
    const runs: TextRun[] = [];
    // Tokenize: bold, italic, code, highlight (==text==), sub (~text~), sup (^text^), strike (~~text~~), insert (++text++), kbd (<kbd>text</kbd>), math ($text$)
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|==.*?==|~~.*?~~|\+\+.*?\+\+|\~.*?\~|\^.*?\^|<kbd>.*?<\/kbd>|\$[^\$\n]+?\$|\[\^[^\]]+\])/g;
    const parts = text.split(regex);

    for (const part of parts) {
      if (!part) continue;

      if (part.startsWith('**') && part.endsWith('**')) {
        runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
      } else if (part.startsWith('*') && part.endsWith('*')) {
        runs.push(new TextRun({ text: part.slice(1, -1), italics: true }));
      } else if (part.startsWith('`') && part.endsWith('`')) {
        runs.push(
          new TextRun({
            text: part.slice(1, -1),
            font: 'Consolas',
            size: 20,
            color: this.theme.secondary.replace('#', '')
          })
        );
      } else if (part.startsWith('==') && part.endsWith('==')) {
        // Highlighted text
        runs.push(new TextRun({ text: part.slice(2, -2), highlight: 'yellow' }));
      } else if (part.startsWith('~~') && part.endsWith('~~')) {
        // Strikethrough
        runs.push(new TextRun({ text: part.slice(2, -2), strike: true }));
      } else if (part.startsWith('++') && part.endsWith('++')) {
        // Inserted underline text
        runs.push(new TextRun({ text: part.slice(2, -2), underline: {} }));
      } else if (part.startsWith('~') && part.endsWith('~')) {
        // Subscript
        runs.push(new TextRun({ text: part.slice(1, -1), subScript: true }));
      } else if (part.startsWith('^') && part.endsWith('^')) {
        // Superscript
        runs.push(new TextRun({ text: part.slice(1, -1), superScript: true }));
      } else if (part.startsWith('<kbd>') && part.endsWith('</kbd>')) {
        // Keyboard key
        runs.push(new TextRun({ text: part.slice(5, -6), font: 'Consolas', bold: true }));
      } else if (part.startsWith('$') && part.endsWith('$')) {
        // Inline math
        runs.push(new TextRun({ text: part.slice(1, -1), italics: true, font: 'Cambria Math' }));
      } else if (part.startsWith('[^') && part.endsWith(']')) {
        // Inline Footnote citation
        runs.push(
          new TextRun({
            text: `[${part.slice(2, -1)}]`,
            superScript: true,
            bold: true,
            color: this.theme.secondary.replace('#', '')
          })
        );
      } else {
        runs.push(new TextRun({ text: part }));
      }
    }

    return runs;
  }

  private addDiagramCard(code: string, children: (Paragraph | Table)[]): void {
    const lines = code.trim().split('\n').filter(l => l.trim().length > 0);
    const diagramType = lines[0] ? lines[0].trim().toUpperCase() : 'FLOWCHART';

    const cell = new TableCell({
      width: { size: 9000, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 8, color: this.theme.borderDark.replace('#', '') },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: this.theme.borderDark.replace('#', '') },
        left: { style: BorderStyle.SINGLE, size: 8, color: this.theme.secondary.replace('#', '') },
        right: { style: BorderStyle.SINGLE, size: 8, color: this.theme.borderDark.replace('#', '') }
      },
      shading: {
        fill: 'F8FAFC',
        type: ShadingType.CLEAR
      },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: `📊 DIAGRAM: ${diagramType}`,
              bold: true,
              size: 18,
              color: this.theme.primary.replace('#', '')
            })
          ],
          spacing: { after: 100 }
        }),
        ...lines.map(l => new Paragraph({
          children: [
            new TextRun({
              text: l,
              font: 'Consolas',
              size: 18,
              color: this.theme.text.replace('#', '')
            })
          ],
          spacing: { after: 40 }
        }))
      ],
      margins: { top: 160, bottom: 160, left: 240, right: 240 }
    });

    children.push(
      new Table({
        rows: [new TableRow({ children: [cell] })],
        width: { size: 9000, type: WidthType.DXA }
      })
    );
  }

  private addCodeBlock(code: string, children: (Paragraph | Table)[]): void {
    const codeLines = code.split('\n');
    const paragraphs = codeLines.map(line => 
      new Paragraph({
        children: [
          new TextRun({
            text: line || ' ',
            font: 'Consolas',
            size: 19,
            color: this.theme.codeText.replace('#', '')
          })
        ],
        spacing: { line: 240, after: 40 }
      })
    );

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: paragraphs,
              shading: {
                fill: this.theme.codeBg.replace('#', ''),
                type: ShadingType.CLEAR
              },
              margins: { top: 160, bottom: 160, left: 240, right: 240 }
            })
          ]
        })
      ]
    });

    children.push(table);
  }

  private addCallout(type: string, title: string, body: string, children: (Paragraph | Table)[]): void {
    const calloutStyle = (this.theme.callouts as any)[type] || this.theme.callouts.note;
    const borderHex = calloutStyle.border.replace('#', '');
    const bgHex = calloutStyle.bg.replace('#', '');
    const titleHex = calloutStyle.text.replace('#', '');

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: {
                left: { style: BorderStyle.SINGLE, size: 24, color: borderHex },
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE }
              },
              shading: {
                fill: bgHex,
                type: ShadingType.CLEAR
              },
              margins: { top: 160, bottom: 160, left: 240, right: 240 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${calloutStyle.icon} ${title}`,
                      bold: true,
                      size: 22,
                      color: titleHex
                    })
                  ],
                  spacing: { after: 80 }
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: body,
                      size: 21,
                      color: this.theme.text.replace('#', '')
                    })
                  ],
                  spacing: { after: 0 }
                })
              ]
            })
          ]
        })
      ]
    });

    children.push(table);
  }

  private addTable(markdownRows: string[], children: (Paragraph | Table)[]): void {
    const rows: TableRow[] = [];
    const headerBgHex = this.theme.tableHeaderBg.replace('#', '');
    const headerTextHex = this.theme.tableHeaderText.replace('#', '');

    for (let r = 0; r < markdownRows.length; r++) {
      const line = markdownRows[r];
      // Skip markdown delimiter line (|---|---|)
      if (line.match(/^\|?\s*[-:]+[-| :]*\|?$/)) {
        continue;
      }

      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      const isHeader = r === 0;

      const tableCells = cells.map(cellText => {
        return new TableCell({
          shading: {
            fill: isHeader ? headerBgHex : (r % 2 === 1 ? this.theme.tableZebraBg.replace('#', '') : 'FFFFFF'),
            type: ShadingType.CLEAR
          },
          margins: { top: 140, bottom: 140, left: 180, right: 180 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: cellText,
                  bold: isHeader,
                  size: 20,
                  color: isHeader ? headerTextHex : this.theme.text.replace('#', '')
                })
              ]
            })
          ]
        });
      });

      rows.push(new TableRow({ children: tableCells }));
    }

    if (rows.length > 0) {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows
        })
      );
    }
  }
}
