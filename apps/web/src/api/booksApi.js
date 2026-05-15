import axios from './axios';

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
