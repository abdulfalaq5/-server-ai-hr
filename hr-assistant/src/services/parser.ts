import fs from 'fs';
import path from 'path';
// @ts-ignore
import pdf from 'pdf-parse';
// @ts-ignore
import WordExtractor from 'word-extractor';
import { ParsedPage } from '../types/index.js';

/**
 * Parses a document and returns text structured by page/section.
 * Supports PDF (page-by-page extraction) and DOCX / DOC (whole-body text).
 */
export async function parseDocument(filePath: string): Promise<ParsedPage[]> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const dataBuffer = fs.readFileSync(filePath);

  if (ext === '.pdf') {
    const parsedPages: ParsedPage[] = [];

    // Capture pages as pdf-parse iterates through them
    const options = {
      pagerender: async (pageData: any) => {
        try {
          const textContent = await pageData.getTextContent({
            normalizeWhitespace: true,
            disableCombineTextItems: false,
          });
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          
          parsedPages.push({
            pageNumber: pageData.pageIndex + 1,
            text: pageText,
          });
          return pageText;
        } catch (err: any) {
          console.error(`[Parser] Error rendering PDF page:`, err.message);
          return '';
        }
      }
    };

    await pdf(dataBuffer, options);
    
    // Sort pages in correct order since page rendering runs asynchronously
    parsedPages.sort((a, b) => (a.pageNumber || 0) - (b.pageNumber || 0));
    return parsedPages;

  } else if (ext === '.docx' || ext === '.doc') {
    // WordExtractor is pure JS and extracts text from both legacy .doc and modern .docx
    const extractor = new WordExtractor();
    const doc = await extractor.extract(filePath);
    const text = doc.getBody();

    return [{
      pageNumber: null, // Page numbers are not easily parsed from Word files in Node.js
      text: text,
    }];
  } else {
    throw new Error(`Unsupported document extension: ${ext}`);
  }
}
