import { logNfeScanner } from './nfeScannerDebug.js';

export function nfeCameraConstraints(deviceId, highResolution = true) {
  return {
    audio: false,
    video: {
      // A manual selection must not compete with facingMode (e.g. a front camera).
      ...(deviceId
        ? { deviceId: { ideal: deviceId } }
        : { facingMode: { ideal: 'environment' } }),
      ...(highResolution ? {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        aspectRatio: { ideal: 16 / 9 },
      } : {}),
    },
  };
}

export function stopCameraStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

export function trackCapabilities(track) {
  try {
    return track?.getCapabilities?.() ?? {};
  } catch {
    return {};
  }
}

function mergeCameraConstraints(previous = {}, changes = {}, optional = {}) {
  const keys = Object.keys(optional);
  const advanced = (previous.advanced ?? []).map((entry) => Object.fromEntries(
    Object.entries(entry).filter(([key]) => !keys.includes(key)),
  )).filter((entry) => Object.keys(entry).length);
  if (keys.length) advanced.push(optional);
  return { ...previous, ...changes, ...(advanced.length ? { advanced } : {}) };
}

export function nfeZoomRange(capabilities, settings = {}) {
  const zoom = capabilities.zoom;
  if (!Number.isFinite(zoom?.min) || !Number.isFinite(zoom?.max) || zoom.min <= 0) return null;
  const min = zoom.min;
  const step = zoom.step > 0 ? zoom.step : 0.1;
  const limit = Math.min(zoom.max, Math.max(1, min) * 3);
  const max = Number((min + Math.floor((limit - min) / step + 1e-8) * step).toFixed(6));
  if (max <= min) return null;
  return { min, max, step, value: Math.max(min, Math.min(max, settings.zoom ?? Math.max(1, min))) };
}

export function nfeResolutionUpgrade(settings, capabilities) {
  const { width, height } = settings;
  if (!width || !height || width * height >= 1920 * 1080 * 0.6) return null;
  const portrait = height > width;
  const nextWidth = Math.min(portrait ? 1080 : 1920, capabilities.width?.max ?? width);
  const nextHeight = Math.min(portrait ? 1920 : 1080, capabilities.height?.max ?? height);
  if (nextWidth < width || nextHeight < height || nextWidth * nextHeight <= width * height * 1.25) return null;
  return { width: { ideal: nextWidth }, height: { ideal: nextHeight },
    aspectRatio: { ideal: nextWidth / nextHeight } };
}

// Serialize every track update, retaining resolution and earlier camera controls.
// A queued change from a cancelled/replaced session never touches another track.
export function createNfeCameraControls(track, isCancelled = () => false) {
  const capabilities = trackCapabilities(track);
  const torchSupported = capabilities.torch === true ||
    (Array.isArray(capabilities.torch) && capabilities.torch.includes(true));
  const zoom = nfeZoomRange(capabilities, track.getSettings?.());
  let constraints = track.getConstraints?.() ?? {};
  let queue = Promise.resolve();
  const stopped = () => isCancelled() || track.readyState === 'ended';

  function apply(changes, optional) {
    const operation = queue.then(async () => {
      if (stopped() || !track.applyConstraints) return false;
      const next = mergeCameraConstraints(constraints, changes, optional);
      try {
        await track.applyConstraints(next);
        if (stopped()) return false;
        constraints = next;
        return true;
      } catch (error) {
        logNfeScanner('optional camera control unavailable', { name: error?.name, message: error?.message });
        return false;
      }
    });
    queue = operation;
    return operation;
  }

  return {
    torchSupported,
    zoom,
    getState: () => ({
      torchSupported,
      torchOn: track.getSettings?.().torch === true,
      zoom: nfeZoomRange(capabilities, track.getSettings?.()),
    }),
    async configure() {
      logNfeScanner('track capabilities', capabilities);
      const settings = track.getSettings?.() ?? {};
      const upgrade = nfeResolutionUpgrade(settings, capabilities);
      if (upgrade) {
        const applied = await apply(upgrade);
        logNfeScanner('resolution improvement', { before: settings, requested: upgrade,
          applied, effective: track.getSettings?.() });
      }
      for (const mode of ['focusMode', 'exposureMode', 'whiteBalanceMode']) {
        if (capabilities[mode]?.includes('continuous')) {
          const applied = await apply({}, { [mode]: 'continuous' });
          logNfeScanner('continuous camera mode', { mode, applied, effective: track.getSettings?.()[mode] });
        }
      }
      // Do not zoom in automatically. Only correct an already excessive setting.
      if (zoom && (track.getSettings?.().zoom ?? zoom.value) > zoom.max) {
        await apply({}, { zoom: Math.max(1, zoom.min) });
      }
    },
    async setTorch(enabled) {
      if (!torchSupported) return { ok: false };
      const applied = await apply({}, { torch: Boolean(enabled) });
      const value = track.getSettings?.().torch ?? Boolean(enabled);
      return { ok: applied && value === Boolean(enabled), value };
    },
    async setZoom(requested) {
      if (!zoom || !Number.isFinite(requested)) return { ok: false };
      const clamped = Math.max(zoom.min, Math.min(zoom.max, requested));
      const value = Math.max(zoom.min, Math.min(zoom.max,
        zoom.min + Math.round((clamped - zoom.min) / zoom.step) * zoom.step));
      const applied = await apply({}, { zoom: value });
      const effective = track.getSettings?.().zoom ?? value;
      return { ok: applied, value: effective };
    },
  };
}

