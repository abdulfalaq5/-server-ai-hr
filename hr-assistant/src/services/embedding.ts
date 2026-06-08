import axios from 'axios';
import { config } from '../config/index.js';

/**
 * Generate a vector embedding for the given text using the configured OpenAI compatible endpoint.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not configured. Cannot generate embeddings.');
  }

  const url = `${config.openaiBaseUrl}/embeddings`;

  try {
    const response = await axios.post(
      url,
      {
        input: text.replace(/\n/g, ' '), // Replace newlines to ensure clean input
        model: config.openaiEmbeddingModel,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    const embedding = response.data?.data?.[0]?.embedding;
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error(`Invalid response schema from embedding API: ${JSON.stringify(response.data)}`);
    }

    return embedding;
  } catch (error: any) {
    const detail = error.response?.data?.error?.message || error.response?.data || error.message;
    console.error(`[Embedding] Error creating embedding:`, detail);
    throw new Error(`Failed to generate embedding: ${detail}`);
  }
}
