import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  CheckCircle2,
  Handshake,
  Mail,
  MapPin,
  Phone,
  PlusCircle,
} from 'lucide-react';
import { getProfile, updateProfile } from '../api/usersApi';
import { listBooksByOwner } from '../api/booksApi';
import {
  listMyReservations,
  listOwnedReservations,
  markReturned,
  startLoan,
} from '../api/reservationsApi';
import BookCard from '../components/BookCard.jsx';
import MyReservationCard from '../components/MyReservationCard.jsx';
import { badgeClassFor, formatStateTimestamp, labelFor } from '../utils/reservationStatus';
import { coverUrl } from '../api/covers';
import { formatYear } from '../utils/formatYear';
import useAuth from '../auth/useAuth';

const INITIAL = { display_name: '', phone: '', address: '' };

function initialsFrom(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function MyProfilePage() {
  const { token, login } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(INITIAL);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [books, setBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [myReservations, setMyReservations] = useState([]);
  const [ownedReservations, setOwnedReservations] = useState([]);
  const [reservationsLoading, setReservationsLoading] = useState(true);

  const refetchReservations = useCallback(async () => {
    try {
      const [mine, owned] = await Promise.all([
        listMyReservations().catch(() => []),
        listOwnedReservations().catch(() => []),
      ]);
      setMyReservations(mine || []);
      setOwnedReservations(owned || []);
    } finally {
      setReservationsLoading(false);
    }
  }, []);

  // Fetch fresh on mount — never trust localStorage for the source of truth.
  // Also fan out to the books endpoint once we know the user id, and load
  // both reservation lists (borrower-side + owner-side) in parallel.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fresh = await getProfile();
        if (cancelled) return;
        setProfile(fresh);
        setForm({
          display_name: fresh.display_name || '',
          phone: fresh.phone || '',
          address: fresh.address || '',
        });
        // Kick off the books fetch independently — empty list is a valid state.
        try {
          const list = await listBooksByOwner(fresh.id);
          if (!cancelled) setBooks(list);
        } catch {
          if (!cancelled) setBooks([]);
        } finally {
          if (!cancelled) setBooksLoading(false);
        }
        if (!cancelled) await refetchReservations();
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error?.message || 'Could not load your profile.');
          setBooksLoading(false);
          setReservationsLoading(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refetchReservations]);

  useEffect(() => {
    if (!success) return;
    const id = setTimeout(() => setSuccess(false), 3000);
    return () => clearTimeout(id);
  }, [success]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  }, []);

  const initials = useMemo(() => initialsFrom(profile?.display_name), [profile?.display_name]);

  const myActive = useMemo(
    () =>
      myReservations
        .filter((r) => r.state === 'Active' || r.state === 'LoanStarted')
        .slice(0, 3),
    [myReservations],
  );
  const ownedActive = useMemo(
    () =>
      ownedReservations.filter(
        (r) => r.state === 'Active' || r.state === 'LoanStarted',
      ),
    [ownedReservations],
  );
  const ownedHistory = useMemo(
    () =>
      ownedReservations.filter(
        (r) => r.state === 'Cancelled' || r.state === 'Completed',
      ),
    [ownedReservations],
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!profile) return;

    const patch = {};
    if (form.display_name.trim() && form.display_name !== profile.display_name) {
      patch.display_name = form.display_name.trim();
    }
    if (form.phone.trim() && form.phone !== profile.phone) {
      patch.phone = form.phone.trim();
    }
    if (form.address.trim() && form.address !== profile.address) {
      patch.address = form.address.trim();
    }

    if (Object.keys(patch).length === 0) {
      setError('Nothing has changed.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await updateProfile(patch);
      setProfile(updated);
      setForm({
        display_name: updated.display_name,
        phone: updated.phone,
        address: updated.address,
      });
      setSuccess(true);
      if (token) login(token, updated);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-sepiaSoft">Loading your profile…</main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p
          role="alert"
          className="rounded-md border border-bordeaux/30 bg-bordeaux/10 px-3 py-2 text-sm text-bordeaux"
        >
          {error || 'Could not load your profile.'}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 animate-fade-up">
      {/* ── Profile hero ── */}
      <section className="card-surface flex flex-col items-start gap-5 p-7 sm:flex-row sm:items-center">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-panel-warmth font-display text-2xl text-ivory shadow-shelf">
          {initials}
        </span>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.18em] text-sepiaSoft">My profile</p>
          <h1 className="mt-1 font-display text-3xl text-sepiaDark sm:text-4xl">
            {profile.display_name}
          </h1>
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-sepiaSoft">
            <Mail className="h-4 w-4" aria-hidden="true" />
            {profile.email}
          </p>
        </div>
      </section>

      <p className="mt-6 text-sepiaSoft">
        Keep your contact details current so other readers can reach you for handoffs.
      </p>

      {/* ── Editable profile form ── */}
      <section className="card-surface mt-6 p-7">
        <h2 className="font-display text-xl text-sepiaDark">Account details</h2>
        <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-sepia">Email</span>
            <input
              type="email"
              value={profile.email}
              readOnly
              disabled
              className="w-full cursor-not-allowed rounded-md border border-paperDark bg-paper/40 px-3 py-2.5 text-sepiaSoft"
            />
            <span className="mt-1 block text-xs text-sepiaSoft">
              Email is permanent and cannot be changed.
            </span>
          </label>

          <Field
            label="Display name"
            name="display_name"
            value={form.display_name}
            onChange={handleChange}
          />
          <Field label="Phone" name="phone" type="tel" value={form.phone} onChange={handleChange} />
          <Field
            label="Postal address"
            name="address"
            value={form.address}
            onChange={handleChange}
          />

          {error && (
            <p
              role="alert"
              className="rounded-md border border-bordeaux/30 bg-bordeaux/10 px-3 py-2 text-sm text-bordeaux"
            >
              {error}
            </p>
          )}
          {success && (
            <p
              role="status"
              className="inline-flex items-center gap-1.5 rounded-md border border-forest/30 bg-forest/10 px-3 py-2 text-sm text-forest"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Profile updated
            </p>
          )}

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Update profile'}
          </button>
        </form>
      </section>

      {/* ── Books you've listed ── */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-sepiaDark">Books you've listed</h2>
          {books.length > 0 && (
            <Link to="/books/new" className="btn-ghost no-underline">
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              Add another
            </Link>
          )}
        </div>

        {booksLoading ? (
          <p className="mt-4 text-sepiaSoft">Loading your books…</p>
        ) : books.length > 0 ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {books.map((b) => (
              <BookCard key={b.id} book={b} showStatus />
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
              Add a book from your shelf and other readers will be able to reserve it.
            </p>
            <Link to="/books/new" className="btn-primary mt-4 no-underline">
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              Add your first book
            </Link>
          </div>
        )}
      </section>

      {/* ── Your reservations (compact top-3) ── */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-bordeaux" aria-hidden="true" />
            <h2 className="font-display text-2xl text-sepiaDark">Your reservations</h2>
          </div>
          {myActive.length > 0 && (
            <Link to="/reservations" className="text-sm text-sepiaSoft no-underline hover:text-bordeaux">
              View all
              <ArrowRight className="ml-1 inline h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
        {reservationsLoading ? (
          <p className="mt-3 text-sepiaSoft">Loading…</p>
        ) : myActive.length > 0 ? (
          <div className="mt-4 space-y-3">
            {myActive.map((r) => (
              <MyReservationCard key={r.id} reservation={r} variant="compact" />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-paperDark bg-ivory/70 p-6">
            <p className="text-sm text-sepiaSoft">
              You haven't reserved any books yet.
            </p>
            <Link to="/books" className="btn-ghost mt-3 no-underline">
              Browse the catalog
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

      {/* ── Reservations on my books (owner view) ── */}
      <section className="mt-10">
        <div className="flex items-center gap-2">
          <Handshake className="h-5 w-5 text-bordeaux" aria-hidden="true" />
          <h2 className="font-display text-2xl text-sepiaDark">Reservations on my books</h2>
        </div>
        {reservationsLoading ? (
          <p className="mt-3 text-sepiaSoft">Loading…</p>
        ) : ownedActive.length > 0 ? (
          <div className="mt-4 space-y-4">
            {ownedActive.map((r) => (
              <OwnerReservationCard
                key={r.id}
                reservation={r}
                onChanged={refetchReservations}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-paperDark bg-ivory/70 p-6">
            <p className="text-sm text-sepiaSoft">No one has reserved your books yet.</p>
          </div>
        )}

        {ownedHistory.length > 0 && (
          <OwnerHistoryToggle entries={ownedHistory} />
        )}
      </section>
    </main>
  );
}

function Field({ label, name, type = 'text', value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-sepia">{label}</span>
      <input name={name} type={type} value={value} onChange={onChange} className="input-field" />
    </label>
  );
}

// Owner-side card: shows the borrower's contact info + the action buttons
// that drive the reservation forward. Two-step inline confirm matches the
// rest of the app.
function OwnerReservationCard({ reservation, onChanged }) {
  const { book, borrower, state } = reservation;
  const [pending, setPending] = useState(null); // 'start' | 'return' | null
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  async function runAction(actionFn, kind) {
    setWorking(true);
    setError(null);
    try {
      await actionFn(reservation.id);
      setPending(null);
      if (onChanged) await onChanged();
    } catch (err) {
      const code = err?.response?.data?.error?.code;
      if (code === 'FAILED_PRECONDITION') {
        setError('The reservation has already moved on. Refreshing…');
        if (onChanged) await onChanged();
      } else {
        setError(
          err?.response?.data?.error?.message ||
            (kind === 'start'
              ? 'Could not mark loan started.'
              : 'Could not mark book returned.'),
        );
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <article className="card-surface flex gap-4 p-4">
      <Link
        to={book?.id ? `/books/${book.id}` : '#'}
        className="h-32 w-24 shrink-0 overflow-hidden rounded-md no-underline sm:h-40 sm:w-28"
        aria-label={`Open ${book?.title || 'book'}`}
      >
        {book?.cover_object_key ? (
          <img
            src={coverUrl(book.cover_object_key)}
            alt={`${book.title || 'Unknown'} cover`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-paperDark/30 text-xs text-sepiaSoft">
            No cover
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <Link
              to={book?.id ? `/books/${book.id}` : '#'}
              className="font-display text-lg text-sepiaDark no-underline hover:text-bordeaux"
            >
              {book?.title || 'Unknown book'}
            </Link>
            {book?.author && (
              <p className="text-sm text-sepiaSoft">
                {book.author}
                {book.year_published ? ` · ${formatYear(book.year_published)}` : ''}
              </p>
            )}
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClassFor(state)}`}
          >
            {labelFor(state)}
          </span>
        </div>

        <p className="text-xs text-sepiaSoft">{formatStateTimestamp(reservation)}</p>

        {borrower && (
          <div className="mt-2 rounded-md border border-paper bg-paper/40 p-3 text-sm">
            <p className="font-medium text-sepiaDark">
              Reserved by {borrower.display_name || 'Unknown reader'}
            </p>
            {borrower.email && (
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-sepiaSoft">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                <a href={`mailto:${borrower.email}`} className="text-sepia no-underline hover:text-bordeaux">
                  {borrower.email}
                </a>
              </p>
            )}
            {borrower.phone && (
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-sepiaSoft">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-sepia">{borrower.phone}</span>
              </p>
            )}
            {borrower.address && (
              <p className="mt-0.5 inline-flex items-start gap-1.5 text-sepiaSoft">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="text-sepia">{borrower.address}</span>
              </p>
            )}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {state === 'Active' && (
            pending === 'start' ? (
              <>
                <span className="text-xs text-sepiaSoft">Confirm: mark loan as started?</span>
                <button
                  type="button"
                  onClick={() => runAction(startLoan, 'start')}
                  disabled={working}
                  className="btn-primary"
                >
                  {working ? 'Working…' : 'Yes, start loan'}
                </button>
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  disabled={working}
                  className="btn-ghost"
                >
                  Not yet
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setPending('start');
                }}
                className="btn-primary"
              >
                Mark loan started
              </button>
            )
          )}
          {state === 'LoanStarted' && (
            pending === 'return' ? (
              <>
                <span className="text-xs text-sepiaSoft">Confirm: mark book as returned?</span>
                <button
                  type="button"
                  onClick={() => runAction(markReturned, 'return')}
                  disabled={working}
                  className="btn-primary"
                >
                  {working ? 'Working…' : 'Yes, mark returned'}
                </button>
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  disabled={working}
                  className="btn-ghost"
                >
                  Not yet
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setPending('return');
                }}
                className="btn-primary"
              >
                Mark returned
              </button>
            )
          )}
        </div>

        {error && (
          <p role="alert" className="mt-1 text-xs text-bordeaux">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}

function OwnerHistoryToggle({ entries }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost"
      >
        {open ? 'Hide history' : `Show history (${entries.length})`}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {entries.map((r) => (
            <article key={r.id} className="card-surface flex items-center gap-3 p-3">
              <div className="h-14 w-10 shrink-0 overflow-hidden rounded">
                {r.book?.cover_object_key ? (
                  <img
                    src={coverUrl(r.book.cover_object_key)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-paperDark/30" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sepiaDark">{r.book?.title || 'Unknown book'}</p>
                <p className="text-xs text-sepiaSoft">
                  {r.borrower?.display_name ? `Reserved by ${r.borrower.display_name} · ` : ''}
                  {formatStateTimestamp(r)}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClassFor(r.state)}`}
              >
                {labelFor(r.state)}
              </span>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyProfilePage;
