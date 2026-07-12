// =============================================================================
// EduDrive — Auth Context (React Context API)
// =============================================================================
// Provides authentication state and methods to the entire app.
// Wraps the component tree in <AuthProvider> and use `useAuth()` in components.
//
// State:
//   - user: the current user object or null
//   - loading: true while checking auth status on mount
//
// Methods:
//   - login(email, password)  → authenticate and set user
//   - register(email, password, displayName) → create account and set user
//   - logout() → clear user and tokens
// =============================================================================

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import api, { setAccessToken } from '../services/api.js';
import { auth, googleProvider, isFirebaseConfigured } from '../services/firebase.js';

const AuthContext = createContext(null);

/**
 * Hook to access auth state and methods.
 * Must be used within <AuthProvider>.
 *
 * @returns {{ user, loading, login, register, logout, loginWithGoogle, isFirebaseConfigured }}
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * AuthProvider — wraps the app and manages authentication state.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check redirect login result or try to refresh the token
  useEffect(() => {
    async function checkAuth() {
      try {
        // 1. Controlla prima se torniamo da un redirect di Google Login (o se Firebase ha già una sessione attiva in cache per Tauri/Browser)
        if (isFirebaseConfigured && auth) {
          try {
            await auth.authStateReady(); // Assicura che Firebase abbia ripristinato l'utente da IndexedDB
            const redirectResult = await getRedirectResult(auth).catch(() => null);
            const firebaseUser = redirectResult?.user || auth.currentUser;

            if (firebaseUser) {
              const idToken = await firebaseUser.getIdToken();
              const { data } = await api.post('/auth/google', { idToken });
              setAccessToken(data.accessToken);
              setUser(data.user);
              setLoading(false);
              return;
            }
          } catch (redirectErr) {
            console.warn('Google redirect/auth check:', redirectErr.message);
          }
        }

        // 2. Try refreshing the access token using the httpOnly cookie
        const { data: refreshData } = await api.post('/auth/refresh');
        setAccessToken(refreshData.accessToken);

        // Fetch user profile
        const { data: profileData } = await api.get('/auth/me');
        setUser(profileData.user);
      } catch {
        // Not authenticated — that's ok
        setUser(null);
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  /**
   * Log in with email and password.
   * @param {string} email
   * @param {string} password
   */
  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  /**
   * Register a new student account.
   * @param {string} email
   * @param {string} password
   * @param {string} displayName
   */
  const register = useCallback(async (email, password, displayName) => {
    const { data } = await api.post('/auth/register', {
      email,
      password,
      displayName,
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  /**
   * Log in or register using Google Sign-In (Firebase Auth).
   * Prova prima con Popup nativo; se bloccato (es. in WebView2 di Tauri o browser col blocco), passa al Redirect automatico!
   */
  const loginWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      throw new Error('Autenticazione con Google non configurata (verifica le variabili d\'ambiente VITE_FIREBASE_*).');
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      const { data } = await api.post('/auth/google', { idToken });
      setAccessToken(data.accessToken);
      setUser(data.user);
      return data.user;
    } catch (err) {
      // Se siamo nell'app Desktop nativa (Tauri) o se il browser blocca il popup, facciamo il fallback a signInWithRedirect!
      if (
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/operation-not-supported-in-this-environment' ||
        err.code === 'auth/cancelled-popup-request' ||
        window.__TAURI__ ||
        window.__TAURI_INTERNALS__
      ) {
        await signInWithRedirect(auth, googleProvider);
        return null; // Il browser o WebView reindirizzerà a Google per il login
      }
      throw err;
    }
  }, []);

  /**
   * Log out — clear state and server-side cookie.
   */
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors
    }
    setUser(null);
    setAccessToken(null);
  }, []);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    loginWithGoogle,
    isFirebaseConfigured,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

