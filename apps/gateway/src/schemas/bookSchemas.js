const { z } = require('zod');

const currentYear = new Date().getFullYear();

// Allow ancient texts via negative integers (BCE). UI surfaces format
// negatives as "<n> BCE" — see formatYear helper.
const MIN_YEAR = -3000;
const MAX_YEAR = currentYear + 1;

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
        (n) => Number.isInteger(n) && n >= MIN_YEAR && n <= MAX_YEAR,
        `must be between ${MIN_YEAR} and ${MAX_YEAR}`,
      ),
  })
  .strict();

const editBookBodySchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    author: z.string().trim().min(1).max(200).optional(),
    year_published: z
      .union([z.string().regex(/^-?\d+$/, 'must be a whole number'), z.number()])
      .transform((v) => Number.parseInt(v, 10))
      .refine(
        (n) => Number.isInteger(n) && n >= MIN_YEAR && n <= MAX_YEAR,
        `must be between ${MIN_YEAR} and ${MAX_YEAR}`,
      )
      .optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, {
    message: 'at least one of title, author, year_published must be supplied',
  });

module.exports = { addBookBodySchema, editBookBodySchema };
