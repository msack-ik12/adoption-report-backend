import express from 'express';
import { config } from './config';
import { corsMiddleware } from './utils/cors';
import { logger } from './utils/logger';
import healthRouter from './routes/health';
import generateRouter from './routes/generate';
import exportRouter from './routes/export';
import gongRouter from './routes/gong';

const app = express();

// Body size limit
app.use(express.json({ limit: `${config.maxUploadMb}mb` }));
app.use(express.urlencoded({ extended: true, limit: `${config.maxUploadMb}mb` }));

// CORS
app.use(corsMiddleware);

// Routes
app.use(healthRouter);
app.use(generateRouter);
app.use(exportRouter);
app.use(gongRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

app.listen(config.port, () => {
  logger.info(`Server started on port ${config.port}`, {
    port: config.port,
    llmProvider: config.llmProvider,
    mockMode: config.isMockMode,
    frontendOrigin: config.frontendOrigin,
  });
  logger.info(`[llm] Using provider: ${config.llmProvider}`);
  if (config.isMockMode) {
    logger.warn('Running in MOCK mode — set GEMINI_API_KEY or ANTHROPIC_API_KEY in .env for real LLM calls');
  }
});

export default app;
