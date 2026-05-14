const grpc = require('@grpc/grpc-js');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Wrap a JWT failure into a gRPC-shaped error so the central errorHandler maps
// it to HTTP 401 / AUTHENTICATION_REQUIRED uniformly.
function unauthenticated(message) {
  const err = new Error(message);
  err.code = grpc.status.UNAUTHENTICATED;
  return err;
}

function readBearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
}

// Hard gate: reject any request without a valid token. Mount AFTER the public
// routes (signup, login, banner) so they remain reachable.
function requireAuth(req, _res, next) {
  if (!JWT_SECRET) return next(unauthenticated('server misconfigured'));
  const token = readBearer(req);
  if (!token) return next(unauthenticated('missing or malformed Authorization header'));
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    return next();
  } catch {
    return next(unauthenticated('invalid or expired token'));
  }
}

// Soft variant: attaches req.userId when a valid token is present, otherwise
// leaves it undefined and lets the handler decide. Use for routes that have
// both public and authenticated personas (book detail page, etc.).
function optionalAuth(req, _res, next) {
  if (!JWT_SECRET) return next();
  const token = readBearer(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
  } catch {
    // ignore — leaves req.userId undefined
  }
  return next();
}

// Apollo Server context builder. Returns { userId } — null if no/bad token.
// Resolvers that require auth check ctx.userId and throw GraphQLError with
// extensions.code: 'AUTHENTICATION_REQUIRED' when it is null.
function optionalAuthForGraphQL(req) {
  if (!JWT_SECRET) return { userId: null };
  const token = readBearer(req);
  if (!token) return { userId: null };
  try {
    const payload = verifyToken(token);
    return { userId: payload.sub };
  } catch {
    return { userId: null };
  }
}

module.exports = { requireAuth, optionalAuth, optionalAuthForGraphQL };
