import * as fs from 'fs';
import * as path from 'path';
import { GoogleDocsHtmlGenerator } from '../src/converter/googleDocsHtmlGenerator';
import { DocxGenerator } from '../src/converter/docxGenerator';

async function main() {
  const demoMdPath = path.join(__dirname, '../demo-sample.md');
  const markdown = fs.readFileSync(demoMdPath, 'utf8');

  console.log('Generating Google Docs HTML...');
  const htmlGen = new GoogleDocsHtmlGenerator({ theme: 'modern-corporate', includeToc: true });
  const result = htmlGen.convert(markdown);

  const htmlOutPath = path.join(__dirname, '../demo-sample.html');
  fs.writeFileSync(htmlOutPath, result.html, 'utf8');
  console.log(`Saved: ${htmlOutPath} (${result.html.length} bytes)`);

  console.log('Generating Google Docs DOCX...');
  const docxGen = new DocxGenerator({ theme: 'modern-corporate' });
  const docxBuffer = await docxGen.generateDocx(markdown);

  const docxOutPath = path.join(__dirname, '../demo-sample.docx');
  fs.writeFileSync(docxOutPath, docxBuffer);
  console.log(`Saved: ${docxOutPath} (${docxBuffer.length} bytes)`);

  console.log('Done!');
}

main().catch(console.error);
