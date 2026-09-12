// Vite removes these diagnostics from production. Never capture or persist frames.
export function logNfeScanner(event, details) {
  if (import.meta.env?.DEV) {
    console.debug(`[NF-e scanner] ${event}`, details);
  }
}

export function logNfeScannerError(event, error) {
  if (import.meta.env?.DEV) {
    console.error(`[NF-e scanner] ${event}`, error);
  }
}
