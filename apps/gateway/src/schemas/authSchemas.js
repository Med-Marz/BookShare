const { z } = require('zod');

// Signup body validation. Identical shape to user-service's signupSchema —
// duplicated here intentionally because services cannot import each other's
// internal modules (NFR19). Both layers validate; user-service is the
// authoritative boundary.
const signupBodySchema = z.object({
  email: z.string().trim().email('email must be a valid address'),
  password: z.string().min(8, 'password must be at least 8 characters'),
  display_name: z.string().trim().min(1, 'display_name is required'),
  phone: z.string().trim().min(1, 'phone is required'),
  address: z.string().trim().min(1, 'address is required'),
});

// Login body. Loose validation on purpose — any malformation is reported as
// UNAUTHENTICATED downstream so attackers cannot probe input shape.
const loginBodySchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

module.exports = { signupBodySchema, loginBodySchema };
