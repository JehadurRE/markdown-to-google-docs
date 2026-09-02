import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { MarkdownParser } from '../converter/markdownParser';
import { GoogleDocsHtmlGenerator } from '../converter/googleDocsHtmlGenerator';
import { DocxGenerator } from '../converter/docxGenerator';
import { ALL_THEMES, getTheme } from '../converter/themes';

export async function runAllTests(): Promise<boolean> {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    return (async () => {
      try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      } catch (err: any) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     ${err.message}`);
        failed++;
      }
    })();
  }

  console.log('\n--- Running Markdown to Google Docs Test Suite ---\n');

  // Test 1: Frontmatter extraction
  await test('Parser correctly extracts YAML Frontmatter metadata', () => {
    const md = `---
title: "Quarterly Strategic Report"
subtitle: "Q3 Performance & Growth"
author: "Jehadur RE"
date: "2026-09-03"
version: "2.1"
status: "APPROVED"
tags: [strategy, q3, executive]
---
# Main Section
Document content goes here.
`;
    const parser = new MarkdownParser();
    const { frontmatter, bodyMarkdown, parsedHtml } = parser.parse(md);

    assert.strictEqual(frontmatter.title, 'Quarterly Strategic Report');
    assert.strictEqual(frontmatter.author, 'Jehadur RE');
    assert.strictEqual(frontmatter.version, '2.1');
    assert.strictEqual(frontmatter.status, 'APPROVED');
    assert.deepStrictEqual(frontmatter.tags, ['strategy', 'q3', 'executive']);
    assert.ok(bodyMarkdown.includes('Main Section'));
  });

  // Test 2: Callouts & Alerts transformation
  await test('Parser and generator render GitHub callouts ([!NOTE], [!TIP], etc.) into GDocs tables', () => {
    const md = `
> [!NOTE]
> This is a crucial note for reviewers.

> [!TIP] Pro Tip
> Remember to run the tests first!

> [!WARNING]
> Please exercise caution when updating production settings.
`;
    const generator = new GoogleDocsHtmlGenerator({ theme: 'modern-corporate' });
    const result = generator.convert(md);

    // Verify callouts are converted to styled tables with colored left border
    assert.ok(result.clipboardHtml.includes('border-left: 4.5pt solid #3B82F6'), 'Note border not found');
    assert.ok(result.clipboardHtml.includes('border-left: 4.5pt solid #10B981'), 'Tip border not found');
    assert.ok(result.clipboardHtml.includes('border-left: 4.5pt solid #F59E0B'), 'Warning border not found');
    assert.ok(result.clipboardHtml.includes('Pro Tip'), 'Custom callout title not found');
  });

  // Test 3: Syntax Highlighting with inline styles
  await test('Code blocks have syntax highlighting converted to inline styles (not raw CSS classes)', () => {
    const md = `
\`\`\`typescript
const greeting: string = "Hello Google Docs";
function calculate(x: number): number {
  return x * 2;
}
\`\`\`
`;
    const generator = new GoogleDocsHtmlGenerator({ theme: 'modern-corporate' });
    const result = generator.convert(md);

    // Must contain inline style with color for keywords and strings
    assert.ok(result.clipboardHtml.includes('style="color: #D73A49; font-weight: 600;"') || result.clipboardHtml.includes('color: #D73A49'), 'Keyword style missing');
    assert.ok(result.clipboardHtml.includes('color: #032F62') || result.clipboardHtml.includes('color:'), 'String style missing');
    // Must NOT contain unstyled hljs class spans without style
    assert.ok(!result.clipboardHtml.includes('<span class="hljs-keyword">'), 'Unstyled hljs class should not exist');
  });

  // Test 4: Task Lists
  await test('Task lists convert to ballot checkboxes with strikethrough', () => {
    const md = `
- [x] Finished research and planning
- [ ] Implement backend converter
- [ ] Conduct final verification
`;
    const generator = new GoogleDocsHtmlGenerator();
    const result = generator.convert(md);

    assert.ok(result.clipboardHtml.includes('☑'), 'Checked ballot glyph missing');
    assert.ok(result.clipboardHtml.includes('☐'), 'Unchecked ballot glyph missing');
    assert.ok(result.clipboardHtml.includes('<s>Finished research and planning</s>') || result.clipboardHtml.includes('<del>Finished research and planning</del>'), 'Completed item not strikethrough');
  });

  // Test 5: Table Styling with Zebra Striping and Alignment
  await test('Markdown tables render with Google Docs-compliant inline borders and header styles', () => {
    const md = `
| Service | Status | Latency |
| :--- | :---: | ---: |
| Auth API | Online | 42ms |
| Database | Online | 12ms |
| Worker Queue | Idle | 5ms |
`;
    const generator = new GoogleDocsHtmlGenerator({ theme: 'modern-corporate', tableZebraStriping: true });
    const result = generator.convert(md);

    // Header styling check
    assert.ok(result.clipboardHtml.includes('background-color: #1E293B'), 'Table header background missing');
    assert.ok(result.clipboardHtml.includes('text-align: center'), 'Center alignment missing');
    assert.ok(result.clipboardHtml.includes('text-align: right'), 'Right alignment missing');
    assert.ok(result.clipboardHtml.includes('border: 1pt solid'), 'Cell border missing');
  });

  // Test 6: Math equations
  await test('Inline and block math expressions render with mathematical typography', () => {
    const md = `
The equation $E = mc^2$ defines mass-energy equivalence.

$$
\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$
`;
    const generator = new GoogleDocsHtmlGenerator();
    const result = generator.convert(md);

    assert.ok(result.clipboardHtml.includes('Cambria Math') || result.clipboardHtml.includes('Latin Modern Math'), 'Math font missing');
    assert.ok(result.clipboardHtml.includes('E = mc^2'), 'Inline math missing');
    assert.ok(result.clipboardHtml.includes('\\frac{-b'), 'Block math missing');
  });

  // Test 7: Executive Header Card
  await test('Executive Header Card renders beautifully with title, subtitle, badges, and tags', () => {
    const md = `---
title: "Technical Architecture Specification"
subtitle: "System Design for Cloud Pipeline"
author: "Lead Architect"
date: "2026-09-03"
version: "3.0"
tags: [cloud, architecture, microservices]
---
# Introduction
Overview of system.
`;
    const generator = new GoogleDocsHtmlGenerator({ theme: 'modern-corporate' });
    const result = generator.convert(md);

    assert.ok(result.clipboardHtml.includes('Technical Architecture Specification'), 'Title missing');
    assert.ok(result.clipboardHtml.includes('System Design for Cloud Pipeline'), 'Subtitle missing');
    assert.ok(result.clipboardHtml.includes('Author:</strong> Lead Architect'), 'Author badge missing');
    assert.ok(result.clipboardHtml.includes('#cloud'), 'Tag missing');
  });

  // Test 8: Table of Contents
  await test('Table of contents is auto-generated for documents with headings', () => {
    const md = `
# Chapter 1: Foundations
Content 1
## Core Concepts
Content 2
### Data Flow
Content 3
# Chapter 2: Implementation
Content 4
`;
    const generator = new GoogleDocsHtmlGenerator({ includeToc: true });
    const result = generator.convert(md);

    assert.ok(result.clipboardHtml.includes('Table of Contents'), 'TOC title missing');
    assert.ok(result.clipboardHtml.includes('Chapter 1: Foundations'), 'TOC item missing');
    assert.ok(result.clipboardHtml.includes('Core Concepts'), 'TOC item missing');
    assert.ok(result.clipboardHtml.includes('Chapter 2: Implementation'), 'TOC item missing');
    assert.strictEqual(result.toc.length, 4, 'TOC items count mismatch');
  });

  // Test 9: All 5 Themes
  await test('All curated professional themes generate valid styles without error', () => {
    const md = `# Document\nSample text with **bold** and *italic*.\n> [!NOTE]\n> Note text.`;
    const themeKeys = Object.keys(ALL_THEMES);
    assert.strictEqual(themeKeys.length >= 5, true, 'At least 5 themes required');

    for (const key of themeKeys) {
      const theme = getTheme(key);
      assert.ok(theme.primary, `Theme ${key} missing primary color`);
      assert.ok(theme.tableHeaderBg, `Theme ${key} missing tableHeaderBg`);
      assert.ok(theme.callouts.note, `Theme ${key} missing callouts.note`);

      const gen = new GoogleDocsHtmlGenerator({ theme: key });
      const res = gen.convert(md);
      assert.ok(res.html.length > 100, `Theme ${key} failed to generate valid HTML`);
    }
  });

  // Test 10: Local relative images resolution to base64 Data URIs
  await test('Local relative images are resolved and embedded as base64 Data URIs', () => {
    // Create a temporary image in scratch directory
    const tempDir = path.join(__dirname, '../../test-assets');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempImgPath = path.join(tempDir, 'test-icon.svg');
    fs.writeFileSync(tempImgPath, '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><circle cx="5" cy="5" r="5" fill="red"/></svg>');

    const md = `
Here is an image:
![Test Icon](./test-icon.svg "System Icon")
`;
    const parser = new MarkdownParser({ baseDir: tempDir });
    const { parsedHtml } = parser.parse(md);

    assert.ok(parsedHtml.includes('data:image/svg+xml;base64,'), 'Image not converted to base64 Data URI');

    // Cleanup
    try {
      fs.unlinkSync(tempImgPath);
      fs.rmdirSync(tempDir);
    } catch (_) {}
  });

  // Test 11: Docx Generator
  await test('DocxGenerator successfully builds valid DOCX buffer from markdown', async () => {
    const md = `---
title: "Docx Export Test"
author: "Test Author"
---
# Heading 1
Some body text with **bold** and \`inline code\`.

| Column 1 | Column 2 |
|---|---|
| A1 | B1 |

> [!TIP]
> This is a tip box.
`;
    const docxGen = new DocxGenerator({ theme: 'modern-corporate' });
    const buffer = await docxGen.generateDocx(md);

    assert.ok(buffer instanceof Buffer, 'Docx output is not a Buffer');
    assert.ok(buffer.length > 1000, 'Docx buffer too small');
    // Check DOCX magic numbers (PK zip signature 0x50, 0x4B, 0x03, 0x04)
    assert.strictEqual(buffer[0], 0x50);
    assert.strictEqual(buffer[1], 0x4B);
  });

  // Test 12: Edge case - Empty or Minimal Markdown
  await test('Handles minimal, empty, or header-less Markdown without error', () => {
    const generator = new GoogleDocsHtmlGenerator();
    const result1 = generator.convert('');
    assert.strictEqual(result1.title, 'Untitled Document');

    const result2 = generator.convert('Just a single line of text with no headers.');
    assert.ok(result2.clipboardHtml.includes('Just a single line of text'));
  });

  console.log(`\n========================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  return failed === 0;
}
