const { z } = require('zod');

// Signup payload validation. Mirrors the gateway-side zod schema; both
// layers enforce the same shape (NFR9 server-side validation parity).
const signupSchema = z.object({
  email: z.string().trim().email('email must be a valid address'),
  password: z.string().min(8, 'password must be at least 8 characters'),
  display_name: z.string().trim().min(1, 'display_name is required'),
  phone: z.string().trim().min(1, 'phone is required'),
  address: z.string().trim().min(1, 'address is required'),
});

module.exports = { signupSchema };
