import { ingestDocuments } from './services/ingestion.js';
import { initQdrant } from './services/db.js';

async function main() {
  console.log('[CLI Ingest] Initializing Qdrant collection...');
  await initQdrant();

  console.log('[CLI Ingest] Starting document ingestion...');
  const result = await ingestDocuments();
  
  if (result && result.success) {
    console.log(`[CLI Ingest] Success: ${result.message}`);
    process.exit(0);
  } else {
    console.error(`[CLI Ingest] Failed: ${result?.message || 'Unknown error'}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[CLI Ingest] Critical error during ingestion execution:', error);
  process.exit(1);
});
