const configuredApiUrl = import.meta.env.VITE_API_URL;

if (!configuredApiUrl) {
  throw new Error('A variável VITE_API_URL não foi configurada.');
}

export const API_URL = configuredApiUrl.replace(/\/+$/, '');
export const AUTH_STORAGE_KEY = 'controle-materiais-auth';

export class ApiError extends Error {
  constructor(message, status, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = details.campos ?? {};
    this.details = details;
  }
}

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

async function readResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(body, status) {
  if (typeof body === 'string' && body.trim()) return body;
  if (body?.erro) return body.erro;
  if (body?.message) return body.message;
  if (status === 401) return 'Sua sessão é inválida ou expirou. Entre novamente.';
  if (status === 403) return 'Você não tem permissão para realizar esta ação.';
  return 'Não foi possível concluir a solicitação.';
}

export async function apiRequest(path, options = {}) {
  const { auth = true, body, headers, ...fetchOptions } = options;
  const requestHeaders = new Headers(headers);
  const storedAuth = readStoredAuth();

  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (auth && storedAuth?.token) {
    requestHeaders.set('Authorization', `Bearer ${storedAuth.token}`);
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers: requestHeaders,
      body:
        body === undefined || body instanceof FormData
          ? body
          : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      'Não foi possível conectar ao servidor. Verifique se o back-end está em execução.',
      0,
    );
  }

  const responseBody = await readResponse(response);

  if (!response.ok) {
    if (auth && response.status === 401) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    throw new ApiError(
      errorMessage(responseBody, response.status),
      response.status,
      responseBody && typeof responseBody === 'object' ? responseBody : {},
    );
  }

  return responseBody;
}
