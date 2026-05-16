import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookmarkPlus, Library } from 'lucide-react';
import BookCard from '../components/BookCard.jsx';
import { listBooks } from '../api/booksApi';
import useAuth from '../auth/useAuth';

function BrowsePage() {
  const { token } = useAuth();
  const isAuthenticated = Boolean(token);

  const [books, setBooks] = useState([]);
  const [cursor, setCursor] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { books: first, next_cursor } = await listBooks({ limit: 24 });
        if (!cancelled) {
          setBooks(first);
          setCursor(next_cursor);
        }
      } catch {
        if (!cancelled) setError('Could not load the catalog. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLoadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const { books: next, next_cursor } = await listBooks({ limit: 24, cursor });
      setBooks((prev) => [...prev, ...next]);
      setCursor(next_cursor);
    } catch {
      setError('Could not load more books. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 animate-fade-up">
      <header>
        <span className="text-xs uppercase tracking-[0.2em] text-sepiaSoft">Catalog</span>
        <h1 className="mt-2 font-display text-4xl text-sepiaDark md:text-5xl">Browse books</h1>
        <p className="mt-3 text-sepiaSoft">
          The full catalog, newest first. Click any book to see the cover, owner, and contact
          details.
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-md border border-bordeaux/30 bg-bordeaux/10 px-3 py-2 text-sm text-bordeaux"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-sepiaSoft">Loading the catalog…</p>
      ) : books.length === 0 ? (
        <section className="card-surface mt-8 flex flex-col items-start gap-4 p-8">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-paper text-bordeaux">
            <Library className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-2xl text-sepiaDark">
              The shelves are empty for the moment
            </h2>
            <p className="mt-2 text-sepiaSoft">
              No books have been listed yet. Be the first to add one and other readers will be
              able to reserve it.
            </p>
          </div>
          <Link
            to={isAuthenticated ? '/books/new' : '/signup'}
            className="btn-primary no-underline"
          >
            <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
            {isAuthenticated ? 'Add the first book' : 'Sign up to add a book'}
          </Link>
        </section>
      ) : (
        <>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {books.map((b) => (
              <BookCard key={b.id} book={b} owner={b.owner} showStatus />
            ))}
          </div>

          {cursor && (
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="btn-ghost"
              >
                {loadingMore ? 'Loading…' : 'Load more books'}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default BrowsePage;
