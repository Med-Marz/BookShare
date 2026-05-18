import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookmarkPlus, ChevronLeft, ChevronRight, Library } from 'lucide-react';
import BookCard from '../components/BookCard.jsx';
import { listBooks } from '../api/booksApi';
import useAuth from '../auth/useAuth';

const PAGE_SIZE = 8;

function BrowsePage() {
  const { token } = useAuth();
  const isAuthenticated = Boolean(token);

  const [books, setBooks] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Single fetch of the whole catalog — the cahier-scale stays well under
  // a few hundred books, so we slice client-side rather than chase cursors.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { books: all } = await listBooks({ limit: 200 });
        if (!cancelled) setBooks(all || []);
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

  const totalPages = Math.max(1, Math.ceil(books.length / PAGE_SIZE));
  const pageBooks = useMemo(
    () => books.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [books, page],
  );

  function goToPage(target) {
    if (target < 1 || target > totalPages || target === page) return;
    setPage(target);
    // Scroll back up so the user lands on the new page's first row.
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
            {pageBooks.map((b) => (
              <BookCard key={b.id} book={b} owner={b.owner} showStatus />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              aria-label="Catalog pagination"
              className="mt-10 flex flex-wrap items-center justify-center gap-2"
            >
              <PaginationButton
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span>Previous</span>
              </PaginationButton>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <PaginationButton
                  key={n}
                  onClick={() => goToPage(n)}
                  active={n === page}
                  aria-label={`Page ${n}`}
                  aria-current={n === page ? 'page' : undefined}
                >
                  {n}
                </PaginationButton>
              ))}

              <PaginationButton
                onClick={() => goToPage(page + 1)}
                disabled={page === totalPages}
                aria-label="Next page"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </PaginationButton>
            </nav>
          )}
        </>
      )}
    </main>
  );
}

function PaginationButton({ active, disabled, children, ...rest }) {
  const base =
    'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition';
  const variant = active
    ? 'border-bordeaux bg-bordeaux text-ivory shadow-shelf cursor-default'
    : disabled
      ? 'border-paperDark bg-paper/40 text-sepiaSoft/60 cursor-not-allowed'
      : 'border-paperDark bg-cream text-sepia hover:border-sepiaSoft hover:text-bordeaux';
  return (
    <button
      type="button"
      disabled={disabled || active}
      className={`${base} ${variant}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export default BrowsePage;
