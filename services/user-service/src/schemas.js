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

// Login payload validation. Intentionally NOT enforcing the 8-char minimum:
// passwords created under different rules should still be allowed to log in.
// Any malformation here still returns UNAUTHENTICATED (never INVALID_ARGUMENT)
// to keep failure messages indistinguishable from "wrong password".
const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

module.exports = { signupSchema, loginSchema };
