import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookmarkPlus,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  Handshake,
  Library,
  Sparkles,
} from 'lucide-react';
import BookStack from '../components/BookStack.jsx';
import BookCard from '../components/BookCard.jsx';
import { listRecentBooks } from '../api/booksApi';
import { getMyActivity } from '../api/reservationsApi';
import useAuth from '../auth/useAuth';

function HomePage() {
  const { token, currentUser } = useAuth();
  const isAuthenticated = Boolean(token);

  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [activity, setActivity] = useState(null);
  const trackRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listRecentBooks(12);
        if (!cancelled) setRecent(list);
      } catch {
        if (!cancelled) setRecent([]);
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setActivity(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getMyActivity();
        if (!cancelled) setActivity(data);
      } catch {
        if (!cancelled) setActivity(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  function scrollCarousel(direction) {
    const track = trackRef.current;
    if (!track) return;
    // Scroll by one card width — the first card defines it.
    const firstCard = track.firstElementChild;
    const step = firstCard ? firstCard.offsetWidth + 20 : 280;
    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  }

  return (
    <main className="animate-fade-up">
      {/* ─────────── HERO ─────────── */}
      <section className="relative overflow-hidden bg-hero-warmth">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-[1.15fr_1fr] md:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-paperDark bg-cream px-3 py-1 text-xs uppercase tracking-[0.18em] text-sepiaSoft shadow-shelf">
              <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
              Peer-to-peer book sharing
            </span>

            <h1 className="mt-6 font-display text-5xl leading-[1.05] text-sepiaDark md:text-6xl">
              Share the books
              <br />
              <span className="italic text-bordeaux">on your shelf.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-sepiaSoft">
              BookShare connects readers who lend, borrow, and swap the titles they own. List a
              book, reserve one from another reader, and arrange the handover &mdash; in person or
              by post.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link to="/books" className="btn-primary no-underline">
                Browse the catalog
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              {isAuthenticated ? (
                <Link to="/books/new" className="btn-ghost no-underline">
                  <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                  List a book
                </Link>
              ) : (
                <Link to="/signup" className="btn-ghost no-underline">
                  Create an account
                </Link>
              )}
            </div>

          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-paper/60 blur-2xl" />
            <BookStack className="w-full drop-shadow-[0_18px_28px_rgba(92,70,50,0.18)]" />
          </div>
        </div>
      </section>

      {/* ─────────── ACTIVITY PANEL (authenticated only) ─────────── */}
      {isAuthenticated && activity && (
        <section className="mx-auto max-w-6xl px-6 pt-12">
          {currentUser?.display_name && (
            <h1 className="font-display text-4xl text-sepiaDark sm:text-5xl">
              Welcome back,{' '}
              <span className="italic text-bordeaux">{currentUser.display_name}</span>.
            </h1>
          )}
          {activity.activeReservationCount === 0 && activity.listedBookCount === 0 ? (
            <div className="card-surface mt-6 flex items-start gap-4 p-6">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-bordeaux">
                <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-xl text-sepiaDark">Your activity</h2>
                <p className="mt-1 text-sm text-sepiaSoft">
                  You haven't reserved or listed any books yet — try browsing the catalog or
                  add your first book.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link to="/books" className="btn-ghost no-underline">
                    Browse books
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link to="/books/new" className="btn-primary no-underline">
                    <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                    Add a book
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h2 className="mb-4 mt-6 font-display text-2xl text-sepiaDark">Your activity</h2>
              <div className="grid gap-5 sm:grid-cols-2">
              <Link
                to="/reservations"
                className="card-surface flex items-center gap-4 p-6 no-underline transition hover:-translate-y-0.5 hover:shadow-shelfLg"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-paper text-bordeaux">
                  <BookOpenCheck className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-display text-3xl text-bordeauxDeep">
                    {activity.activeReservationCount}
                  </p>
                  <p className="text-sm text-sepiaSoft">Active reservations</p>
                </div>
              </Link>
              <Link
                to="/profile"
                className="card-surface flex items-center gap-4 p-6 no-underline transition hover:-translate-y-0.5 hover:shadow-shelfLg"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-paper text-bordeaux">
                  <Library className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-display text-3xl text-bordeauxDeep">
                    {activity.listedBookCount}
                  </p>
                  <p className="text-sm text-sepiaSoft">Books you've listed</p>
                </div>
              </Link>
              </div>
            </>
          )}
        </section>
      )}

      {/* ─────────── RECENTLY ADDED ─────────── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex items-end justify-between gap-3">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-sepiaSoft">
              Recently added
            </span>
            <h2 className="mt-2 font-display text-3xl text-sepiaDark">Fresh on the shelves</h2>
          </div>
          <Link
            to="/books"
            className="hidden text-sm text-sepiaSoft no-underline hover:text-bordeaux sm:inline-flex sm:items-center sm:gap-1"
          >
            See all
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {recentLoading ? (
          <p className="mt-6 text-sepiaSoft">Loading recent books…</p>
        ) : recent.length > 0 ? (
          <div className="group relative mt-6">
            <button
              type="button"
              onClick={() => scrollCarousel(-1)}
              aria-label="Scroll left"
              className="absolute left-0 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-paperDark bg-cream/95 p-2 text-sepia shadow-card backdrop-blur-sm transition hover:border-sepiaSoft hover:text-bordeaux sm:inline-flex"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scrollCarousel(1)}
              aria-label="Scroll right"
              className="absolute right-0 top-1/2 z-10 hidden translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-paperDark bg-cream/95 p-2 text-sepia shadow-card backdrop-blur-sm transition hover:border-sepiaSoft hover:text-bordeaux sm:inline-flex"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <div
              ref={trackRef}
              className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2"
              style={{ scrollbarWidth: 'thin' }}
            >
              {recent.map((b) => (
                <div key={b.id} className="w-64 shrink-0 snap-start">
                  <BookCard book={b} owner={b.owner} showStatus />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-paperDark bg-ivory/70 p-8 text-center">
            <h3 className="font-display text-xl text-sepiaDark">No books yet</h3>
            <p className="mt-2 text-sm text-sepiaSoft">
              The shelves are empty for the moment. Be the first to add a book!
            </p>
            <Link
              to={isAuthenticated ? '/books/new' : '/signup'}
              className="btn-primary mt-5 no-underline"
            >
              <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
              {isAuthenticated ? 'Add your first book' : 'Sign up to add a book'}
            </Link>
          </div>
        )}
      </section>

      {/* ─────────── HOW IT WORKS ─────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center">
          <span className="text-xs uppercase tracking-[0.2em] text-sepiaSoft">How it works</span>
          <h2 className="mt-3 font-display text-4xl text-sepiaDark">Three small steps</h2>
          <p className="mx-auto mt-3 max-w-xl text-sepiaSoft">
            BookShare keeps the process simple. Sharing books should feel like passing one across
            the table.
          </p>
        </div>

        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          <StepCard
            step="01"
            icon={<Library className="h-5 w-5 text-bordeaux" aria-hidden="true" />}
            title="List the books you own"
            copy="Add a title, an author, and a cover photo. Other readers see it appear in the catalog right away."
          />
          <StepCard
            step="02"
            icon={<BookmarkPlus className="h-5 w-5 text-bordeaux" aria-hidden="true" />}
            title="Reserve what you want to read"
            copy="Found something on someone's shelf? Reserve it to lock the title — it disappears from public search."
          />
          <StepCard
            step="03"
            icon={<Handshake className="h-5 w-5 text-bordeaux" aria-hidden="true" />}
            title="Arrange the handover"
            copy="Contact info opens once a reservation is active. Meet up, post the parcel, or swap two books at once."
          />
        </ol>
      </section>

      {/* ─────────── CLOSING CTA ─────────── */}
      <section className="bg-panel-warmth text-ivory">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-16 text-center">
          <h2 className="font-display text-4xl text-ivory md:text-5xl">
            Your shelf is just sitting there.
          </h2>
          <p className="max-w-2xl text-base leading-relaxed text-paper/80">
            Lend the books you&apos;ve already read, borrow titles you&apos;ve been meaning to
            start, and turn an idle shelf into a small community library.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
            {isAuthenticated ? (
              <Link
                to="/books/new"
                className="inline-flex items-center gap-2 rounded-full bg-ivory px-6 py-3 font-semibold text-bordeauxDeep no-underline shadow-shelfLg hover:bg-cream"
              >
                <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                List a book
              </Link>
            ) : (
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-ivory px-6 py-3 font-semibold text-bordeauxDeep no-underline shadow-shelfLg hover:bg-cream"
              >
                Get started — it&apos;s free
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
            <Link
              to="/books"
              className="inline-flex items-center gap-2 rounded-full border border-ivory/40 px-6 py-3 font-semibold text-ivory no-underline hover:border-ivory hover:bg-ivory/10"
            >
              Browse first
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────── FOOTER ─────────── */}
      <footer className="border-t border-paper bg-ivory">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-sepiaSoft md:flex-row">
          <p className="font-display text-base text-sepia">BookShare</p>
          <p>A small library, shared between readers.</p>
        </div>
      </footer>
    </main>
  );
}

function StepCard({ step, icon, title, copy }) {
  return (
    <li className="card-surface group relative flex flex-col gap-4 p-7 transition hover:-translate-y-0.5 hover:shadow-shelfLg">
      <div className="flex items-center justify-between">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-paper bg-ivory">
          {icon}
        </span>
        <span className="font-display text-3xl text-paperDark group-hover:text-bordeaux/30">
          {step}
        </span>
      </div>
      <h3 className="font-display text-xl text-sepiaDark">{title}</h3>
      <p className="text-sm leading-relaxed text-sepiaSoft">{copy}</p>
    </li>
  );
}

export default HomePage;
