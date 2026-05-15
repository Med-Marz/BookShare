import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, BookOpenCheck, CheckCircle2, Mail, PlusCircle } from 'lucide-react';
import { getProfile, updateProfile } from '../api/usersApi';
import { listBooksByOwner } from '../api/booksApi';
import BookCard from '../components/BookCard.jsx';
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

  // Fetch fresh on mount — never trust localStorage for the source of truth.
  // Also fan out to the books endpoint once we know the user id.
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
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error?.message || 'Could not load your profile.');
          setBooksLoading(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

      {/* ── Empty state for upcoming features ── */}
      <section className="mt-10">
        <EmptyCard
          icon={<BookOpenCheck className="h-5 w-5 text-bordeaux" aria-hidden="true" />}
          title="Your reservations"
          copy="When you reserve a book, the title and the owner's contact info show up here until the loan is closed."
        />
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

function EmptyCard({ icon, title, copy }) {
  return (
    <div className="rounded-2xl border border-dashed border-paperDark bg-ivory/70 p-6">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-cream">
          {icon}
        </span>
        <h2 className="font-display text-lg text-sepiaDark">{title}</h2>
      </div>
      <p className="mt-3 text-sm text-sepiaSoft">{copy}</p>
    </div>
  );
}

export default MyProfilePage;
