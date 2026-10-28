import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function Field({ label, ...props }) {
  return (
    <label className="block text-sm font-medium text-brand-700">
      {label}
      <input className="input mt-1" {...props} />
    </label>
  );
}

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { user, isAdmin, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Admins land on the dashboard unless they were sent here from a specific page.
  const redirectTo = location.state?.from || (isAdmin ? '/admin' : '/');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={redirectTo} replace />;

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isRegister) await register(form);
      else await login(form.email, form.password);
      // Signing in sets the user, which re-renders this page and redirects through the <Navigate> above.
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-4 max-w-md sm:mt-10">
      <form onSubmit={submit} className="panel space-y-4 sm:p-8">
        <h1 className="text-3xl">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="text-sm text-brand-500">{isRegister ? 'Save your orders and check out faster.' : 'Sign in to check out and see your orders.'}</p>
        {isRegister && <Field label="Name" required value={form.name} onChange={set('name')} autoComplete="name" maxLength={80} />}
        <Field label="Email" type="email" required value={form.email} onChange={set('email')} autoComplete="email" />
        <Field
          label="Password"
          type="password"
          required
          value={form.password}
          onChange={set('password')}
          minLength={isRegister ? 8 : undefined}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
        />
        {isRegister && <p className="-mt-2 text-xs text-brand-500">At least 8 characters.</p>}
        {error && <p className=" bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
        <button className="btn w-full py-3.5" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</button>
        <p className="text-center text-sm text-brand-600">
          {isRegister ? 'Already have an account?' : 'New to Threads?'}{' '}
          <Link to={isRegister ? '/login' : '/register'} state={location.state} className="font-medium text-brand-950 underline">
            {isRegister ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </form>
    </div>
  );
}
