import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { BookOpen, LogIn, Mail, MapPin, Phone, UserRound } from 'lucide-react';
import { getUserById } from '../api/usersApi';
import useAuth from '../auth/useAuth';

function UserProfilePage() {
  const { id } = useParams();
  const { token, currentUser } = useAuth();
  const location = useLocation();
  const isOwnProfile = Boolean(currentUser?.id) && currentUser.id === id;

  // All hooks must run in the same order on every render (rules of hooks),
  // so we declare them BEFORE the self-redirect early return below.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!isOwnProfile);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOwnProfile) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const fresh = await getUserById(id);
        if (!cancelled) setUser(fresh);
      } catch (err) {
        if (!cancelled) {
          const status = err?.response?.status;
          setError(status === 404 ? 'not-found' : 'fetch-failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isOwnProfile]);

  // Viewing your own /users/:id bounces to the editable /profile page.
  // `replace` prevents the back button from re-triggering the redirect.
  if (isOwnProfile) {
    return <Navigate to="/profile" replace />;
  }

  if (loading) {
    return <main className="mx-auto max-w-3xl px-6 py-16 text-sepiaSoft">Loading…</main>;
  }

  if (error === 'not-found') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl text-sepia">We couldn&apos;t find this reader</h1>
        <p className="mt-3 text-sepiaSoft">
          The user you&apos;re looking for either doesn&apos;t exist or has left BookShare.
        </p>
        <Link
          to="/books"
          className="mt-6 inline-block rounded-full bg-bordeaux px-4 py-2 text-ivory no-underline hover:bg-sepia"
        >
          Browse books instead
        </Link>
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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-paper">
          <UserRound className="h-6 w-6 text-sepia" aria-hidden="true" />
        </span>
        <h1 className="font-display text-4xl text-sepia">{user.display_name}</h1>
      </div>
      <p className="mt-2 text-sepiaSoft">A fellow reader on BookShare.</p>

      <section className="mt-8 rounded-lg border border-paper bg-white/70 p-6 shadow-shelf">
        <h2 className="font-display text-lg text-sepia">Contact</h2>
        {isAuthenticated ? (
          <dl className="mt-4 space-y-3 text-sm">
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
          <div className="mt-3 rounded-md border border-dashed border-paper bg-ivory/60 p-4 text-sm text-sepiaSoft">
            <p>Sign in to view contact info.</p>
            <Link
              to="/login"
              state={{ from: location }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-bordeaux px-3 py-1.5 text-ivory no-underline hover:bg-sepia"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in to view contact info
            </Link>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-dashed border-paper bg-ivory/60 p-5">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-bordeaux" aria-hidden="true" />
          <h2 className="font-display text-lg text-sepia">Books listed by this reader</h2>
        </div>
        <p className="mt-2 text-sm text-sepiaSoft">
          No books listed yet — the catalog will show {user.display_name}&apos;s books here when
          they add some.
        </p>
      </section>
    </main>
  );
}

function ContactRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-sepiaSoft">{icon}</span>
      <div>
        <dt className="text-xs uppercase tracking-wide text-sepiaSoft">{label}</dt>
        <dd className="text-ink">
          {value || <span className="italic text-sepiaSoft">(not set)</span>}
        </dd>
      </div>
    </div>
  );
}

export default UserProfilePage;
