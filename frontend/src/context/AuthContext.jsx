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
//   - login(email, password)  -> authenticate and set user
//   - register(email, password, displayName) -> create account and set user
//   - logout() -> clear user and tokens
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
 * Helper: send Firebase idToken to the EduDrive backend and return user + accessToken.
 */
async function authenticateWithBackend(firebaseUser) {
  const idToken = await firebaseUser.getIdToken(true);
  const { data } = await api.post('/auth/google', { idToken });
  return data;
}

/**
 * AuthProvider -- wraps the app and manages authentication state.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Ref flag to prevent the onAuthStateChanged listener from racing with
  // an active loginWithGoogle popup/redirect flow.
  const googleLoginInProgressRef = useRef(false);

  // Track whether the initial checkAuth has already authenticated the user
  // to avoid duplicate /auth/google calls from onAuthStateChanged.
  const hasAuthenticatedRef = useRef(false);

  // On mount, check redirect login result or try to refresh the token
  useEffect(() => {
    let unsubscribe = () => { };
    let isMounted = true;

    async function checkAuth() {
      const isPendingGoogleRedirect = localStorage.getItem('edudrive_google_login_pending') === 'true';

      try {
        // --- Phase 1: Handle Google redirect results or existing Firebase sessions ---
        if (isFirebaseConfigured && auth) {
          await auth.authStateReady();

          // Check for a redirect result first (user returning from signInWithRedirect)
          let firebaseUser = null;
          try {
            const redirectResult = await getRedirectResult(auth);
            if (redirectResult?.user) {
              firebaseUser = redirectResult.user;
            }
          } catch (redirectErr) {
            console.warn('Google redirect check:', redirectErr.message);
          }

          // If no redirect result, check if Firebase already has a restored session
          if (!firebaseUser && auth.currentUser) {
            firebaseUser = auth.currentUser;
          }

          // If we have a Firebase user (from redirect or restored session), authenticate
          if (firebaseUser) {
            try {
              const data = await authenticateWithBackend(firebaseUser);
              if (isMounted) {
                setAccessToken(data.accessToken);
                setUser(data.user);
                hasAuthenticatedRef.current = true;
                localStorage.removeItem('edudrive_google_login_pending');
                googleLoginInProgressRef.current = false;
                setLoading(false);
              }
              // Set up the listener but it won't re-process since hasAuthenticatedRef is true
              unsubscribe = onAuthStateChanged(auth, () => { });
              return;
            } catch (apiErr) {
              console.error('Backend Google auth error:', apiErr.message);
            }
          }

          // Set up onAuthStateChanged listener for future auth changes.
          // This handles cases like: user signs in via popup AFTER checkAuth has finished.
          unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            // Skip if: no user, component unmounted, loginWithGoogle is handling it,
            // or we've already authenticated this session.
            if (
              !fbUser ||
              !isMounted ||
              googleLoginInProgressRef.current ||
              hasAuthenticatedRef.current
            ) {
              return;
            }

            try {
              const data = await authenticateWithBackend(fbUser);
              if (isMounted) {
                setAccessToken(data.accessToken);
                setUser(data.user);
                hasAuthenticatedRef.current = true;
                localStorage.removeItem('edudrive_google_login_pending');
                setLoading(false);
              }
            } catch (apiErr) {
              console.error('Backend Google auth error (listener):', apiErr.message);
              if (isMounted) setLoading(false);
            }
          });

          // If a redirect was pending but no Firebase user appeared, wait briefly
          if (isPendingGoogleRedirect && !firebaseUser) {
            const maxWait = 3000;
            const start = Date.now();
            while (Date.now() - start < maxWait && isMounted) {
              await new Promise((resolve) => setTimeout(resolve, 250));
              if (auth.currentUser) {
                try {
                  const data = await authenticateWithBackend(auth.currentUser);
                  if (isMounted) {
                    setAccessToken(data.accessToken);
                    setUser(data.user);
                    hasAuthenticatedRef.current = true;
                    localStorage.removeItem('edudrive_google_login_pending');
                    googleLoginInProgressRef.current = false;
                    setLoading(false);
                  }
                  return;
                } catch (apiErr) {
                  console.error('Backend Google auth error (poll):', apiErr.message);
                  break;
                }
              }
            }
            // Clean up if nothing resolved
            localStorage.removeItem('edudrive_google_login_pending');
            googleLoginInProgressRef.current = false;
          }
        }

        // --- Phase 2: Standard token refresh (email/password sessions) ---
        // Skip if we already authenticated via Google above
        if (hasAuthenticatedRef.current) return;

        const { data: refreshData } = await api.post('/auth/refresh');
        if (!isMounted) return;
        setAccessToken(refreshData.accessToken);

        const { data: profileData } = await api.get('/auth/me');
        if (!isMounted) return;
        setUser(profileData.user);
      } catch {
        // Not authenticated -- only reset if loginWithGoogle isn't actively running
        if (!googleLoginInProgressRef.current && isMounted) {
          setUser(null);
          setAccessToken(null);
        }
      } finally {
        if (isMounted && !googleLoginInProgressRef.current) {
          setLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
      unsubscribe();
    };
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
   *
   * Strategy:
   * - In Tauri (desktop .exe): signInWithPopup does not work in WebView2 because
   *   the popup cannot communicate the OAuth result back. Instead, we open the
   *   system browser with a backend-served page that runs Firebase signInWithPopup
   *   in a real browser context. The page stores the Firebase ID token on the backend,
   *   and we poll for it.
   * - In web browser: use signInWithPopup directly (standard Firebase flow).
   */
  const loginWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      throw new Error('Autenticazione con Google non configurata (verifica le variabili d\'ambiente VITE_FIREBASE_*).');
    }

    const isTauri = Boolean(
      window.__TAURI__ ||
      window.__TAURI_INTERNALS__ ||
      window.location?.protocol === 'tauri:'
    );

    googleLoginInProgressRef.current = true;
    hasAuthenticatedRef.current = false;
    localStorage.setItem('edudrive_google_login_pending', 'true');
    setLoading(true);

    // ---- Tauri Desktop Flow: open system browser + poll backend ----
    if (isTauri) {
      try {
        const sessionId = crypto.randomUUID();

        // Build the URL to the backend-served desktop auth page
        const apiUrl = import.meta.env.VITE_API_URL || 'https://edudrive-backend.onrender.com/api';
        const desktopUrl = new URL(`${apiUrl}/auth/google/desktop`);
        desktopUrl.searchParams.set('sessionId', sessionId);
        desktopUrl.searchParams.set('apiKey', import.meta.env.VITE_FIREBASE_API_KEY);
        desktopUrl.searchParams.set('authDomain', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
        desktopUrl.searchParams.set('projectId', import.meta.env.VITE_FIREBASE_PROJECT_ID);

        // Open in the system browser (requires opener:allow-open-url capability)
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl(desktopUrl.toString());

        // Poll for the Firebase ID token (the browser page will store it on the backend)
        const maxWait = 120000; // 2 minutes
        const pollInterval = 2000;
        const start = Date.now();

        while (Date.now() - start < maxWait) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));

          try {
            const { data: pollData } = await api.get(`/auth/google/desktop-poll/${sessionId}`);
            if (pollData.status === 'complete' && pollData.idToken) {
              // Use the retrieved token to authenticate through the normal endpoint
              // This sets the httpOnly cookie in the Tauri WebView2 context
              const { data: authData } = await api.post('/auth/google', { idToken: pollData.idToken });
              setAccessToken(authData.accessToken);
              setUser(authData.user);
              hasAuthenticatedRef.current = true;
              localStorage.removeItem('edudrive_google_login_pending');
              googleLoginInProgressRef.current = false;
              setLoading(false);
              return authData.user;
            }
          } catch (pollErr) {
            // 202 = still pending, continue polling
            // 410 = session expired, stop
            if (pollErr.response?.status === 410) break;
          }
        }

        // Timeout or session expired
        localStorage.removeItem('edudrive_google_login_pending');
        googleLoginInProgressRef.current = false;
        setLoading(false);
        throw new Error('Accesso con Google non completato. Completa il login nel browser e riprova.');
      } catch (tauriErr) {
        localStorage.removeItem('edudrive_google_login_pending');
        googleLoginInProgressRef.current = false;
        setLoading(false);
        throw tauriErr;
      }
    }

    // ---- Standard Browser Flow: Firebase signInWithPopup ----
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const data = await authenticateWithBackend(result.user);

      setAccessToken(data.accessToken);
      setUser(data.user);
      hasAuthenticatedRef.current = true;
      localStorage.removeItem('edudrive_google_login_pending');
      googleLoginInProgressRef.current = false;
      setLoading(false);
      return data.user;
    } catch (err) {
      // If popup was blocked, fallback to signInWithRedirect
      const popupErrors = [
        'auth/popup-blocked',
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
        'auth/operation-not-supported-in-this-environment',
      ];
      if (popupErrors.includes(err.code)) {
        await signInWithRedirect(auth, googleProvider);
        return null;
      }

      // Any other error: clean up and re-throw
      localStorage.removeItem('edudrive_google_login_pending');
      googleLoginInProgressRef.current = false;
      setLoading(false);
      throw err;
    }
  }, []);


  /**
   * Refresh current user profile and storage usage statistics.
   */
  const refreshProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      if (data?.user) {
        setUser(data.user);
        return data.user;
      }
    } catch {
      // Ignore errors if offline or unauthorized
    }
  }, []);

  /**
   * Log out -- clear state and server-side cookie.
   */
  const logout = useCallback(async () => {
    try {
      // Sign out of Firebase as well to prevent onAuthStateChanged from restoring session
      if (auth) {
        const { signOut } = await import('firebase/auth');
        await signOut(auth).catch(() => {});
      }
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors
    }
    hasAuthenticatedRef.current = false;
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
    refreshProfile,
    isFirebaseConfigured,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

