const { z } = require('zod');

const currentYear = new Date().getFullYear();

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Year bound spans ancient texts (negatives = BCE) up to next calendar year.
// e.g. The Art of War ≈ -500, the Iliad ≈ -700.
const MIN_YEAR = -3000;
const MAX_YEAR = currentYear + 1;

const addBookSchema = z.object({
  owner_id: z.string().uuid({ message: 'must be a uuid' }),
  title: z.string().trim().min(1, 'cannot be empty').max(300),
  author: z.string().trim().min(1, 'cannot be empty').max(200),
  year_published: z
    .number()
    .int()
    .gte(MIN_YEAR, `must be >= ${MIN_YEAR}`)
    .lte(MAX_YEAR, `must be <= ${MAX_YEAR}`),
});

const editBookSchema = z
  .object({
    title: z.string().trim().min(1, 'cannot be empty').max(300).optional(),
    author: z.string().trim().min(1, 'cannot be empty').max(200).optional(),
    year_published: z
      .number()
      .int()
      .gte(MIN_YEAR, `must be >= ${MIN_YEAR}`)
      .lte(MAX_YEAR, `must be <= ${MAX_YEAR}`)
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'at least one of title, author, year_published must be supplied',
  });

module.exports = { addBookSchema, editBookSchema, ALLOWED_CONTENT_TYPES };
