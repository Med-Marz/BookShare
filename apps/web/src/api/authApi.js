import axios from './axios';

// POST /api/v1/auth/signup — visitor creates an account.
// Returns { token, user: { id, email, display_name } } on success.
// Rejects with an axios error whose response.data.error is the gateway envelope.
export async function signup(body) {
  const res = await axios.post('/api/v1/auth/signup', body);
  return res.data;
}

// POST /api/v1/auth/login — registered user authenticates.
// Returns { token, user } on success. Any failure (validation, unknown email,
// wrong password) returns the same generic 401 envelope.
export async function login(email, password) {
  const res = await axios.post('/api/v1/auth/login', { email, password });
  return res.data;
}
