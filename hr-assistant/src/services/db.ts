import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config/index.js';
import { getEmbeddingDimension } from './embedding.js';

export const qdrantClient = new QdrantClient({
  url: config.qdrantUrl,
});

export const COLLECTION_NAME = 'hr_documents';

/**
 * Initializes the Qdrant collection for HR documents.
 * Uses the embedding dimension from FastEmbed (384 for multilingual-MiniLM).
 * If the collection already exists, it will be kept as-is.
 */
export async function initQdrant() {
  try {
    const response = await qdrantClient.getCollections();
    const exists = response.collections.some(c => c.name === COLLECTION_NAME);

    if (!exists) {
      const dimension = getEmbeddingDimension();
      console.log(`[Qdrant] Creating collection '${COLLECTION_NAME}' with dim=${dimension}, distance=Cosine`);

      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: {
          size: dimension,
          distance: 'Cosine',
        },
      });

      console.log(`[Qdrant] Collection '${COLLECTION_NAME}' created successfully.`);
    } else {
      console.log(`[Qdrant] Collection '${COLLECTION_NAME}' already exists.`);
    }
  } catch (error: any) {
    console.error(`[Qdrant] Initialization error:`, error.message);
    throw error;
  }
}

/**
 * Drops and recreates the collection.
 * Used during full re-ingestion to avoid stale data.
 */
export async function resetQdrantCollection() {
  try {
    await qdrantClient.deleteCollection(COLLECTION_NAME);
    console.log(`[Qdrant] Dropped collection '${COLLECTION_NAME}'.`);
  } catch {
    // Collection may not exist yet, that's fine
  }
  await initQdrant();
}
