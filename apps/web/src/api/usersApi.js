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
