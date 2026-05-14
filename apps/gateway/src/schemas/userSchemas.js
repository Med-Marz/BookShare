const { z } = require('zod');

// Profile update validation. `.strict()` rejects any key the schema does not
// explicitly allow — `email` (immutable), `password` (auth surface only), or
// random keys from a curious attacker. Each supplied field must be non-empty
// after trim.
const updateMeBodySchema = z
  .object({
    display_name: z.string().trim().min(1, 'display_name cannot be empty').optional(),
    phone: z.string().trim().min(1, 'phone cannot be empty').optional(),
    address: z.string().trim().min(1, 'address cannot be empty').optional(),
  })
  .strict();

module.exports = { updateMeBodySchema };
