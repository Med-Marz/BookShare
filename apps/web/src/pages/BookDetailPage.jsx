import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  LogIn,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  UploadCloud,
  UserRound,
  X,
} from 'lucide-react';
import { coverUrl } from '../api/covers';
import { deleteBook, editBook, getBook, replaceCover } from '../api/booksApi';
import { formatYear } from '../utils/formatYear';
import useAuth from '../auth/useAuth';

const ALLOWED_COVER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const STATUS_STYLES = {
  Available: 'border-forest/30 bg-forest/10 text-forest',
  Reserved: 'border-bordeaux/30 bg-bordeaux/10 text-bordeaux',
  'Lent Out': 'border-sepiaSoft/30 bg-sepiaSoft/10 text-sepiaSoft',
};

function BookDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token, currentUser } = useAuth();
  const isAuthenticated = Boolean(token);

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [owner, setOwner] = useState(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', author: '', year_published: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  const fileInputRef = useRef(null);
  const [replacing, setReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  async function handleDelete() {
    if (!book) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteBook(book.id);
      navigate('/profile', { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.error?.code;
      let message;
      if (status === 409 && code === 'FAILED_PRECONDITION') {
        message =
          "This book is currently reserved or lent out — it can't be deleted until the loan is closed.";
      } else {
        message = err?.response?.data?.error?.message || 'Could not delete this book.';
      }
      setDeleteError(message);
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleCoverChange(e) {
    const file = e.target.files?.[0];
    // Reset so the same filename can be re-selected later if needed.
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_COVER_TYPES.has(file.type)) {
      setReplaceError('Cover must be a JPEG, PNG, or WEBP image.');
      return;
    }
    setReplacing(true);
    setReplaceError(null);
    try {
      const updated = await replaceCover(book.id, file);
      setBook(updated);
      setSaved(true);
    } catch (err) {
      const message =
        err?.response?.data?.error?.message || 'Could not replace the cover.';
      setReplaceError(message);
    } finally {
      setReplacing(false);
    }
  }

  // Fetch the book and the owner's public profile. We use REST instead of
  // GraphQL on purpose — REST returns the book in a single round-trip, and
  // the owner endpoint (/users/:id) already implements the same anonymous
  // contact-info gate.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const fresh = await getBook(id);
        if (cancelled) return;
        setBook(fresh);
        setForm({
          title: fresh.title,
          author: fresh.author,
          year_published: String(fresh.year_published),
        });
        // Fetch owner separately — REST users/:id is auth-aware via the same
        // optionalAuth middleware that gates contact fields.
        try {
          const res = await fetch(
            `${import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000'}/api/v1/users/${fresh.owner_id}`,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            },
          );
          if (res.ok && !cancelled) setOwner(await res.json());
        } catch {
          // owner load failure is non-fatal; the book is still readable
        }
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
  }, [id, token]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(t);
  }, [saved]);

  function handleEditOpen() {
    setSaveError(null);
    setEditing(true);
  }

  function handleEditCancel() {
    setEditing(false);
    setSaveError(null);
    if (book) {
      setForm({
        title: book.title,
        author: book.author,
        year_published: String(book.year_published),
      });
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (saveError) setSaveError(null);
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!book) return;

    // Build a patch with only the fields that actually changed.
    const patch = {};
    if (form.title.trim() && form.title.trim() !== book.title) patch.title = form.title.trim();
    if (form.author.trim() && form.author.trim() !== book.author) patch.author = form.author.trim();
    const year = Number.parseInt(form.year_published, 10);
    if (Number.isInteger(year) && year !== book.year_published) patch.year_published = year;

    if (Object.keys(patch).length === 0) {
      setSaveError('Nothing has changed.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const updated = await editBook(book.id, patch);
      setBook(updated);
      setForm({
        title: updated.title,
        author: updated.author,
        year_published: String(updated.year_published),
      });
      setEditing(false);
      setSaved(true);
    } catch (err) {
      const message =
        err?.response?.data?.error?.message || 'Could not save your changes. Please try again.';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-4xl px-6 py-16 text-sepiaSoft">Loading…</main>;
  }

  if (error === 'not-found') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="card-surface flex flex-col items-center gap-4 p-10 text-center">
          <h1 className="font-display text-3xl text-sepiaDark">We couldn&apos;t find this book</h1>
          <p className="text-sepiaSoft">
            The book you&apos;re looking for either doesn&apos;t exist or has been removed.
          </p>
          <Link to="/books" className="btn-primary no-underline">
            Browse books instead
          </Link>
        </div>
      </main>
    );
  }

  if (error || !book) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p
          role="alert"
          className="rounded-md border border-bordeaux/30 bg-bordeaux/10 px-3 py-2 text-sm text-bordeaux"
        >
          Could not load this book. Please try again later.
        </p>
      </main>
    );
  }

  const statusClass = STATUS_STYLES[book.status] || STATUS_STYLES.Available;
  const isOwner = isAuthenticated && currentUser?.id === book.owner_id;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 animate-fade-up">
      <Link
        to="/books"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-sepiaSoft no-underline hover:text-bordeaux"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to books
      </Link>

      <div className="grid gap-10 md:grid-cols-[minmax(0,18rem)_1fr]">
        {/* Cover */}
        <div className="w-full max-w-xs">
          <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-paper shadow-card">
            <img
              src={coverUrl(book.cover_object_key)}
              alt={`${book.title} by ${book.author}`}
              className="h-full w-full object-cover"
            />
          </div>
          {isOwner && (
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={replacing}
                className="btn-ghost w-full !py-2 !text-sm"
              >
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                {replacing ? 'Replacing…' : 'Replace cover'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleCoverChange}
                className="sr-only"
              />
              {replaceError && (
                <p
                  role="alert"
                  className="rounded-md border border-bordeaux/30 bg-bordeaux/10 px-3 py-2 text-xs text-bordeaux"
                >
                  {replaceError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-4xl text-sepiaDark md:text-5xl">{book.title}</h1>
              <p className="mt-2 text-lg text-sepiaSoft">
                {book.author} · {formatYear(book.year_published)}
              </p>
            </div>
            <span
              className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-sm font-medium ${statusClass}`}
            >
              {book.status}
            </span>
          </div>

          {isOwner && !editing && (
            <button
              type="button"
              onClick={handleEditOpen}
              className="btn-ghost mt-6 no-underline"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit details
            </button>
          )}

          {saved && (
            <p
              role="status"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-forest/30 bg-forest/10 px-3 py-2 text-sm text-forest"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Saved
            </p>
          )}

          {editing && (
            <form onSubmit={handleEditSubmit} className="card-surface mt-6 space-y-5 p-6" noValidate>
              <h2 className="font-display text-xl text-sepiaDark">Edit book details</h2>
              <Field label="Title" name="title" value={form.title} onChange={handleChange} />
              <Field label="Author" name="author" value={form.author} onChange={handleChange} />
              <Field
                label="Year published"
                name="year_published"
                type="number"
                min="1000"
                max="9999"
                value={form.year_published}
                onChange={handleChange}
              />

              {saveError && (
                <p
                  role="alert"
                  className="rounded-md border border-bordeaux/30 bg-bordeaux/10 px-3 py-2 text-sm text-bordeaux"
                >
                  {saveError}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={handleEditCancel}
                  className="inline-flex items-center gap-1.5 text-sm text-sepiaSoft hover:text-bordeaux"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Delete book — owner only, two-step inline confirmation */}
          {isOwner && !editing && (
            <div className="mt-6">
              {!confirmingDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(true);
                    setDeleteError(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-sm text-bordeaux hover:text-bordeauxDeep"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete book
                </button>
              ) : (
                <div className="card-surface space-y-4 border-bordeaux/30 p-5">
                  <div className="flex items-start gap-3">
                    <Trash2 className="mt-0.5 h-5 w-5 text-bordeaux" aria-hidden="true" />
                    <div>
                      <h3 className="font-display text-lg text-sepiaDark">
                        Permanently delete this book?
                      </h3>
                      <p className="mt-1 text-sm text-sepiaSoft">
                        The book and its cover image will be removed. This can&apos;t be
                        undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="btn-primary"
                    >
                      {deleting ? 'Deleting…' : 'Confirm delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingDelete(false);
                        setDeleteError(null);
                      }}
                      className="inline-flex items-center gap-1.5 text-sm text-sepiaSoft hover:text-bordeaux"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {deleteError && (
                <p
                  role="alert"
                  className="mt-3 rounded-md border border-bordeaux/30 bg-bordeaux/10 px-3 py-2 text-sm text-bordeaux"
                >
                  {deleteError}
                </p>
              )}
            </div>
          )}

          {/* Reserve CTA — visible to non-owners only when status is Available */}
          {!isOwner && book.status === 'Available' && !editing && (
            <div className="mt-6">
              {isAuthenticated ? (
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Reservations come online with the loan lifecycle."
                  className="btn-primary"
                >
                  <Bookmark className="h-4 w-4" aria-hidden="true" />
                  Reserve this book
                </button>
              ) : (
                <Link
                  to="/login"
                  state={{ from: location }}
                  className="btn-primary no-underline"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Sign in to reserve this book
                </Link>
              )}
            </div>
          )}

          {/* Owner card */}
          <section className="card-surface mt-8 p-6">
            <h2 className="font-display text-xl text-sepiaDark">Owner</h2>
            <div className="mt-4 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-paper text-sepia">
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </span>
              <Link
                to={`/users/${book.owner_id}`}
                className="font-medium text-sepiaDark no-underline hover:text-bordeaux"
              >
                {owner?.display_name || 'A fellow reader'}
              </Link>
            </div>

            {isAuthenticated ? (
              <dl className="mt-5 space-y-3 text-sm">
                {owner?.email && (
                  <ContactRow
                    icon={<Mail className="h-4 w-4" aria-hidden="true" />}
                    label="Email"
                    value={owner.email}
                  />
                )}
                {owner?.phone && (
                  <ContactRow
                    icon={<Phone className="h-4 w-4" aria-hidden="true" />}
                    label="Phone"
                    value={owner.phone}
                  />
                )}
                {owner?.address && (
                  <ContactRow
                    icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
                    label="Address"
                    value={owner.address}
                  />
                )}
              </dl>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-paperDark bg-ivory/70 p-5 text-sm text-sepiaSoft">
                <p>Sign in to see contact info for this owner.</p>
                <Link
                  to="/login"
                  state={{ from: location }}
                  className="btn-primary mt-4 no-underline"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Sign in to see contact info
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({ label, name, type = 'text', value, onChange, ...rest }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-sepia">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        className="input-field"
        {...rest}
      />
    </label>
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
        <dd className="text-ink">{value}</dd>
      </div>
    </div>
  );
}

export default BookDetailPage;
