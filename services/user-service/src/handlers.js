const { randomUUID } = require('node:crypto');
const grpc = require('@grpc/grpc-js');

const db = require('./db');
const { signupSchema, loginSchema } = require('./schemas');
const { hashPassword, verifyPassword } = require('./auth');

// Generic UNAUTHENTICATED — never distinguishes which check failed, so an
// attacker cannot enumerate which emails are registered or whether a password
// guess hit the right account.
const GENERIC_UNAUTHENTICATED = {
  code: grpc.status.UNAUTHENTICATED,
  message: 'email or password is incorrect',
};

// Map a zod error to a gRPC INVALID_ARGUMENT carrying the first field issue.
function zodErrorToGrpc(error) {
  const first = error.issues[0];
  const fieldPath = first.path?.join('.') || 'request';
  return {
    code: grpc.status.INVALID_ARGUMENT,
    message: `${fieldPath}: ${first.message}`,
  };
}

// Public shape returned to the gateway — never includes password_hash.
function toPublicUser(row) {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    phone: row.phone,
    address: row.address,
    created_at: row.created_at,
  };
}

function makeHandlers(logger) {
  return {
    async CreateUser(call, callback) {
      const parsed = signupSchema.safeParse({
        email: call.request.email,
        password: call.request.password,
        display_name: call.request.display_name,
        phone: call.request.phone,
        address: call.request.address,
      });
      if (!parsed.success) {
        return callback(zodErrorToGrpc(parsed.error));
      }

      const email = parsed.data.email.toLowerCase();
      try {
        const existing = await db.getUserByEmail(email);
        if (existing) {
          return callback({
            code: grpc.status.ALREADY_EXISTS,
            message: 'email already registered',
          });
        }

        const password_hash = await hashPassword(parsed.data.password);
        const row = {
          id: randomUUID(),
          email,
          password_hash,
          display_name: parsed.data.display_name,
          phone: parsed.data.phone,
          address: parsed.data.address,
          created_at: new Date().toISOString(),
        };
        await db.insertUser(row);

        // Log signup with email domain only — never the password.
        logger.info(
          { event: 'user.created', user_id: row.id, email_domain: email.split('@')[1] },
          'user created',
        );

        return callback(null, { user: toPublicUser(row) });
      } catch (err) {
        logger.error({ err }, 'CreateUser failed');
        return callback({
          code: grpc.status.INTERNAL,
          message: 'failed to create user',
        });
      }
    },

    async AuthenticateUser(call, callback) {
      const parsed = loginSchema.safeParse({
        email: call.request.email,
        password: call.request.password,
      });
      if (!parsed.success) {
        // Even validation errors are reported as UNAUTHENTICATED so the
        // attacker cannot distinguish malformed input from wrong credentials.
        return callback(GENERIC_UNAUTHENTICATED);
      }

      const email = parsed.data.email.toLowerCase();
      try {
        const row = await db.getUserByEmail(email);
        if (!row) {
          logger.warn(
            { event: 'auth.login.fail', reason: 'no_user', email_domain: email.split('@')[1] },
            'login failed',
          );
          return callback(GENERIC_UNAUTHENTICATED);
        }

        const ok = await verifyPassword(parsed.data.password, row.password_hash);
        if (!ok) {
          logger.warn(
            { event: 'auth.login.fail', reason: 'bad_password', email_domain: email.split('@')[1] },
            'login failed',
          );
          return callback(GENERIC_UNAUTHENTICATED);
        }

        logger.info(
          { event: 'auth.login', user_id: row.id, email_domain: email.split('@')[1] },
          'user logged in',
        );
        return callback(null, { user: toPublicUser(row) });
      } catch (err) {
        logger.error({ err }, 'AuthenticateUser failed');
        return callback({
          code: grpc.status.INTERNAL,
          message: 'failed to authenticate user',
        });
      }
    },
  };
}

module.exports = { makeHandlers };
