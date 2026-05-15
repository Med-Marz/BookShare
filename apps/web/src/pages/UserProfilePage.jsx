import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { BookOpen, LogIn, Mail, MapPin, Phone } from 'lucide-react';
import { getUserById } from '../api/usersApi';
import { listBooksByOwner } from '../api/booksApi';
import BookCard from '../components/BookCard.jsx';
import useAuth from '../auth/useAuth';

function initialsFrom(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function UserProfilePage() {
  const { id } = useParams();
  const { token, currentUser } = useAuth();
  const location = useLocation();
  const isOwnProfile = Boolean(currentUser?.id) && currentUser.id === id;

  // All hooks must run in the same order on every render, so they are declared
  // before any conditional early return below.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!isOwnProfile);
  const [error, setError] = useState(null);
  const [books, setBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(!isOwnProfile);

  useEffect(() => {
    if (isOwnProfile) return undefined;
    let cancelled = false;
    setLoading(true);
    setBooksLoading(true);
    setError(null);
    (async () => {
      try {
        const fresh = await getUserById(id);
        if (cancelled) return;
        setUser(fresh);
        try {
          const list = await listBooksByOwner(id);
          if (!cancelled) setBooks(list);
        } catch {
          if (!cancelled) setBooks([]);
        } finally {
          if (!cancelled) setBooksLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const status = err?.response?.status;
          setError(status === 404 ? 'not-found' : 'fetch-failed');
          setBooksLoading(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isOwnProfile]);

  const initials = useMemo(() => initialsFrom(user?.display_name), [user?.display_name]);

  // Viewing your own /users/:id bounces to the editable /profile page.
  if (isOwnProfile) {
    return <Navigate to="/profile" replace />;
  }

  if (loading) {
    return <main className="mx-auto max-w-3xl px-6 py-16 text-sepiaSoft">Loading…</main>;
  }

  if (error === 'not-found') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="card-surface flex flex-col items-center gap-4 p-10 text-center">
          <h1 className="font-display text-3xl text-sepiaDark">
            We couldn&apos;t find this reader
          </h1>
          <p className="text-sepiaSoft">
            The user you&apos;re looking for either doesn&apos;t exist or has left BookShare.
          </p>
          <Link to="/books" className="btn-primary no-underline">
            Browse books instead
          </Link>
        </div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p
          role="alert"
          className="rounded-md border border-bordeaux/30 bg-bordeaux/10 px-3 py-2 text-sm text-bordeaux"
        >
          Could not load this profile. Please try again later.
        </p>
      </main>
    );
  }

  const isAuthenticated = Boolean(token);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 animate-fade-up">
      {/* ── Profile hero ── */}
      <section className="card-surface flex flex-col items-start gap-5 p-7 sm:flex-row sm:items-center">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-panel-warmth font-display text-2xl text-ivory shadow-shelf">
          {initials}
        </span>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.18em] text-sepiaSoft">Reader</p>
          <h1 className="mt-1 font-display text-3xl text-sepiaDark sm:text-4xl">
            {user.display_name}
          </h1>
          <p className="mt-2 text-sm text-sepiaSoft">A fellow reader on BookShare.</p>
        </div>
      </section>

      {/* ── Contact card ── */}
      <section className="card-surface mt-6 p-7">
        <h2 className="font-display text-xl text-sepiaDark">Contact</h2>
        {isAuthenticated ? (
          <dl className="mt-5 space-y-4 text-sm">
            <ContactRow
              icon={<Mail className="h-4 w-4" aria-hidden="true" />}
              label="Email"
              value={user.email}
            />
            <ContactRow
              icon={<Phone className="h-4 w-4" aria-hidden="true" />}
              label="Phone"
              value={user.phone}
            />
            <ContactRow
              icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
              label="Address"
              value={user.address}
            />
          </dl>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-paperDark bg-ivory/70 p-5 text-sm text-sepiaSoft">
            <p>Sign in to view this reader&apos;s contact details.</p>
            <Link
              to="/login"
              state={{ from: location }}
              className="btn-primary mt-4 no-underline"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in to view contact info
            </Link>
          </div>
        )}
      </section>

      {/* ── Books listed by this reader ── */}
      <section className="mt-8">
        <h2 className="font-display text-2xl text-sepiaDark">
          Books listed by {user.display_name}
        </h2>

        {booksLoading ? (
          <p className="mt-4 text-sepiaSoft">Loading books…</p>
        ) : books.length > 0 ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {books.map((b) => (
              <BookCard key={b.id} book={b} showStatus={false} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-paperDark bg-ivory/70 p-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-cream">
                <BookOpen className="h-5 w-5 text-bordeaux" aria-hidden="true" />
              </span>
              <h3 className="font-display text-lg text-sepiaDark">No books listed yet</h3>
            </div>
            <p className="mt-3 text-sm text-sepiaSoft">
              The catalog will show {user.display_name}&apos;s books here when they add some.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function ContactRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-paper text-sepia">
        {icon}
      </span>
      <div>
        <dt className="text-xs uppercase tracking-[0.14em] text-sepiaSoft">{label}</dt>
        <dd className="text-ink">
          {value || <span className="italic text-sepiaSoft">(not set)</span>}
        </dd>
      </div>
    </div>
  );
}

export default UserProfilePage;
