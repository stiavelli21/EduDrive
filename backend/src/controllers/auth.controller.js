// =============================================================================
// EduDrive — Auth Controller
// =============================================================================
// Handles user registration, login, and profile retrieval.
//
// Endpoints:
//   POST /api/auth/register  → Create a new student account
//   POST /api/auth/login     → Authenticate and receive JWT tokens
//   GET  /api/auth/me        → Get current user profile (requires auth)
//   POST /api/auth/refresh   → Refresh access token using refresh token
// =============================================================================

import bcrypt from 'bcrypt';
import { eq, sql } from 'drizzle-orm';
import { db } from '../app.js';
import { users, nodes } from '../models/schema.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client();
const SALT_ROUNDS = 12;

/**
 * POST /api/auth/register
 * Create a new student account.
 *
 * Body: { email, password, displayName }
 * Returns: { user, accessToken }
 */
export async function register(req, res, next) {
  try {
    const { email, password, displayName } = req.body;

    // Check if email is already taken
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({
        error: 'Email already registered',
        message: 'An account with this email already exists.',
      });
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        displayName,
      })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        createdAt: users.createdAt,
      });

    // Generate tokens
    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      user: {
        ...newUser,
        storageUsage: { usedBytes: 0, quotaBytes: 524288000, percentage: 0 },
      },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/login
 * Authenticate a student and return JWT tokens.
 *
 * Body: { email, password }
 * Returns: { user, accessToken }
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect.',
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect.',
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Return user without password hash
    const { passwordHash: _, ...safeUser } = user;
    const storageUsage = await calculateUserStorageUsage(user.id, user.storageQuotaBytes);
    res.json({
      user: {
        ...safeUser,
        storageUsage,
      },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 * Get the current authenticated user's profile.
 * Requires: authenticate middleware
 *
 * Returns: { user }
 */
export async function calculateUserStorageUsage(userId, storageQuotaBytes) {
  const quotaBytes = Number(storageQuotaBytes || 524288000);
  const usageResult = await db.execute(sql`
    SELECT COALESCE(SUM(size_bytes), 0) AS used_bytes
    FROM nodes
    WHERE owner_id = ${userId} AND type = 'file'
  `);
  const row = Array.isArray(usageResult) ? usageResult[0] : (usageResult?.rows?.[0] || usageResult?.[0]);
  const usedBytes = Number(row?.used_bytes ?? row?.usedBytes ?? 0);
  const percentage = Number(Math.min(100, (usedBytes / quotaBytes) * 100).toFixed(1));
  return { usedBytes, quotaBytes, percentage };
}

export async function getMe(req, res, next) {
  try {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        storageQuotaBytes: users.storageQuotaBytes,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const storageUsage = await calculateUserStorageUsage(user.id, user.storageQuotaBytes);

    res.json({
      user: {
        ...user,
        storageUsage,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/storage-usage
 * Get current storage usage and quota for the authenticated user.
 */
export async function getStorageUsage(req, res, next) {
  try {
    const [user] = await db
      .select({ id: users.id, storageQuotaBytes: users.storageQuotaBytes })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const storageUsage = await calculateUserStorageUsage(user.id, user.storageQuotaBytes);
    res.json(storageUsage);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/refresh
 * Refresh the access token using the refresh token from the httpOnly cookie.
 *
 * Returns: { accessToken }
 */
export async function refreshToken(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      return res.status(401).json({
        error: 'No refresh token',
        message: 'Please log in again.',
      });
    }

    const decoded = verifyRefreshToken(token);

    // Fetch user to ensure they still exist
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, decoded.id))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    const accessToken = generateAccessToken(user);
    res.json({ accessToken });
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid refresh token',
      message: 'Please log in again.',
    });
  }
}

/**
 * POST /api/auth/logout
 * Clear the refresh token cookie.
 */
export function logout(req, res) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.json({ message: 'Logged out successfully' });
}

/**
 * POST /api/auth/google
 * Authenticate with Google ID Token (from Firebase Auth or Google OAuth).
 *
 * Body: { idToken }
 * Returns: { user, accessToken }
 */
export async function googleLogin(req, res, next) {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      console.warn('⚠️ [googleLogin] idToken mancante nella richiesta body');
      return res.status(400).json({ error: 'ID token di Google mancante' });
    }

    // Decode and verify ID Token
    // Firebase ID tokens have the Firebase project ID as their audience,
    // NOT the Firebase App ID. We support both standard Google OAuth tokens
    // and Firebase Auth tokens (issued by securetoken.google.com).
    let email, displayName, avatarUrl;
    try {
      // Try standard Google OAuth verification with the correct audience.
      // For Firebase tokens, the audience is the Firebase project ID.
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID || undefined,
      });
      const payload = ticket.getPayload();
      email = payload?.email;
      displayName = payload?.name || payload?.given_name || email?.split('@')[0];
      avatarUrl = payload?.picture;
      console.log(`✅ [googleLogin] Token verificato con successo via Google OAuth Client: ${email}`);
    } catch (errPrimary) {
      // Fallback: verify Firebase ID Token (issued by securetoken.google.com)
      // The primary verifyIdToken may fail because:
      //   - GOOGLE_CLIENT_ID is not set (common in dev)
      //   - The token is a Firebase Auth token, not a standard Google OAuth token
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        console.warn(`⚠️ [googleLogin] Errore verifica primaria (${errPrimary.message}). Il token non ha 3 parti.`);
        return res.status(401).json({ error: 'Formato ID token non valido.' });
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

      // Validate issuer (must be Firebase securetoken or Google accounts)
      const validIssuers = [
        `https://securetoken.google.com/${process.env.FIREBASE_PROJECT_ID || ''}`,
        'https://accounts.google.com',
      ];
      const isValidIssuer = validIssuers.some(
        (issuer) => issuer && payload.iss && payload.iss === issuer
      ) || (payload.iss && payload.iss.startsWith('https://securetoken.google.com/'));

      if (!isValidIssuer) {
        console.warn(`⚠️ [googleLogin] Emittente token non valido. iss ricevuto: "${payload.iss}", attesi o ammessi: ${JSON.stringify(validIssuers)}`);
        return res.status(401).json({ error: 'Token emittente non riconosciuto.' });
      }

      // Validate expiration
      if (!payload.exp || payload.exp * 1000 < Date.now()) {
        console.warn(`⚠️ [googleLogin] Token scaduto. exp: ${payload.exp}`);
        return res.status(401).json({ error: 'Token Google/Firebase scaduto.' });
      }

      if (!payload.email) {
        console.warn('⚠️ [googleLogin] Token valido ma senza email.');
        return res.status(401).json({ error: 'Token non contiene un indirizzo email.' });
      }

      email = payload.email;
      displayName = payload.name || payload.email.split('@')[0];
      avatarUrl = payload.picture;
      console.log(`✅ [googleLogin] Token verificato con successo via Firebase ID Token: ${email}`);
    }

    if (!email) {
      console.warn('⚠️ [googleLogin] Impossibile ricavare email dal token.');
      return res.status(401).json({ error: 'Impossibile ricavare l\'email dal token Google.' });
    }

    const cleanEmail = email.toLowerCase();

    // Check if user already exists
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (!user) {
      console.log(`🆕 [googleLogin] Creazione nuovo utente su DB Neon per email: ${cleanEmail}`);
      const randomPassword = Math.random().toString(36).slice(-10) + Date.now().toString(36);
      const passwordHash = await bcrypt.hash(randomPassword, SALT_ROUNDS);

      [user] = await db
        .insert(users)
        .values({
          email: cleanEmail,
          passwordHash,
          displayName: displayName || cleanEmail.split('@')[0],
          avatarUrl: avatarUrl || null,
        })
        .returning();
      console.log(`🎉 [googleLogin] Utente creato con successo, ID: ${user.id}`);
    } else {
      console.log(`ℹ️ [googleLogin] Utente esistente trovato, ID: ${user.id}`);
      if (!user.avatarUrl && avatarUrl) {
        [user] = await db
          .update(users)
          .set({ avatarUrl, updatedAt: new Date() })
          .where(eq(users.id, user.id))
          .returning();
      }
    }

    // Generate internal JWT tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { passwordHash: _, ...safeUser } = user;
    const storageUsage = await calculateUserStorageUsage(user.id, user.storageQuotaBytes);
    res.json({
      user: {
        ...safeUser,
        storageUsage,
      },
      accessToken,
    });
  } catch (error) {
    console.error('[googleLogin] Errore imprevisto durante il login Google:', error.message, error.stack);
    next(error);
  }
}

