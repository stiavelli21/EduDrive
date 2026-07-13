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

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged } from 'firebase/auth';
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

  // Ref flag to prevent the onAuthStateChanged listener and checkAuth refresh
  // from racing with an active loginWithGoogle popup/redirect flow.
  const googleLoginInProgressRef = useRef(false);

  // On mount, check redirect login result or try to refresh the token
  useEffect(() => {
    let unsubscribe = () => { };

    async function checkAuth() {
      try {
        // 1. Listen for Firebase restoring a session or returning from a redirect (Tauri/Browser)
        if (isFirebaseConfigured && auth) {
          unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            // Skip if loginWithGoogle is actively handling the flow
            if (googleLoginInProgressRef.current) return;

            if (firebaseUser) {
              try {
                const idToken = await firebaseUser.getIdToken();
                const { data } = await api.post('/auth/google', { idToken });
                setAccessToken(data.accessToken);
                setUser(data.user);
                setLoading(false);
              } catch (apiErr) {
                console.error('Errore login Google sul backend:', apiErr.message);
              }
            }
          });

          // Also proactively check redirect result or authStateReady
          try {
            await auth.authStateReady();
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
        // Not authenticated — only reset if loginWithGoogle isn't in progress
        if (!googleLoginInProgressRef.current) {
          setUser(null);
          setAccessToken(null);
        }
      } finally {
        setLoading(false);
      }
    }

    checkAuth();

    return () => unsubscribe();
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
   * Sets a ref flag to prevent onAuthStateChanged from racing with this flow.
   * Tries popup first; falls back to redirect in Tauri/WebView2 or if popup is blocked.
   */
  const loginWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      throw new Error('Autenticazione con Google non configurata (verifica le variabili d\'ambiente VITE_FIREBASE_*).');
    }

    googleLoginInProgressRef.current = true;
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      const { data } = await api.post('/auth/google', { idToken });
      setAccessToken(data.accessToken);
      setUser(data.user);
      return data.user;
    } catch (err) {
      // If in native Desktop app (Tauri) or browser blocks popup, fallback to signInWithRedirect
      if (
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/operation-not-supported-in-this-environment' ||
        err.code === 'auth/cancelled-popup-request' ||
        window.__TAURI__ ||
        window.__TAURI_INTERNALS__
      ) {
        // Keep flag active: onAuthStateChanged will handle the redirect result on return
        await signInWithRedirect(auth, googleProvider);
        return null;
      }
      googleLoginInProgressRef.current = false;
      setLoading(false);
      throw err;
    } finally {
      setLoading(false);
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

