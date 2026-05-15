const { z } = require('zod');

const currentYear = new Date().getFullYear();

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const addBookSchema = z.object({
  owner_id: z.string().uuid({ message: 'must be a uuid' }),
  title: z.string().trim().min(1, 'cannot be empty').max(300),
  author: z.string().trim().min(1, 'cannot be empty').max(200),
  year_published: z
    .number()
    .int()
    .gte(1000, 'must be >= 1000')
    .lte(currentYear + 1, `must be <= ${currentYear + 1}`),
});

module.exports = { addBookSchema, ALLOWED_CONTENT_TYPES };