// =============================================================================
// Desktop Google Login (for Tauri / native apps where signInWithPopup fails)
// =============================================================================
// Flow:
//   1. Desktop app generates a sessionId and opens the system browser to
//      GET /api/auth/google/desktop?sessionId=...&apiKey=...&authDomain=...&projectId=...
//   2. Backend serves an HTML page that uses Firebase JS SDK to call signInWithPopup
//   3. On success, the page POSTs the Firebase ID token to /api/auth/google/desktop-token
//   4. Desktop app polls GET /api/auth/google/desktop-poll/:sessionId to retrieve the token
//   5. Desktop app then calls POST /api/auth/google with the token to complete authentication
// =============================================================================

const desktopLoginSessions = new Map();
const DESKTOP_SESSION_TTL = 5 * 60 * 1000; // 5 minutes

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of desktopLoginSessions) {
    if (now - session.createdAt > DESKTOP_SESSION_TTL) {
      desktopLoginSessions.delete(key);
    }
  }
}, 60 * 1000);

/**
 * GET /api/auth/google/desktop
 * Serves an HTML page that handles Google sign-in via Firebase JS SDK in the system browser.
 * Query params: sessionId, apiKey, authDomain, projectId
 */
export function desktopGooglePage(req, res) {
  const { sessionId, apiKey, authDomain, projectId } = req.query;

  if (!sessionId || !apiKey || !authDomain || !projectId) {
    return res.status(400).send('Parametri mancanti.');
  }

  const apiBaseUrl = `${req.protocol}://${req.get('host')}/api`;

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EduDrive - Accesso con Google</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f4f7fc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #0f172a;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 48px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      text-align: center;
    }
    .logo {
      width: 56px; height: 56px;
      background: linear-gradient(135deg, #2563eb, #3b82f6);
      border-radius: 14px;
      display: inline-flex; align-items: center; justify-content: center;
      margin-bottom: 20px;
    }
    .logo svg { width: 28px; height: 28px; fill: white; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    p { color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid #e2e8f0; border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .success-color { color: #16a34a; }
    .error-color { color: #dc2626; }
    .status-icon { margin-bottom: 12px; }
    .status-icon svg { width: 48px; height: 48px; }
    .btn {
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 10px;
      padding: 14px 28px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-block;
      width: 100%;
    }
    .btn:hover {
      background: #1d4ed8;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <svg viewBox="0 0 24 24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>
    </div>

    <div id="start-view">
      <h1>Accesso per Desktop</h1>
      <p>Per continuare sull'applicazione EduDrive, effettua l'autenticazione sicura con il tuo account Google.</p>
      <button id="login-btn" class="btn">Accedi con Google</button>
    </div>

    <div id="loading" style="display:none">
      <h1>Accesso con Google</h1>
      <p>Autenticazione in corso...<br>Completa l'accesso nella finestra popup di Google.</p>
      <div class="spinner"></div>
    </div>

    <div id="success" style="display:none">
      <div class="status-icon success-color">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
      </div>
      <h1 class="success-color">Accesso riuscito!</h1>
      <p>Puoi chiudere questa finestra e tornare all'app EduDrive per Desktop.</p>
    </div>

    <div id="error" style="display:none">
      <div class="status-icon error-color">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      </div>
      <h1 class="error-color">Errore di accesso</h1>
      <p id="error-message">Si e' verificato un errore durante l'accesso.</p>
      <button id="retry-btn" class="btn" style="margin-top: 12px;">Riprova</button>
    </div>
  </div>

  <script type="module">
    import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js';
    import { getAuth, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';

    const firebaseConfig = {
      apiKey: ${JSON.stringify(apiKey)},
      authDomain: ${JSON.stringify(authDomain)},
      projectId: ${JSON.stringify(projectId)},
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');

    const sessionId = ${JSON.stringify(sessionId)};
    const apiBase = ${JSON.stringify(apiBaseUrl)};

    async function handleLogin() {
      document.getElementById('start-view').style.display = 'none';
      document.getElementById('error').style.display = 'none';
      document.getElementById('loading').style.display = 'block';

      try {
        const result = await signInWithPopup(auth, provider);
        const idToken = await result.user.getIdToken(true);

        const response = await fetch(apiBase + '/auth/google/desktop-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, idToken }),
        });

        if (!response.ok) throw new Error('Errore nel salvataggio del token sul server');

        document.getElementById('loading').style.display = 'none';
        document.getElementById('success').style.display = 'block';
      } catch (err) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('error-message').textContent =
          err.message || 'Errore sconosciuto durante l\\'accesso con Google.';
      }
    }

    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('retry-btn').addEventListener('click', handleLogin);
  </script>
</body>
</html>`;

  res.type('html').send(html);
}

/**
 * POST /api/auth/google/desktop-token
 * Stores a Firebase ID token temporarily for a desktop login session.
 * Body: { sessionId, idToken }
 */
export function storeDesktopToken(req, res) {
  const { sessionId, idToken } = req.body;

  if (!sessionId || !idToken) {
    return res.status(400).json({ error: 'Missing sessionId or idToken' });
  }

  desktopLoginSessions.set(sessionId, {
    idToken,
    createdAt: Date.now(),
  });

  res.json({ success: true });
}

/**
 * GET /api/auth/google/desktop-poll/:sessionId
 * Returns the stored Firebase ID token for a desktop login session.
 * Single-use: the token is deleted after retrieval.
 */
export function pollDesktopToken(req, res) {
  const { sessionId } = req.params;
  const session = desktopLoginSessions.get(sessionId);

  if (!session) {
    return res.status(202).json({ status: 'pending' });
  }

  if (Date.now() - session.createdAt > DESKTOP_SESSION_TTL) {
    desktopLoginSessions.delete(sessionId);
    return res.status(410).json({ error: 'Session expired' });
  }

  // Single use: delete after retrieval
  desktopLoginSessions.delete(sessionId);
  res.json({ status: 'complete', idToken: session.idToken });
}

