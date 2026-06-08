import dotenv from 'dotenv';
import path from 'path';

// Load .env in non-production environments
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
  dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'production',
  port: parseInt(process.env.PORT || '9004', 10),

  // ── LLM (OpenRouter / OpenAI compatible) ──
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1',
  openaiModel: process.env.OPENAI_MODEL || 'openai/gpt-oss-120b:free',

  // ── Qdrant Vector DB ──
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',

  // ── Documents ──
  documentsPath: process.env.DOCUMENTS_PATH || '/documents',
};

// Startup validation
if (!config.openaiApiKey) {
  console.warn('[Config] ⚠ OPENAI_API_KEY is not set. LLM answers will fail.');
}

console.log(`[Config] LLM  : ${config.openaiBaseUrl} → ${config.openaiModel}`);
console.log(`[Config] DB   : ${config.qdrantUrl}`);
console.log(`[Config] Docs : ${config.documentsPath}`);
console.log(`[Config] Embed: FastEmbed (paraphrase-multilingual-MiniLM-L12-v2, local)`);
