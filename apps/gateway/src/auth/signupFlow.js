const grpc = require('@grpc/grpc-js');
const jwt = require('jsonwebtoken');

const userClient = require('../clients/userClient');
const { signupBodySchema } = require('../schemas/authSchemas');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '7d';

// Shared signup pipeline used by the REST route AND the GraphQL mutation.
// Validation → gRPC call → JWT sign → public user payload.
async function runSignup(input) {
  if (!JWT_SECRET) {
    const err = new Error('server misconfigured: JWT_SECRET missing');
    err.code = grpc.status.INTERNAL;
    throw err;
  }

  const parsed = signupBodySchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const fieldPath = issue.path?.join('.') || 'request';
    const err = new Error(`${fieldPath}: ${issue.message}`);
    err.code = grpc.status.INVALID_ARGUMENT;
    throw err;
  }

  const { user } = await userClient.createUser(parsed.data);

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

module.exports = { runSignup };
