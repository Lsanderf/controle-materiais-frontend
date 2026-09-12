import { BarcodeFormat, BrowserCodeReader } from '@zxing/browser';
import { Code128Reader, DecodeHintType } from '@zxing/library';
import { inspectNfeAccessKey } from './nfeBarcode.js';
import { logNfeScanner } from './nfeScannerDebug.js';
import { nfeDecodeDelay, nfeDecodeStrategy, nfeReadRegion } from './nfeReadRegion.js';

export function createNfeBarcodeReader(video, guide) {
  let attempt = 0;
  let regionCanvas;
  let statistics = { attempts: 0, totalMs: 0, maxMs: 0, since: performance.now() };
  class NfeBarcodeReader extends BrowserCodeReader {
    decodeFromCanvas(canvas) {
      const started = performance.now();
      const strategy = nfeDecodeStrategy(attempt++);
      let region;
      try {
        // @zxing/browser 0.2.1 allocates the scan canvas only once. Resize/redraw
        // when the intrinsic video dimensions change, without restarting capture.
        if (video?.videoWidth && video?.videoHeight &&
          (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext('2d').drawImage(video, 0, 0);
        }
        if (!video || !guide || strategy.fullFrame) return super.decodeFromCanvas(canvas);
        region = nfeReadRegion(canvas.width, canvas.height,
          video.getBoundingClientRect(), guide.getBoundingClientRect());
        regionCanvas ??= document.createElement('canvas');
        const radians = strategy.angle * Math.PI / 180;
        const cos = Math.abs(Math.cos(radians));
        const sin = Math.abs(Math.sin(radians));
        // Rotation expands the bounds; native pixels are never scaled up.
        const width = Math.ceil(region.width * cos + region.height * sin);
        const height = Math.ceil(region.height * cos + region.width * sin);
        if (regionCanvas.width !== width) regionCanvas.width = width;
        if (regionCanvas.height !== height) regionCanvas.height = height;
        let context;
        try {
          context = regionCanvas.getContext('2d', { willReadFrequently: true });
        } catch {
          context = regionCanvas.getContext('2d');
        }
        if (!context) throw new Error('Não foi possível preparar a área de leitura.');
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.fillStyle = 'white';
        context.fillRect(0, 0, width, height);
        context.translate(width / 2, height / 2);
        context.rotate(radians);
        context.drawImage(canvas, region.x, region.y, region.width, region.height,
          -region.width / 2, -region.height / 2, region.width, region.height);
        return super.decodeFromCanvas(regionCanvas);
      } finally {
        const duration = performance.now() - started;
        this.options.delayBetweenScanAttempts = nfeDecodeDelay(duration);
        statistics.attempts += 1;
        statistics.totalMs += duration;
        statistics.maxMs = Math.max(statistics.maxMs, duration);
        if (performance.now() - statistics.since >= 5000) {
          logNfeScanner('decode performance', {
            attempts: statistics.attempts,
            averageMs: Math.round(statistics.totalMs / statistics.attempts),
            maxMs: Math.round(statistics.maxMs),
            delayMs: this.options.delayBetweenScanAttempts,
            strategy, region, nativeWidth: canvas.width, nativeHeight: canvas.height,
          });
          statistics = { attempts: 0, totalMs: 0, maxMs: 0, since: performance.now() };
        }
      }
    }
  }
  // The generic MultiFormatReader in library 0.23 logs NotFoundException on
  // every empty frame, even in production. Use ZXing's CODE-128 reader directly.
  // CODE_128 includes code sets A, B and C, including transitions between sets.
  const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]]]);
  const reader = new NfeBarcodeReader(new Code128Reader(), hints, {
    delayBetweenScanAttempts: 160,
    delayBetweenScanSuccess: 400,
  });
  return reader;
}

export function isRecoverableNfeDecodeError(error) {
  const kind = error?.getKind?.() ?? error?.name;
  return ['NotFoundException', 'ChecksumException', 'FormatException'].includes(kind);
}

export function inspectNfeBarcodeResult(result) {
  const text = result.getText();
  const format = result.getBarcodeFormat();
  return {
    format: BarcodeFormat[format],
    isCode128: format === BarcodeFormat.CODE_128,
    textLength: text.length,
    ...inspectNfeAccessKey(text),
  };
}

export function handleNfeDecodeResult(session, result, error, onFatal) {
  if (session.isStopped()) return;
  if (result) {
    const decoded = inspectNfeBarcodeResult(result);
    logNfeScanner('decoded barcode', decoded);
    if (decoded.isCode128) session.handleDetection(result.getText());
  } else if (error && !isRecoverableNfeDecodeError(error)) {
    onFatal(error);
  }
}
