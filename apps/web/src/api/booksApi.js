import axios from './axios';

// GET /api/v1/users/:id/books — public list of a user's books.
// Returns an array (possibly empty); never null.
export async function listBooksByOwner(ownerId) {
  const res = await axios.get(`/api/v1/users/${ownerId}/books`);
  return res.data.books || [];
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
