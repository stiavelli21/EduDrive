// =============================================================================
// EduDrive — API Service (Axios Client)
// =============================================================================
// Centralized HTTP client for communicating with the backend API.
// Features:
//   - Base URL configuration
//   - Automatic JWT token attachment
//   - Automatic token refresh on 401 responses
//
// PLUGIN DEVELOPERS: Import `api` and use it for all API calls.
// Example: const res = await api.get('/flashcards');
// =============================================================================

import axios from 'axios';

/**
 * Compute the base API URL:
 * 1. If VITE_API_URL is explicitly defined in environment variables, use it.
 * 2. If running inside native Tauri desktop app (.exe), default to local server ('http://localhost:3001/api') unless VITE_API_URL is configured.
 * 3. Otherwise default to '/api' (proxied by Vite to localhost:3001 in web dev).
 */
export function getApiBaseUrl() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (
    typeof window !== 'undefined' &&
    (window.__TAURI__ || window.__TAURI_INTERNALS__ || window.location?.protocol === 'tauri:')
  ) {
    return 'http://localhost:3001/api';
  }
  return '/api';
}

/**
 * Axios instance configured for the EduDrive API.
 */
const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true, // Send cookies (refresh token)
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Token Management --------------------------------------------------------

let accessToken = null;

/**
 * Set the access token (called after login/register/refresh).
 * @param {string|null} token
 */
export function setAccessToken(token) {
  accessToken = token;
}

/**
 * Get the current access token.
 * @returns {string|null}
 */
export function getAccessToken() {
  return accessToken;
}

// --- Request Interceptor: Attach JWT ----------------------------------------

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// --- Response Interceptor: Auto-refresh on 401 ------------------------------

let isRefreshing = false;
let refreshQueue = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If we get a 401 and haven't tried refreshing yet (and it's not an auth endpoint)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/register') &&
      !originalRequest.url?.includes('/auth/logout') &&
      !originalRequest.url?.includes('/auth/local-login')
    ) {
      originalRequest._retry = true;

      const isLocalMode =
        typeof window !== 'undefined' &&
        (localStorage.getItem('edudrive_local_mode') === 'true' ||
          window.location.search.includes('local=true'));

      if (isRefreshing) {
        // Queue the request until refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then(() => {
          originalRequest.headers.Authorization = `Bearer ${accessToken || 'LOCAL_MODE_TOKEN'}`;
          return api(originalRequest);
        });
      }

      isRefreshing = true;

      if (isLocalMode) {
        try {
          const { data } = await axios.post(`${getApiBaseUrl()}/auth/local-login`, null, {
            withCredentials: true,
          });
          accessToken = data?.accessToken || 'LOCAL_MODE_TOKEN';
          refreshQueue.forEach(({ resolve }) => resolve());
          refreshQueue = [];
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (localLoginErr) {
          accessToken = 'LOCAL_MODE_TOKEN';
          refreshQueue.forEach(({ resolve }) => resolve());
          refreshQueue = [];
          originalRequest.headers.Authorization = `Bearer LOCAL_MODE_TOKEN`;
          return api(originalRequest);
        } finally {
          isRefreshing = false;
        }
      }

      try {
        const { data } = await axios.post(`${getApiBaseUrl()}/auth/refresh`, null, {
          withCredentials: true,
        });

        accessToken = data.accessToken;

        // Retry all queued requests
        refreshQueue.forEach(({ resolve }) => resolve());
        refreshQueue = [];

        // Retry the original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — clear token and redirect to login if not already on guest pages
        accessToken = null;
        refreshQueue.forEach(({ reject }) => reject(refreshError));
        refreshQueue = [];
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
