import {
  ApiError,
  CONNECTION_ERROR_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
  safeErrorText,
} from './apiErrors.js';

export const DEFAULT_TIMEOUT_MS = 30_000;

function unexpectedResponse(status) {
  return new ApiError(
    [408, 504].includes(status) ? TIMEOUT_ERROR_MESSAGE : CONNECTION_ERROR_MESSAGE,
    status,
  );
}

async function readJsonResponse(response) {
  const contentType = response.headers.get('Content-Type') ?? '';
  if (/\b(?:text\/html|application\/xhtml\+xml)\b/i.test(contentType)) {
    throw unexpectedResponse(response.status);
  }
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw unexpectedResponse(response.status);
  }
  if (!body || typeof body !== 'object') throw unexpectedResponse(response.status);
  if (response.ok && (typeof body.erro === 'string'
    || (typeof body.message === 'string' && !safeErrorText(body.message, null)))) {
    throw unexpectedResponse(response.status);
  }
  return body;
}

function structuredError(body, response) {
  if (Array.isArray(body) || (typeof body.erro !== 'string' && typeof body.message !== 'string')) {
    throw unexpectedResponse(response.status);
  }
  const message = body.erro || body.message;
  return new ApiError(message, response.status, {
    ...body,
    requestId: body.requestId ?? response.headers.get('X-Request-Id'),
  });
}

async function readBlobResponse(response) {
  const contentType = response.headers.get('Content-Type') ?? '';
  if (/html|json|text\//i.test(contentType)) throw unexpectedResponse(response.status);
  const blob = await response.blob();
  // Missing/mislabelled Content-Type must not turn a proxy error page into a file.
  const prefix = await blob.slice(0, 1024).text();
  if (!blob.size || !safeErrorText(prefix, null) || /^\s*[[{]/.test(prefix)) {
    throw unexpectedResponse(response.status);
  }
  return blob;
}

export function createApiClient({ baseUrl, readAuth, onUnauthorized }) {
  async function request(path, options = {}, asBlob = false) {
    const {
      auth = true, body, headers, signal, timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions
    } = options;
    const requestHeaders = new Headers(headers);
    const storedAuth = readAuth();
    const multipart = body instanceof FormData;
    if (body !== undefined && !multipart) requestHeaders.set('Content-Type', 'application/json');
    if (auth && storedAuth?.token) requestHeaders.set('Authorization', `Bearer ${storedAuth.token}`);

    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      console.log('[API] enviando:', {
        url: `${baseUrl}${path}`,
        method: fetchOptions.method,
        username: body?.username,
        hasPassword: Boolean(body?.password),
      });
      const response = await fetch(`${baseUrl}${path}`, {
        ...fetchOptions,
        headers: requestHeaders,
        body: body === undefined || multipart ? body : JSON.stringify(body),
        signal: controller.signal,
      });
      if ([204, 205].includes(response.status) && response.ok) return null;
      if (asBlob && response.ok) return await readBlobResponse(response);
      const responseBody = await readJsonResponse(response);
      if (!response.ok) {
        const error = structuredError(responseBody, response);
        // A proxy's HTML 401 must not log out the user and discard their form.
        if (auth && response.status === 401 && safeErrorText(responseBody.erro || responseBody.message, null)) {
          onUnauthorized();
        }
        throw error;
      }
      return responseBody;
    } catch (error) {
      console.error('[API] erro original:', error);
      if (error instanceof ApiError) throw error;
      if (timedOut || error?.name === 'TimeoutError' || signal?.reason?.name === 'TimeoutError') {
        throw new ApiError(TIMEOUT_ERROR_MESSAGE, 0);
      }
      if (signal?.aborted) throw new ApiError('A solicitação foi cancelada. Tente novamente.', 0);
      throw new ApiError(CONNECTION_ERROR_MESSAGE, 0);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  return {
    apiRequest: (path, options) => request(path, options),
    apiBlobRequest: (path, options) => request(path, options, true),
  };
}