function cameraLabelHints(label = '') {
  const text = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return {
    front: /front|user|facetime|frontal|frente/.test(text),
    rear: /back|rear|environment|traseir|trass|arriere|trasera|ruck/.test(text),
    secondary: /ultra|telephoto|teleobjetiva|telefoto|depth|macro|0[.,]5\s*x/.test(text),
    main: /main|principal|standard|padrao|\b1[.,]0\s*x|\b1\s*x/.test(text),
  };
}

// Labels are only hints. The active track's facingMode is stronger evidence,
// and is available even when iOS gives generic/empty device labels.
export function selectNfeCamera(devices, track) {
  const settings = track?.getSettings?.() ?? {};
  const capabilities = trackCapabilities(track);
  const currentId = settings.deviceId;
  const facing = settings.facingMode ?? capabilities.facingMode?.[0];
  const ranked = devices.filter((device) => device.deviceId).map((device) => {
    const current = device.deviceId === currentId;
    const hints = cameraLabelHints(device.label || (current ? track?.label : ''));
    const knownFront = current && facing === 'user';
    const knownRear = current && facing === 'environment';
    let score = current ? 20 : 0;
    if (knownFront || (!knownRear && hints.front)) score -= 200;
    if (knownRear || (!knownFront && hints.rear)) score += 100;
    if (hints.secondary) score -= 60;
    if (hints.main && (knownRear || hints.rear)) score += 35;
    return { device, score };
  });
  ranked.sort((a, b) => b.score - a.score);
  return ranked[0]?.device ?? null;
}

export async function applyNfeContinuousFocus(track) {
  const capabilities = trackCapabilities(track);
  logNfeScanner('track capabilities', capabilities);
  if (!capabilities.focusMode?.includes('continuous') || !track?.applyConstraints) {
    logNfeScanner('focus', { status: 'not configurable' });
    return false;
  }
  try {
    await track.applyConstraints(mergeCameraConstraints(track.getConstraints?.(), {}, { focusMode: 'continuous' }));
    logNfeScanner('focus', {
      requested: 'continuous', effective: track.getSettings?.().focusMode,
    });
    return true;
  } catch (error) {
    // Some implementations advertise the capability but reject it at runtime.
    logNfeScanner('focus unavailable', { name: error?.name, message: error?.message });
    return false;
  }
}

function isConstraintError(error) {
  return ['OverconstrainedError', 'ConstraintNotSatisfiedError'].includes(error?.name);
}

function cancelledError() {
  const error = new Error('Camera session cancelled');
  error.name = 'AbortError';
  return error;
}

export async function openNfeCamera({
  mediaDevices,
  deviceId,
  isCancelled = () => false,
  onStream = () => {},
}) {
  let stream;
  let constraints;
  let resolutionFallback = false;
  const ensureActive = () => {
    if (isCancelled()) throw cancelledError();
  };
  async function acquire(id) {
    ensureActive();
    constraints = nfeCameraConstraints(id);
    resolutionFallback = false;
    try {
      stream = await mediaDevices.getUserMedia(constraints);
    } catch (error) {
      ensureActive();
      if (!isConstraintError(error)) throw error;
      // Normally ideal already negotiates down. Handle browsers that reject it.
      resolutionFallback = true;
      constraints = nfeCameraConstraints(id, false);
      logNfeScanner('resolution fallback', { name: error.name, constraints });
      stream = await mediaDevices.getUserMedia(constraints);
    }
    onStream(stream);
    ensureActive();
  }

  try {
    await acquire(deviceId);
    let devices = [];
    try {
      // Permission has already been granted, so labels/device IDs can be exposed.
      devices = (await mediaDevices.enumerateDevices()).filter(
        (device) => device.kind === 'videoinput',
      );
    } catch {
      // Enumeration is optional; the camera already acquired remains usable.
    }
    ensureActive();
    const initialTrack = stream.getVideoTracks()[0];
    const initialId = initialTrack?.getSettings?.().deviceId;
    const preferred = selectNfeCamera(devices, initialTrack);
    if (!deviceId && preferred?.deviceId && initialId && preferred.deviceId !== initialId) {
      logNfeScanner('camera preference', { from: initialId, to: preferred.deviceId, label: preferred.label });
      // Mobile Safari often cannot open two cameras at the same time.
      stopCameraStream(stream);
      try {
        await acquire(preferred.deviceId);
      } catch (error) {
        ensureActive();
        if (!['NotReadableError', 'NotFoundError', 'OverconstrainedError',
          'ConstraintNotSatisfiedError', 'AbortError'].includes(error?.name)) throw error;
        logNfeScanner('camera selection fallback', { name: error.name, deviceId: initialId });
        await acquire(initialId);
      }
    }
    ensureActive();
    const track = stream.getVideoTracks()[0];
    logNfeScanner('selected camera', {
      requestedDeviceId: deviceId || preferred?.deviceId,
      label: track?.label,
      requestedConstraints: constraints,
      resolutionFallback,
      settings: track?.getSettings?.(),
    });
    return { stream, devices, constraints, resolutionFallback };
  } catch (error) {
    stopCameraStream(stream);
    throw error;
  }
}

export function logNfeVideoDimensions(video) {
  const track = video?.srcObject?.getVideoTracks?.()[0];
  logNfeScanner('video dimensions', {
    settings: track?.getSettings?.(),
    videoWidth: video?.videoWidth,
    videoHeight: video?.videoHeight,
    displayWidth: video?.clientWidth,
    displayHeight: video?.clientHeight,
  });
}
