import axios from 'axios';
// @ts-ignore
import { pipeline } from '@xenova/transformers';
import { config } from '../config/index.js';

let localPipeline: any = null;

/**
 * Generates text embeddings locally using ONNX runtime and Xenova/all-MiniLM-L6-v2 model.
 * Run completely locally and privately inside the container.
 */
async function getLocalEmbedding(text: string): Promise<number[]> {
  if (!localPipeline) {
    console.log(`[Embedding] Loading local ONNX model 'Xenova/all-MiniLM-L6-v2'...`);
    // Model will be cached locally in node_modules or system cache
    localPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log(`[Embedding] Local ONNX model loaded successfully.`);
  }

  const output = await localPipeline(text, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(output.data);
}

/**
 * Generate a vector embedding for the given text.
 * Tries the remote OpenAI compatible API first, falling back to local ONNX if it fails.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  if (config.openaiApiKey) {
    try {
      const url = `${config.openaiBaseUrl}/embeddings`;
      const response = await axios.post(
        url,
        {
          input: text.replace(/\n/g, ' '),
          model: config.openaiEmbeddingModel,
        },
        {
          headers: {
            'Authorization': `Bearer ${config.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 seconds timeout before fallback
        }
      );

      const embedding = response.data?.data?.[0]?.embedding;
      if (embedding && Array.isArray(embedding)) {
        return embedding;
      }
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message;
      console.warn(`[Embedding] Remote embedding failed (${msg}). Falling back to local ONNX embeddings...`);
    }
  } else {
    console.log(`[Embedding] No API key configured. Using local ONNX embeddings...`);
  }

  return await getLocalEmbedding(text);
}
