const express = require('express');
const grpc = require('@grpc/grpc-js');

const userClient = require('../clients/userClient');
const { makeMetadata } = require('../clients/grpcMetadata');
const { updateMeBodySchema } = require('../schemas/userSchemas');

const router = express.Router();

// GET /api/v1/profile — return the authenticated user's full profile.
// requireAuth middleware (mounted in index.js) has already populated req.userId.
router.get('/', async (req, res) => {
  const { user } = await userClient.getUser({ user_id: req.userId });
  res.json(user);
});

// PUT /api/v1/profile — update display_name, phone, address (any subset).
// `.strict()` in the zod schema rejects unknown keys (including `email`).
router.put('/', async (req, res) => {
  const parsed = updateMeBodySchema.safeParse(req.body || {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first.path?.join('.') || 'body';
    const err = new Error(`${path}: ${first.message}`);
    err.code = grpc.status.INVALID_ARGUMENT;
    throw err;
  }
  if (Object.keys(parsed.data).length === 0) {
    const err = new Error('at least one of display_name, phone, address must be supplied');
    err.code = grpc.status.INVALID_ARGUMENT;
    throw err;
  }
  const { user } = await userClient.updateUser(
    { user_id: req.userId, ...parsed.data },
    makeMetadata(req.userId),
  );
  if (req.log) {
    req.log.info({ event: 'user.updated', user_id: req.userId }, 'profile updated');
  }
  res.json(user);
});

module.exports = router;
