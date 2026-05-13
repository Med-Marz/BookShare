// JWT verification middleware. In Story 1.1 this is a no-op pass-through —
// Story 1.3 turns on real verification for every /api/v1/* path except /auth/*.
//
// When enabled, the middleware:
//   1. Reads the `Authorization: Bearer <jwt>` header.
//   2. Verifies the JWT signature using JWT_SECRET (HS256).
//   3. Attaches `req.userId` from the token's `sub` claim.
//   4. Lets the route handler call gRPC services with `x-user-id` metadata.
// On failure: 401 with { error: { code: 'AUTHENTICATION_REQUIRED' | 'INVALID_CREDENTIALS', message } }.

function requireAuth(_req, _res, next) {
  // TODO(story 1.3): verify JWT, set req.userId. For Story 1.1 we pass through unconditionally.
  return next();
}

function optionalAuth(_req, _res, next) {
  // TODO(story 1.3): decode JWT if present; set req.userId optionally.
  return next();
}

module.exports = { requireAuth, optionalAuth };
