const grpc = require('@grpc/grpc-js');

// Build gRPC metadata carrying the authenticated user. Every outbound call from
// the gateway uses this so services can trust `x-user-id` without re-validating
// the JWT. For unauthenticated calls (catalog browse, etc.) the key is omitted.
function makeMetadata(userId) {
  const md = new grpc.Metadata();
  if (userId) md.add('x-user-id', String(userId));
  return md;
}

module.exports = { makeMetadata };
