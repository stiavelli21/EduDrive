// =============================================================================
// EduDrive — Register Page (Esclusivamente Google Auth)
// =============================================================================

import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { GraduationCap, ShieldCheck } from 'lucide-react';

export default function RegisterPage() {
  const { loginWithGoogle, isFirebaseConfigured } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      {/* Background gradient orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-[350px] h-[350px] rounded-full bg-brand-500/10 blur-[60px]" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-brand-700/8 blur-[60px]" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 mb-4 shadow-lg shadow-brand-600/25">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">
            Unisciti a EduDrive
          </h1>
          <p className="text-text-secondary mt-2">
            Inizia a collaborare e condividere file con un click
          </p>
        </div>

        {/* Google Register Card */}
        <div className="glass-card p-8 space-y-6 text-center">
          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm text-left">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-text-primary">
              Crea o Accedi al tuo Account
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Il tuo account EduDrive viene creato e protetto automaticamente al primo accesso con Google.
            </p>
          </div>

          {isFirebaseConfigured ? (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium shadow-md shadow-brand-600/20 hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
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
                  <span>Registrati con Google</span>
                </>
              )}
            </button>
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm">
              Configurazione Firebase assente. Imposta le variabili d'ambiente VITE_FIREBASE_* per abilitare l'accesso con Google.
            </div>
          )}

          <div className="pt-4 border-t border-surface-200 flex items-center justify-center gap-2 text-xs text-text-muted">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            <span>Autenticazione protetta e gestita da Google</span>
          </div>
        </div>
      </div>
    </div>
  );
}
