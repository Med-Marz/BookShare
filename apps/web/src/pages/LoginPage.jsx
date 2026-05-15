import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApolloClient } from '@apollo/client/react';
import { BookOpen, LogIn, Quote } from 'lucide-react';
import { login as loginApi } from '../api/authApi';
import useAuth from '../auth/useAuth';

const INITIAL = { email: '', password: '' };

function LoginPage() {
  const [form, setForm] = useState(INITIAL);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const apollo = useApolloClient();

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
      const { token, user } = await loginApi(form.email, form.password);
      login(token, user);
      await apollo.clearStore().catch(() => {});
      const target = location.state?.from?.pathname || '/';
      navigate(target, { replace: true });
    } catch {
      // Generic message; never echo a server-side reason that could leak whether the email exists.
      setError('Email or password is wrong.');
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
            A book is a dream that you hold in your hand.
          </p>
          <p className="mt-3 text-sm uppercase tracking-[0.18em] text-paper/70">— Neil Gaiman</p>
        </div>

        <p className="text-sm leading-relaxed text-paper/80">
          Pick up where you left off — your shelf, your reservations, and the readers around you.
        </p>

        {/* decorative pattern */}
        <div
          className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-bordeaux/40 blur-3xl"
          aria-hidden="true"
        />
      </aside>

      {/* ── Form panel ── */}
      <section className="flex items-center justify-center bg-cream/60 px-6 py-16 md:rounded-r-2xl md:py-12">
        <div className="w-full max-w-md animate-fade-up">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-paperDark bg-cream px-3 py-1 text-xs uppercase tracking-[0.18em] text-sepiaSoft">
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
            Sign in
          </span>
          <h1 className="mt-4 font-display text-4xl text-sepiaDark md:text-5xl">Welcome back</h1>
          <p className="mt-3 text-sepiaSoft">
            Reach your shelf, your reservations, and the readers waiting for a handoff.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-sepia">Email</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={handleChange}
                className="input-field"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-sepia">Password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={handleChange}
                className="input-field"
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-bordeaux/30 bg-bordeaux/10 px-3 py-2 text-sm text-bordeaux"
              >
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>

            <p className="text-center text-sm text-sepiaSoft">
              New to BookShare?{' '}
              <Link to="/signup" className="font-medium text-bordeaux">
                Create an account
              </Link>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
