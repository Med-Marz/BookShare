import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Quote, UserPlus } from 'lucide-react';
import { signup as signupApi } from '../api/authApi';
import useAuth from '../auth/useAuth';

const INITIAL = {
  display_name: '',
  email: '',
  password: '',
  phone: '',
  address: '',
};

function SignupPage() {
  const [form, setForm] = useState(INITIAL);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { token, user } = await signupApi(form);
      login(token, user);
      navigate('/');
    } catch (err) {
      const envelope = err?.response?.data?.error;
      setError(envelope?.message || 'Sign up failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-stretch gap-0 px-0 md:grid-cols-2 md:px-6 md:py-12">
      {/* ── Brand panel ── */}
      <aside className="relative hidden overflow-hidden bg-panel-warmth text-ivory md:flex md:flex-col md:justify-between md:rounded-l-2xl md:p-12">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ivory text-bordeauxDeep">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-display text-2xl text-ivory">BookShare</span>
        </div>

        <div>
          <Quote className="h-8 w-8 text-paper/70" aria-hidden="true" />
          <p className="mt-4 font-display text-3xl leading-snug text-ivory">
            We read to know we are not alone.
          </p>
          <p className="mt-3 text-sm uppercase tracking-[0.18em] text-paper/70">— C. S. Lewis</p>
        </div>

        <ul className="space-y-3 text-sm text-paper/80">
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
            Share the books you&apos;ve already read.
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
            Reserve titles from readers nearby.
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
            Arrange in-person or postal handoffs.
          </li>
        </ul>

        <div
          className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-bordeaux/40 blur-3xl"
          aria-hidden="true"
        />
      </aside>

      {/* ── Form panel ── */}
      <section className="flex items-start justify-center bg-cream/60 px-6 py-12 md:rounded-r-2xl md:py-12">
        <div className="w-full max-w-md animate-fade-up">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-paperDark bg-cream px-3 py-1 text-xs uppercase tracking-[0.18em] text-sepiaSoft">
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Create account
          </span>
          <h1 className="mt-4 font-display text-4xl text-sepiaDark md:text-5xl">
            Join BookShare
          </h1>
          <p className="mt-3 text-sepiaSoft">
            Tell us who you are and how to reach you, and we&apos;ll open your shelf to the
            community.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <Field
              label="Display name"
              name="display_name"
              value={form.display_name}
              onChange={handleChange}
              required
              autoComplete="name"
            />
            <Field
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
            <Field
              label="Password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={8}
              autoComplete="new-password"
              help="At least 8 characters."
            />
            <Field
              label="Phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              required
              autoComplete="tel"
            />
            <Field
              label="Postal address"
              name="address"
              value={form.address}
              onChange={handleChange}
              required
              autoComplete="street-address"
            />

            {error && (
              <p
                role="alert"
                className="rounded-md border border-bordeaux/30 bg-bordeaux/10 px-3 py-2 text-sm text-bordeaux"
              >
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Creating your account…' : 'Create account'}
            </button>

            <p className="text-center text-sm text-sepiaSoft">
              Already on BookShare?{' '}
              <Link to="/login" className="font-medium text-bordeaux">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

function Field({ label, name, help, ...inputProps }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-sepia">{label}</span>
      <input name={name} className="input-field" {...inputProps} />
      {help && <span className="mt-1 block text-xs text-sepiaSoft">{help}</span>}
    </label>
  );
}

export default SignupPage;
