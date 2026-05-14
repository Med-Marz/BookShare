const bcrypt = require('bcrypt');

const BCRYPT_COST = 10;

// Hash a plaintext password. Never log the plaintext.
async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

// Compare plaintext against a stored bcrypt hash. Returns true/false.
async function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

module.exports = { hashPassword, verifyPassword };
