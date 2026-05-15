import axios from './axios';

// GET /api/v1/profile — fetch the authenticated user's full profile.
export async function getProfile() {
  const res = await axios.get('/api/v1/profile');
  return res.data;
}

// PUT /api/v1/profile — update any subset of display_name, phone, address.
// The gateway rejects unknown keys (notably `email`) with 400 VALIDATION_ERROR.
export async function updateProfile(patch) {
  const res = await axios.put('/api/v1/profile', patch);
  return res.data;
}

// GET /api/v1/users/:id — public profile read.
// Anonymous callers receive { id, display_name } only. Authenticated callers
// (axios auto-injects the JWT) receive the full public profile.
export async function getUserById(id) {
  const res = await axios.get(`/api/v1/users/${encodeURIComponent(id)}`);
  return res.data;
}
