import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { authRouter } from './routes/auth.js';
import { apiRouter } from './routes/api.js';
import { allowFrontendOrigins, enforceSameOrigin } from './middleware/auth.js';

export const app = express();
const frontendPath = fileURLToPath(new URL('../public/', import.meta.url));
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://unpkg.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api', allowFrontendOrigins);
app.use('/api', enforceSameOrigin);
app.get('/health', (_request, response) => response.json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.use('/api', apiRouter);
app.use(express.static(frontendPath, { index: 'index.html' }));
app.use((error, _request, response, _next) => {
  console.error(error);
  if (error.type === 'entity.parse.failed') return response.status(400).json({ error: 'El cuerpo JSON no es válido.' });
  response.status(500).json({ error: 'Ocurrió un error interno. Inténtalo de nuevo.' });
});
