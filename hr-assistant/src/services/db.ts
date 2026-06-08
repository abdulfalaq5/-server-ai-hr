import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config/index.js';
import { getEmbedding } from './embedding.js';

export const qdrantClient = new QdrantClient({
  url: config.qdrantUrl,
});

export const COLLECTION_NAME = 'hr_documents';

/**
 * Initializes the Qdrant collection.
 * Automatically detects embedding dimensions dynamically by requesting a dummy embedding first.
 */
export async function initQdrant() {
  try {
    const response = await qdrantClient.getCollections();
    const exists = response.collections.some(c => c.name === COLLECTION_NAME);

    if (!exists) {
      console.log(`[Qdrant] Collection '${COLLECTION_NAME}' does not exist. Initializing...`);
      
      // Auto-detect embedding dimensions
      console.log(`[Qdrant] Fetching a dummy embedding to auto-detect dimension...`);
      const dummyEmbedding = await getEmbedding("test dimension");
      const dimension = dummyEmbedding.length;
      
      console.log(`[Qdrant] Creating collection '${COLLECTION_NAME}' with vector dimension: ${dimension}`);
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
