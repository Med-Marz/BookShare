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
const { requireAuth, optionalAuth, optionalAuthForGraphQL } = require('./auth');
const resolvers = require('./resolvers');

const PORT = Number.parseInt(process.env.PORT || '4000', 10);
// Accept one origin or several (comma-separated). Dev typically allows the
// Vite dev server (5173) and the dockerized nginx web (8080) at the same time.
const WEB_ORIGIN = (process.env.WEB_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// ---- GraphQL: SDL loaded from a single .gql file so the schema can grow
// without bloating this entrypoint. Resolvers live alongside in src/resolvers/.
const typeDefs = fs.readFileSync(path.join(__dirname, 'schema.gql'), 'utf8');

async function start() {
  const app = express();

  // ---- Middleware chain — order matters (NFR enforcement) ----
  // 1. CORS: explicit allowlist of origins, no wildcard.
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

  // 3. JSON body parser. 16 MB headroom — enough for base64-encoded 10 MB
  // covers via the GraphQL addBook path. REST cover uploads bypass this and
  // go through multer per-route.
  app.use(express.json({ limit: '16mb' }));

  // 4. pino HTTP request logging.
  app.use(pinoHttp({ logger }));

  // ---- Health endpoint for Docker Compose healthcheck (no business logic) ----
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // ---- PUBLIC routes under /api/v1 (no JWT required) ----
  app.get('/api/v1', (_req, res) => res.json({ name: 'BookShare API', version: 'v1' }));
  app.use('/api/v1/auth', require('./routes/auth'));

  // ---- PUBLIC-WITH-OPTIONAL-AUTH: routes that ARE reachable anonymously but
  // change their response when a valid JWT is present. `optionalAuth` populates
  // req.userId on success and leaves it undefined on missing/bad tokens.
  app.use('/api/v1/users', optionalAuth, require('./routes/users'));

  // Covers are public — anyone (signed-in or not) can fetch a cover image
  // by its MinIO object key. Mounted BEFORE requireAuth so anonymous viewers
  // can render covers in book grids.
  app.use('/api/v1/covers', require('./routes/covers'));

  // Public book detail (GET /api/v1/books/:id). Other /books verbs (POST, PUT)
  // are authenticated and mounted further down on the same prefix — Express
  // tries routers in registration order, so the public GET hits first.
  // optionalAuth populates req.userId if a valid JWT is present so the route
  // can include the viewer's active reservation in the response.
  app.use('/api/v1/books', optionalAuth, require('./routes/booksPublic'));

  // Public Home endpoints (recently added books, etc.).
  app.use('/api/v1/home', require('./routes/home'));

  // Public free-text catalog search.
  app.use('/api/v1/search', require('./routes/search'));

  // ---- JWT gate: every /api/v1/* route mounted AFTER this line is protected.
  // The discovery banner + /api/v1/auth/* + /api/v1/users/* land above this
  // line and stay public.
  app.use('/api/v1', requireAuth);

  // ---- PROTECTED routes (require valid JWT). Mounted after requireAuth.
  app.use('/api/v1/profile', require('./routes/profile'));
  app.use('/api/v1/books', require('./routes/books'));
  app.use('/api/v1/reservations', require('./routes/reservations'));

  // ---- GraphQL — Apollo Server must start before mounting middleware.
  // The context extracts the JWT's sub claim (or null) so resolvers can gate
  // themselves; the /graphql endpoint stays publicly reachable.
  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();
  app.use(
    '/graphql',
    expressMiddleware(apollo, {
      context: async ({ req }) => optionalAuthForGraphQL(req),
    }),
  );

  // ---- Error envelope mapping — must be the LAST middleware ----
  app.use(errorHandler);

  app.listen(PORT, () => {
    logger.info(
      {
        port: PORT,
        web_origins: WEB_ORIGIN,
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
