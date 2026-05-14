import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApolloClient } from '@apollo/client/react';
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
      // Clear any cached anonymous query results so they don't bleed into the
      // authenticated session.
      await apollo.clearStore().catch(() => {});
      const target = location.state?.from?.pathname || '/';
      navigate(target, { replace: true });
    } catch {
      // Always show the generic message regardless of what the server returned —
      // never echo a server-side reason that could leak whether the email exists.
      setError('Email or password is wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display text-4xl text-sepia">Welcome back</h1>
      <p className="mt-2 text-sepiaSoft">Sign in to reach your shelf and your reservations.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-sepia">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={handleChange}
            className="w-full rounded-md border border-paper bg-white/80 px-3 py-2 text-ink shadow-shelf focus:border-bordeaux focus:outline-none focus:ring-2 focus:ring-bordeaux/30"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-sepia">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={handleChange}
            className="w-full rounded-md border border-paper bg-white/80 px-3 py-2 text-ink shadow-shelf focus:border-bordeaux focus:outline-none focus:ring-2 focus:ring-bordeaux/30"
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

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-bordeaux px-4 py-2.5 font-semibold text-ivory shadow-shelf hover:bg-sepia disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-center text-sm text-sepiaSoft">
          New to BookShare?{' '}
          <Link to="/signup" className="text-bordeaux">
            Create an account
          </Link>
        </p>
      </form>
    </main>
  );
}

export default LoginPage;
