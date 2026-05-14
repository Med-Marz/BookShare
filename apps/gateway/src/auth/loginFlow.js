const grpc = require('@grpc/grpc-js');
const jwt = require('jsonwebtoken');

const userClient = require('../clients/userClient');
const { loginBodySchema } = require('../schemas/authSchemas');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '7d';

// Shared login pipeline used by the REST route AND the GraphQL mutation.
// All failures (validation, no-user, wrong-password) surface as a single
// UNAUTHENTICATED so attackers cannot enumerate which check failed.
async function runLogin(input) {
  if (!JWT_SECRET) {
    const err = new Error('server misconfigured: JWT_SECRET missing');
    err.code = grpc.status.INTERNAL;
    throw err;
  }

  const parsed = loginBodySchema.safeParse(input);
  if (!parsed.success) {
    const err = new Error('email or password is incorrect');
    err.code = grpc.status.UNAUTHENTICATED;
    throw err;
  }

  // The gRPC client throws an error with .code on any failure; UNAUTHENTICATED
  // propagates cleanly through the gateway's errorHandler.
  const { user } = await userClient.authenticateUser(parsed.data);

  const token = jwt.sign({ sub: user.id }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: TOKEN_EXPIRY,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
    },
  };
}

module.exports = { runLogin };
