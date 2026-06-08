import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { qdrantClient, COLLECTION_NAME, resetQdrantCollection } from './db.js';
import { parseDocument } from './parser.js';
import { chunkText } from '../utils/chunker.js';
import { getBatchEmbeddings } from './embedding.js';
import { config } from '../config/index.js';

interface ChunkRecord {
  text: string;
  document_name: string;
  page: number | null;
  chunk_index: number;
}

/**
 * Scans the documents directory, parses files, generates embeddings via FastEmbed,
 * and upserts them into the Qdrant vector database.
 *
 * Strategy:
 * - Full re-index on every call (drop + recreate collection)
 * - Batch embedding: all chunks embedded together per file for speed
 * - Batch upsert: 50 points per Qdrant REST call
 */
export async function ingestDocuments() {
  const docsDir = config.documentsPath;

  if (!fs.existsSync(docsDir)) {
    console.warn(`[Ingestion] Documents directory '${docsDir}' not found. Please mount it.`);
    return { success: false, message: `Directory '${docsDir}' not found.` };
  }

  console.log(`[Ingestion] Starting full re-index from '${docsDir}'...`);

  // Drop and recreate collection for clean rebuild
  await resetQdrantCollection();

  // Scan for supported documents
  const files = fs.readdirSync(docsDir);
  const allowedExtensions = ['.pdf', '.docx', '.doc'];
  const docFiles = files.filter(
    file => allowedExtensions.includes(path.extname(file).toLowerCase())
  );

  if (docFiles.length === 0) {
    console.warn(`[Ingestion] No documents found in '${docsDir}'.`);
    return { success: true, message: 'No documents to index.' };
  }

  console.log(`[Ingestion] Found ${docFiles.length} document(s): ${docFiles.join(', ')}`);

  let totalChunksIngested = 0;

  for (const filename of docFiles) {
    const filePath = path.join(docsDir, filename);
    console.log(`\n[Ingestion] ── Processing: ${filename}`);

    try {
      // 1. Parse document into pages/sections
      const parsedPages = await parseDocument(filePath);
      console.log(`[Ingestion]    Parsed ${parsedPages.length} page(s)/section(s).`);

      // 2. Chunk all pages
      const chunks: ChunkRecord[] = [];
      let globalChunkIndex = 0;

      for (const page of parsedPages) {
        if (!page.text.trim()) continue;

        const textChunks = chunkText(page.text, 1000, 200);

        for (const chunk of textChunks) {
          if (!chunk.trim()) continue;
          chunks.push({
            text: chunk,
            document_name: filename,
            page: page.pageNumber ?? null,
            chunk_index: globalChunkIndex++,
          });
        }
      }

      if (chunks.length === 0) {
        console.log(`[Ingestion]    No text chunks produced. Skipping.`);
        continue;
      }

      console.log(`[Ingestion]    Generated ${chunks.length} chunk(s). Running FastEmbed batch...`);

      // 3. Batch embed all chunks at once (much faster than one-by-one)
      const texts = chunks.map(c => c.text);
      const vectors = await getBatchEmbeddings(texts);

      console.log(`[Ingestion]    Embedding complete. Upserting to Qdrant...`);

      // 4. Build Qdrant points
      const points = chunks.map((chunk, idx) => ({
        id: crypto.randomUUID(),
        vector: vectors[idx],
        payload: {
          document_name: chunk.document_name,
          page: chunk.page,
          chunk_index: chunk.chunk_index,
          text: chunk.text,
        },
      }));

      // 5. Batch upsert (50 points per request)
      const BATCH_SIZE = 50;
      for (let i = 0; i < points.length; i += BATCH_SIZE) {
        const batch = points.slice(i, i + BATCH_SIZE);
        await qdrantClient.upsert(COLLECTION_NAME, { points: batch });
      }

      totalChunksIngested += chunks.length;
      console.log(`[Ingestion]    ✓ Indexed ${chunks.length} chunks from '${filename}'.`);

    } catch (error: any) {
      console.error(`[Ingestion]    ✗ Failed to index '${filename}':`, error.message);
    }
  }

  console.log(`\n[Ingestion] ══ Completed. Total chunks indexed: ${totalChunksIngested} ══`);
  return {
    success: true,
    message: `Successfully indexed ${totalChunksIngested} chunks from ${docFiles.length} document(s).`,
  };
}
