import axios from './axios';

// POST /api/v1/auth/signup — visitor creates an account.
// Returns { token, user: { id, email, display_name } } on success.
// Rejects with an axios error whose response.data.error is the gateway envelope.
export async function signup(body) {
  const res = await axios.post('/api/v1/auth/signup', body);
  return res.data;
}
