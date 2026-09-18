export const CONNECTION_ERROR_MESSAGE =
  'Não foi possível se comunicar com o servidor. Verifique sua conexão e tente novamente.';
export const TIMEOUT_ERROR_MESSAGE =
  'O servidor demorou para responder. Verifique sua conexão e tente novamente.';

// Error messages may be rendered as text, but HTML and diagnostic dumps still
// must never become user-facing content (including inside JSON field errors).
const HTML_CONTENT = /<\/?[a-z][^>]*>|<!doctype|<!--|&lt;\/?[a-z][\s\S]*?&gt;/i;
const STACK_TRACE = /(?:^|\n)\s*(?:at\s+\S+|Caused by:|Traceback \(most recent call last\)|[\w.]*Error:)|\b(?:[\w$]+\.)+[\w$]*(?:Exception|Error)\b/i;
const PROXY_CONTENT = /\b(?:cloudflare|cloudfront|nginx|varnish|bad gateway|gateway timeout|proxy error|tunnel error|upstream connect error)\b/i;

export function safeErrorText(value, fallback = CONNECTION_ERROR_MESSAGE) {
  if (typeof value !== 'string' || !value.trim()
    || HTML_CONTENT.test(value) || STACK_TRACE.test(value) || PROXY_CONTENT.test(value)) {
    return fallback;
  }
  return value;
}

export function safeErrorFields(fields) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {};
  return Object.fromEntries(Object.entries(fields)
    .filter(([, value]) => safeErrorText(value, null) !== null));
}

export class ApiError extends Error {
  constructor(message, status, details = {}) {
    super(safeErrorText(message));
    this.name = 'ApiError';
    this.status = status;
    this.fields = safeErrorFields(details.campos);
    this.requestId = safeErrorText(details.requestId, null) ?? undefined;
    // Preserve the public API error contract without carrying diagnostic dumps.
    this.details = {
      ...(details.status !== undefined && { status: details.status }),
      ...(safeErrorText(details.dataHora, null) && { dataHora: details.dataHora }),
      ...(typeof details.erro === 'string' && { erro: safeErrorText(details.erro) }),
      ...(typeof details.message === 'string' && { message: safeErrorText(details.message) }),
      ...(details.campos && { campos: this.fields }),
      ...(this.requestId && { requestId: this.requestId }),
    };
  }
}
