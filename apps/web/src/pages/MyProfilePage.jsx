import { useCallback, useEffect, useState } from 'react';
import { BookOpen, BookOpenCheck, CheckCircle2 } from 'lucide-react';
import { getProfile, updateProfile } from '../api/usersApi';
import useAuth from '../auth/useAuth';

const INITIAL = { display_name: '', phone: '', address: '' };

function MyProfilePage() {
  const { token, login } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(INITIAL);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch fresh on mount — never trust localStorage for the source of truth.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fresh = await getProfile();
        if (!cancelled) {
          setProfile(fresh);
          setForm({
            display_name: fresh.display_name || '',
            phone: fresh.phone || '',
            address: fresh.address || '',
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error?.message || 'Could not load your profile.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-dismiss the success pill after 3 seconds.
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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!profile) return;

    // Build patch with only the fields that actually changed.
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
      // Refresh AuthContext so the navbar reflects the new display name.
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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl text-sepia">My profile</h1>
      <p className="mt-2 text-sepiaSoft">
        Keep your contact details current so other readers can reach you for handoffs.
      </p>

      {/* ---- Editable profile card ---- */}
      <section className="mt-8 rounded-lg border border-paper bg-white/70 p-6 shadow-shelf">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-sepia">Email</span>
            <input
              type="email"
              value={profile.email}
              readOnly
              disabled
              className="w-full cursor-not-allowed rounded-md border border-paper bg-paper/30 px-3 py-2 text-sepiaSoft"
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

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-bordeaux px-4 py-2 font-semibold text-ivory shadow-shelf hover:bg-sepia disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Update profile'}
          </button>
        </form>
      </section>

      {/* ---- Empty-state cards for upcoming features ---- */}
      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <EmptyCard
          icon={<BookOpen className="h-5 w-5 text-bordeaux" aria-hidden="true" />}
          title="Books you've listed"
          copy="Lands in epic 2 — add a book with a cover image and watch it appear here."
        />
        <EmptyCard
          icon={<BookOpenCheck className="h-5 w-5 text-bordeaux" aria-hidden="true" />}
          title="Your reservations"
          copy="Lands in epic 4 — reserve a book and the activity will show up here."
        />
      </section>
    </main>
  );
}

function Field({ label, name, type = 'text', value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-sepia">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        className="w-full rounded-md border border-paper bg-white/80 px-3 py-2 text-ink shadow-shelf focus:border-bordeaux focus:outline-none focus:ring-2 focus:ring-bordeaux/30"
      />
    </label>
  );
}

function EmptyCard({ icon, title, copy }) {
  return (
    <div className="rounded-lg border border-dashed border-paper bg-ivory/60 p-5">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-display text-lg text-sepia">{title}</h2>
      </div>
      <p className="mt-2 text-sm text-sepiaSoft">{copy}</p>
    </div>
  );
}

export default MyProfilePage;
