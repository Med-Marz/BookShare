const express = require('express');
const { runSignup } = require('../auth/signupFlow');
const { runLogin } = require('../auth/loginFlow');

const router = express.Router();

// POST /api/v1/auth/signup — visitor creates an account.
// On success: HTTP 201 with { token, user: { id, email, display_name } }.
// Express 5 auto-forwards async rejections to the central errorHandler — no
// try/catch needed in route handlers (architecture rule).
router.post('/signup', async (req, res) => {
  const result = await runSignup(req.body || {});
  if (req.log) {
    req.log.info({ event: 'auth.signup', user_id: result.user.id }, 'user signed up');
  }
  res.status(201).json(result);
});

// POST /api/v1/auth/login — registered user authenticates.
// On success: HTTP 200 with { token, user }. Failure → 401 via the central
// errorHandler (no enumeration of why).
router.post('/login', async (req, res) => {
  const result = await runLogin(req.body || {});
  if (req.log) {
    req.log.info({ event: 'auth.login', user_id: result.user.id }, 'user logged in');
  }
  res.status(200).json(result);
});

module.exports = router;
