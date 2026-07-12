// =============================================================================
// EduDrive — Register Page
// =============================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { UserPlus, Eye, EyeOff, GraduationCap } from 'lucide-react';

export default function RegisterPage() {
  const { register, loginWithGoogle, isFirebaseConfigured } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Le password non corrispondono.');
      return;
    }

    if (password.length < 8) {
      setError('La password deve contenere almeno 8 caratteri.');
      return;
    }

    setLoading(true);

    try {
      await register(email, password, displayName);
      // AuthContext handles redirect via ProtectedRoute
    } catch (err) {
      setError(
        err.response?.data?.error || err.response?.data?.message || 'Registrazione non riuscita. Riprova.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err.message || err.response?.data?.error || 'Registrazione con Google non riuscita. Riprova.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient orbs (kept small to avoid GPU lag) */}
      <div className="absolute top-[-10%] right-[-5%] w-[350px] h-[350px] rounded-full bg-brand-500/10 blur-[60px]" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-brand-700/8 blur-[60px]" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 mb-4 shadow-lg shadow-brand-600/25">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">
            Crea il tuo account
          </h1>
          <p className="text-text-secondary mt-2">
            Unisciti a EduDrive e inizia a collaborare
          </p>
        </div>

        {/* Register Form */}
        <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
              {error}
            </div>
          )}

          {/* Google Sign-In Button */}
          {isFirebaseConfigured && (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-surface-300 bg-surface-50 hover:bg-surface-100 text-text-primary font-medium shadow-sm hover:shadow transition-all disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.3 0 6.08-1.09 8.11-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.23 1.18-3.25 0-6.01-2.19-7-5.14H1.01v3.16C3.06 21.3 7.24 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5 14.03c-.25-.74-.39-1.54-.39-2.03s.14-1.29.39-2.03V6.81H1.01C.37 8.1 0 9.51 0 12s.37 3.9 1.01 5.19l3.99-3.16Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.77c1.8 0 3.41.62 4.68 1.83l3.51-3.51C18.07 1.18 15.3 0 12 0 7.24 0 3.06 2.7 1.01 6.81l3.99 3.16c.99-2.95 3.75-5.2 7-5.2Z"
                  />
                </svg>
                Registrati con Google
              </button>

              <div className="relative flex items-center justify-center my-4">
                <div className="border-t border-surface-200 w-full"></div>
                <span className="bg-surface-50 px-3 text-xs font-semibold text-text-muted uppercase tracking-wider absolute">
                  oppure con email e password
                </span>
              </div>
            </>
          )}

          <div>
            <label htmlFor="register-name" className="block text-sm font-medium text-text-secondary mb-1.5">
              Nome Completo
            </label>
            <input
              id="register-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Mario Rossi"
              required
              minLength={2}
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="register-email" className="block text-sm font-medium text-text-secondary mb-1.5">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="studente@universita.it"
              required
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="register-password" className="block text-sm font-medium text-text-secondary mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 caratteri"
                required
                minLength={8}
                className="input-field pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="register-confirm" className="block text-sm font-medium text-text-secondary mb-1.5">
              Conferma Password
            </label>
            <input
              id="register-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ripeti la password"
              required
              className="input-field"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Crea Account
              </>
            )}
          </button>

          <p className="text-center text-sm text-text-secondary">
            Hai già un account?{' '}
            <Link
              to="/login"
              className="text-brand-600 hover:text-brand-700 font-medium transition-colors"
            >
              Accedi
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
