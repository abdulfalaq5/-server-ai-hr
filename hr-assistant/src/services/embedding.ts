import { EmbeddingModel, FlagEmbedding } from 'fastembed';

// ============================================================
// FastEmbed Configuration
// ============================================================
// Model: multilingual-e5-large (MLE5Large)
// - Dimension: 768
// - Multilingual: supports Bahasa Indonesia and 100+ languages
// - High quality: strong multilingual retrieval performance
// - Symmetric: same embedding for query and passage
// ============================================================

export const EMBEDDING_MODEL = EmbeddingModel.MLE5Large;
export const EMBEDDING_DIM = 768;

let embeddingInstance: FlagEmbedding | null = null;

/**
 * Lazy-initialize the FastEmbed model.
 * Model is downloaded once and cached in /tmp/fastembed-cache inside the container.
 */
async function getModel(): Promise<FlagEmbedding> {
  if (!embeddingInstance) {
    console.log(`[FastEmbed] Initializing model: multilingual-e5-large ...`);
    embeddingInstance = await FlagEmbedding.init({
      model: EMBEDDING_MODEL,
      cacheDir: '/tmp/fastembed-cache',
    });
    console.log(`[FastEmbed] Model loaded. Dimension: ${EMBEDDING_DIM}`);
  }
  return embeddingInstance;
}

/**
 * Generate a single embedding vector for a query string.
 * Used during RAG retrieval (search phase).
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const model = await getModel();
  // queryEmbed uses query-prefix if the model supports it (better retrieval precision)
  const vector = await model.queryEmbed(text);
  return Array.from(vector);
}

/**
 * Generate embeddings for a batch of texts efficiently.
 * Used during document ingestion (indexing phase).
 * Returns an array of number[] vectors in the same order as input texts.
 */
export async function getBatchEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const model = await getModel();
  const results: number[][] = [];

  // fastembed.embed() is an async generator yielding batches of Float32Array
  const embeddings = model.embed(texts, 32); // batch size 32
  for await (const batch of embeddings) {
    for (const vec of batch) {
      results.push(Array.from(vec));
    }
  }

  return results;
}

/**
 * Returns the embedding vector dimension.
 * Used when creating Qdrant collections.
 */
export function getEmbeddingDimension(): number {
  return EMBEDDING_DIM;
}
