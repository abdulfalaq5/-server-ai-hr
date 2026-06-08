import express, { Request, Response, NextFunction } from 'express';
import { config } from './config/index.js';
import { initQdrant } from './services/db.js';
import { ingestDocuments } from './services/ingestion.js';
import { queryHR } from './services/rag.js';

const app = express();
app.use(express.json());

// Logger helper
const log = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${new Date().toISOString()} ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${new Date().toISOString()} ${msg}`, ...args),
};

// Healthcheck endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'hr-assistant', version: '1.0.0' });
});

// Query endpoint for RAG chatbot
app.post('/query', async (req: Request, res: Response, next: NextFunction) => {
  const { query, history } = req.body;

  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'Missing or invalid parameter: query' });
    return;
  }

  try {
    log.info(`Received query: "${query}"`);
    const answer = await queryHR(query, history || []);
    res.json({ answer });
  } catch (error: any) {
    next(error);
  }
});

// Re-index / Ingest documents manual trigger
app.post('/ingest', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    log.info('Manual ingestion triggered.');
    const result = await ingestDocuments();
    res.json(result);
  } catch (error: any) {
    next(error);
  }
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  log.error('Unhandled server error:', err.message || err);
  res.status(500).json({
    error: {
      message: err.message || 'Internal Server Error',
    }
  });
});

// Start Server
const port = config.port;
app.listen(port, '0.0.0.0', async () => {
  log.info(`HR Assistant Service started on port ${port}`);
  log.info(`Health check: http://0.0.0.0:${port}/health`);
  log.info(`Query URL:    http://0.0.0.0:${port}/query`);

  try {
    // Initialize DB
    await initQdrant();

    // Auto-ingest files at startup
    log.info('Running startup document ingestion check...');
    await ingestDocuments();
  } catch (err: any) {
    log.error('Failed to initialize database or run ingestion:', err.message);
  }
});
