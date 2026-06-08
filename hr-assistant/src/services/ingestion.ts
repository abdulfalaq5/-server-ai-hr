import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { qdrantClient, COLLECTION_NAME, initQdrant } from './db.js';
import { parseDocument } from './parser.js';
import { chunkText } from '../utils/chunker.js';
import { getEmbedding } from './embedding.js';

/**
 * Scans the /documents directory, parses files, generates embeddings, 
 * and upserts them to the Qdrant vector database.
 */
export async function ingestDocuments() {
  const docsDir = '/documents';
  
  if (!fs.existsSync(docsDir)) {
    console.warn(`[Ingestion] Documents directory '${docsDir}' not found. Please mount it.`);
    return { success: false, message: `Directory '${docsDir}' not found.` };
  }

  console.log(`[Ingestion] Starting document ingestion from '${docsDir}'...`);

  // 1. Delete and recreate collection to avoid stale document fragments
  try {
    console.log(`[Ingestion] Deleting existing collection '${COLLECTION_NAME}' for a clean rebuild...`);
    await qdrantClient.deleteCollection(COLLECTION_NAME);
  } catch (err: any) {
    // Collection might not exist yet
  }
  
  // Re-initialize collection dynamically
  await initQdrant();

  // 2. Scan folder
  const files = fs.readdirSync(docsDir);
  const allowedExtensions = ['.pdf', '.docx', '.doc'];
  const docFiles = files.filter(file => allowedExtensions.includes(path.extname(file).toLowerCase()));

  console.log(`[Ingestion] Found ${docFiles.length} candidate documents in folder.`);

  let totalChunksIngested = 0;

  for (const filename of docFiles) {
    const filePath = path.join(docsDir, filename);
    console.log(`[Ingestion] Processing document: ${filename}`);

    try {
      const parsedPages = await parseDocument(filePath);
      console.log(`[Ingestion] Parsed ${filename}: extracted ${parsedPages.length} pages/sections.`);

      const points: any[] = [];
      let globalChunkIndex = 0;

      for (const page of parsedPages) {
        if (!page.text.trim()) continue;

        // Chunk text
        const chunks = chunkText(page.text, 1000, 200);

        for (const chunk of chunks) {
          if (!chunk.trim()) continue;

          // Generate embedding for chunk
          const vector = await getEmbedding(chunk);
          const pointId = crypto.randomUUID();

          points.push({
            id: pointId,
            vector,
            payload: {
              document_name: filename,
              page: page.pageNumber,
              chunk_index: globalChunkIndex,
              text: chunk,
            }
          });

          globalChunkIndex++;
          totalChunksIngested++;
        }
      }

      // 3. Batch upload vectors for the file
      if (points.length > 0) {
        console.log(`[Ingestion] Upserting ${points.length} points to Qdrant for ${filename}...`);
        const batchSize = 20; // safe batch size for REST calls
        for (let i = 0; i < points.length; i += batchSize) {
          const batch = points.slice(i, i + batchSize);
          await qdrantClient.upsert(COLLECTION_NAME, { points: batch });
        }
        console.log(`[Ingestion] Successfully indexed: ${filename}`);
      } else {
        console.log(`[Ingestion] Document ${filename} produced no text chunks.`);
      }

    } catch (error: any) {
      console.error(`[Ingestion] Failed to index ${filename}:`, error.message);
    }
  }

  console.log(`[Ingestion] Completed successfully. Total chunks ingested: ${totalChunksIngested}`);
  return { success: true, message: `Successfully indexed ${totalChunksIngested} chunks.` };
}
