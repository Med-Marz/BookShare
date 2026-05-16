import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Library, Search } from 'lucide-react';
import BookCard from '../components/BookCard.jsx';
import { searchBooks } from '../api/booksApi';

function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = (searchParams.get('q') || '').trim();

  const [inputValue, setInputValue] = useState(q);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Empty query → bounce to Browse instead of running an empty search.
  useEffect(() => {
    if (!q) {
      navigate('/books', { replace: true });
    }
  }, [q, navigate]);

  // Keep the input value in sync if the URL changes externally (e.g. back/forward).
  useEffect(() => {
    setInputValue(q);
  }, [q]);

  useEffect(() => {
    if (!q) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const list = await searchBooks(q);
        if (!cancelled) setResults(list);
      } catch (err) {
        if (!cancelled) {
          const message =
            err?.response?.data?.error?.message || 'Could not run the search. Please try again.';
          setError(message);
          setResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) {
      navigate('/books', { replace: true });
      return;
    }
    if (trimmed === q) return; // no-op refresh
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 animate-fade-up">
      <header>
        <span className="text-xs uppercase tracking-[0.2em] text-sepiaSoft">Search</span>
        <h1 className="mt-2 font-display text-4xl text-sepiaDark md:text-5xl">
          {loading
            ? 'Searching…'
            : results.length === 0
              ? `No results for “${q}”`
              : `${results.length} ${results.length === 1 ? 'result' : 'results'} for “${q}”`}
        </h1>
      </header>

      <form
        onSubmit={handleSubmit}
        role="search"
        className="mt-6 flex max-w-2xl items-stretch gap-2"
      >
        <label className="sr-only" htmlFor="search-page-q">
          Refine search
        </label>
        <input
          id="search-page-q"
          type="search"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search by title, author, or owner"
          className="input-field flex-1"
        />
        <button type="submit" className="btn-ghost shrink-0">
          <Search className="h-4 w-4" aria-hidden="true" />
          Search
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-md border border-bordeaux/30 bg-bordeaux/10 px-3 py-2 text-sm text-bordeaux"
        >
          {error}
        </p>
      )}

      {!loading && results.length === 0 && !error && (
        <section className="card-surface mt-8 flex flex-col items-start gap-4 p-8">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-paper text-bordeaux">
            <Library className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-2xl text-sepiaDark">
              Try a different word
            </h2>
            <p className="mt-2 text-sepiaSoft">
              No books match this query. You can also browse the full catalog from scratch.
            </p>
          </div>
          <Link to="/books" className="btn-primary no-underline">
            Browse all books
          </Link>
        </section>
      )}

      {!loading && results.length > 0 && (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((b) => (
            <BookCard
              key={b.id}
              book={b}
              owner={b.owner}
              matchedBy={b.matched_by}
              showStatus
            />
          ))}
        </div>
      )}
    </main>
  );
}

export default SearchPage;
