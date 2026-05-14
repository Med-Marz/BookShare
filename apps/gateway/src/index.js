const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express5');

const logger = require('./logger');
const { errorHandler } = require('./errors');
const resolvers = require('./resolvers');

const PORT = Number.parseInt(process.env.PORT || '4000', 10);
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';

// ---- GraphQL: SDL loaded from a single .gql file so the schema can grow
// without bloating this entrypoint. Resolvers live alongside in src/resolvers/.
const typeDefs = fs.readFileSync(path.join(__dirname, 'schema.gql'), 'utf8');

async function start() {
  const app = express();

  // ---- Middleware chain — order matters (NFR enforcement) ----
  // 1. CORS: single allowed origin, no wildcard.
  app.use(cors({ origin: WEB_ORIGIN, credentials: false }));

  // 2. Rate limit: 100 requests / 15-minute window per IP (NFR11b).
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: { code: 'RATE_LIMITED', message: 'Too many requests, please retry later.' },
      },
    }),
  );

  // 3. JSON body parser. 12 MB headroom; cover uploads use multer per-route in story 2.1.
  app.use(express.json({ limit: '12mb' }));

  // 4. pino HTTP request logging.
  app.use(pinoHttp({ logger }));

  // 5. JWT verification — story 1.3 enables this for /api/v1/* (skipping /auth/*).
  //    For Story 1.1 it stays as a no-op skip.

  // ---- Health endpoint for Docker Compose healthcheck (no business logic) ----
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // ---- REST routers under /api/v1 ----
  app.get('/api/v1', (_req, res) => res.json({ name: 'BookShare API', version: 'v1' }));
  app.use('/api/v1/auth', require('./routes/auth'));

  // ---- GraphQL — Apollo Server must start before mounting middleware ----
  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();
  app.use('/graphql', expressMiddleware(apollo));

  // ---- Error envelope mapping — must be the LAST middleware ----
  app.use(errorHandler);

  app.listen(PORT, () => {
    logger.info(
      {
        port: PORT,
        web_origin: WEB_ORIGIN,
        graphql: `/graphql`,
        rest_prefix: '/api/v1',
      },
      'gateway listening',
    );
  });
}

start().catch((err) => {
  logger.fatal({ err }, 'gateway failed to start');
  process.exit(1);
});
