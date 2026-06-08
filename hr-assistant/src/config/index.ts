import dotenv from 'dotenv';
import path from 'path';

// Load env files in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
  // Try loading from root folder as fallback
  dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'production',
  port: parseInt(process.env.PORT || '9004', 10),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  openaiModel: process.env.OPENAI_MODEL || 'openai/gpt-oss-120b:free',
  openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
};

// Validate API configuration
if (!config.openaiApiKey) {
  console.warn('[WARN] OPENAI_API_KEY is missing. LLM calls will fail.');
}
