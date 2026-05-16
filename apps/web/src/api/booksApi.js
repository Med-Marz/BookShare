import axios from './axios';

// GET /api/v1/users/:id/books — public list of a user's books.
// Returns an array (possibly empty); never null.
export async function listBooksByOwner(ownerId) {
  const res = await axios.get(`/api/v1/users/${ownerId}/books`);
  return res.data.books || [];
}

// GET /api/v1/home/recent-books — public, returns books enriched with owner.display_name.
export async function listRecentBooks(limit = 12) {
  const res = await axios.get('/api/v1/home/recent-books', { params: { limit } });
  return res.data.books || [];
}

// GET /api/v1/search?q=... — public free-text search.
// Returns books enriched with owner.display_name and a matched_by array.
export async function searchBooks(query) {
  const res = await axios.get('/api/v1/search', { params: { q: query } });
  return res.data.books || [];
}

// GET /api/v1/books — public catalog with cursor pagination.
// next_cursor is '' when the catalog end has been reached.
export async function listBooks({ limit = 24, cursor = '' } = {}) {
  const params = { limit };
  if (cursor) params.cursor = cursor;
  const res = await axios.get('/api/v1/books', { params });
  return {
    books: res.data.books || [],
    next_cursor: res.data.next_cursor || '',
  };
}

// GET /api/v1/books/:id — public book detail.
export async function getBook(bookId) {
  const res = await axios.get(`/api/v1/books/${bookId}`);
  return res.data.book;
}

// PUT /api/v1/books/:id — owner-only update of title/author/year.
export async function editBook(bookId, patch) {
  const res = await axios.put(`/api/v1/books/${bookId}`, patch);
  return res.data.book;
}

// DELETE /api/v1/books/:id — owner-only, fails when status is Reserved/Lent Out.
// Returns nothing on success; throws an axios error on any failure path.
export async function deleteBook(bookId) {
  await axios.delete(`/api/v1/books/${bookId}`);
}

// PUT /api/v1/books/:id/cover (multipart). Owner-only. The response carries
// the updated book with a fresh cover_object_key, so the caller can render the
// new image immediately.
export async function replaceCover(bookId, file) {
  const fd = new FormData();
  fd.append('cover', file);
  const res = await axios.put(`/api/v1/books/${bookId}/cover`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.book;
}

// POST /api/v1/books (multipart). `cover` is a File from the browser.
// Returns the created book document on success.
export async function addBook({ title, author, year_published, cover }) {
  const fd = new FormData();
  fd.append('title', title);
  fd.append('author', author);
  fd.append('year_published', String(year_published));
  fd.append('cover', cover);
  const res = await axios.post('/api/v1/books', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.book;
}
