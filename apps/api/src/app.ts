import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { ZodError } from 'zod';
import multer from 'multer';
import { api } from './routes.ts';
import { health, HttpError } from './lib/db.ts';
export const app = express();
app.disable('x-powered-by');
app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: {
      directives: { frameAncestors: ["'self'", 'https://revolte.ai', 'https://*.revolte.ai'] },
    },
  }),
);
app.use(express.json({ limit: '128kb' }));
app.get('/api/health', async (_request, response) => {
  try {
    await health();
    response.json({ status: 'ready', database: 'postgresql' });
  } catch (error) {
    console.error('Database readiness failed', (error as Error).message);
    response.status(503).json({ error: { message: 'Database unavailable' } });
  }
});
app.use(
  '/api/auth/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === 'test' ? 10000 : 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { message: 'Too many sign-in attempts. Try again later.' } },
  }),
);
app.use('/api', api);
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve('apps/web/dist')));
  app.get('/{*path}', (_request, response) =>
    response.sendFile(path.resolve('apps/web/dist/index.html')),
  );
}
app.use((_request, response) =>
  response.status(404).json({ error: { message: 'Route not found' } }),
);
const handleError: ErrorRequestHandler = (error, _request, response, _next) => {
  let status = 500;
  let message = 'The request could not be completed';
  let fields;
  if (error instanceof ZodError) {
    status = 422;
    message = 'Check the highlighted fields';
    fields = error.flatten().fieldErrors;
  } else if (error instanceof HttpError) {
    status = error.status;
    message = error.message;
  } else if (error instanceof multer.MulterError) {
    status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 422;
    message = 'Choose one supported file, maximum 4 MB';
  } else if (['23505', '23503', '23514', '22P02'].includes(error.code)) {
    status = error.code === '23505' ? 409 : 422;
    message =
      error.code === '23505'
        ? 'A matching record already exists'
        : 'Referenced data or field values are invalid';
  } else if (error.status === 413) {
    status = 413;
    message = 'Request too large';
  } else if (error instanceof SyntaxError) {
    status = 422;
    message = 'Invalid JSON request';
  } else if (error.message?.includes('date range') || error.message?.includes('Choose start')) {
    status = 422;
    message = error.message;
  }
  if (status === 500)
    console.error('API failure', { name: error.name, code: error.code, message: error.message });
  response.status(status).json({ error: { message, fields } });
};
app.use(handleError);
