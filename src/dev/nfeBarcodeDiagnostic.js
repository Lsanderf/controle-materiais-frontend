// Import manually from the browser console in Vite development only.
// No route, upload control or production entry imports this module.
export async function diagnoseNfeBarcodeImage(source = '/test/fixtures/nfe-code128c.svg') {
  if (!import.meta.env.DEV) throw new Error('Diagnóstico disponível somente em desenvolvimento.');
  const { createNfeBarcodeReader, inspectNfeBarcodeResult } = await import('../utils/nfeBarcodeReader.js');
  const reader = createNfeBarcodeReader();
  const result = typeof source === 'string'
    ? await reader.decodeFromImageUrl(source)
    : await reader.decodeFromImageElement(source);
  const decoded = inspectNfeBarcodeResult(result);
  console.debug('[NF-e scanner] static image', decoded);
  return decoded;
}
