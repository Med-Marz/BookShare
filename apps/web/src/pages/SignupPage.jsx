import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display text-4xl text-sepia">Join BookShare</h1>
      <p className="mt-2 text-sepiaSoft">
        Tell us who you are and where to find you, and we&apos;ll open your shelf to the community.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
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

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-bordeaux px-4 py-2.5 font-semibold text-ivory shadow-shelf hover:bg-sepia disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Creating your account…' : 'Create account'}
        </button>

        <p className="text-center text-sm text-sepiaSoft">
          Already on BookShare?{' '}
          <Link to="/login" className="text-bordeaux">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}

function Field({ label, name, help, ...inputProps }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-sepia">{label}</span>
      <input
        name={name}
        className="w-full rounded-md border border-paper bg-white/80 px-3 py-2 text-ink shadow-shelf focus:border-bordeaux focus:outline-none focus:ring-2 focus:ring-bordeaux/30"
        {...inputProps}
      />
      {help && <span className="mt-1 block text-xs text-sepiaSoft">{help}</span>}
    </label>
  );
}

export default SignupPage;
