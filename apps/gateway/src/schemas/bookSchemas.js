const { z } = require('zod');

const currentYear = new Date().getFullYear();

// Form fields arrive as strings (multer parses multipart text parts as strings).
// We coerce year_published to int, then bound-check it.
const addBookBodySchema = z
  .object({
    title: z.string().trim().min(1, 'cannot be empty').max(300),
    author: z.string().trim().min(1, 'cannot be empty').max(200),
    year_published: z
      .union([z.string().regex(/^-?\d+$/, 'must be a whole number'), z.number()])
      .transform((v) => Number.parseInt(v, 10))
      .refine(
        (n) => Number.isInteger(n) && n >= 1000 && n <= currentYear + 1,
        `must be between 1000 and ${currentYear + 1}`,
      ),
  })
  .strict();

module.exports = { addBookBodySchema };
