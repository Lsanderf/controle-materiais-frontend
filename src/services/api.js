import { createApiClient } from './apiClient.js';

export { ApiError } from './apiErrors.js';

const configuredApiUrl = import.meta.env.VITE_API_URL;

if (!configuredApiUrl) {
  throw new Error('A variável VITE_API_URL não foi configurada.');
}

export const API_URL = configuredApiUrl.replace(/\/+$/, '');
export const AUTH_STORAGE_KEY = 'controle-materiais-auth';

export function readStoredAuth() {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;

    const auth = JSON.parse(stored);
    if (!auth?.token || (auth.expiresAt && Date.now() >= auth.expiresAt)) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return auth;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export const { apiRequest, apiBlobRequest } = createApiClient({
  baseUrl: API_URL,
  readAuth: readStoredAuth,
  onUnauthorized: () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new Event('auth:unauthorized'));
  },
});
