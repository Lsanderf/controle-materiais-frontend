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
  const keys = [...Object.keys(optional), ...Object.keys(changes)];
  const basic = Object.fromEntries(Object.entries(previous).filter(([key]) => key !== 'advanced' && !keys.includes(key)));
  const advanced = (previous.advanced ?? []).map((entry) => Object.fromEntries(
    Object.entries(entry).filter(([key]) => !keys.includes(key)),
  )).filter((entry) => Object.keys(entry).length);
  // Put the requested imaging control first, never behind focus/exposure entries.
  if (Object.keys(optional).length) advanced.unshift(optional);
  return { ...basic, ...changes, ...(advanced.length ? { advanced } : {}) };
}

function trackSettings(track) {
  try { return track?.getSettings?.() ?? {}; } catch { return {}; }
}

function trackConstraints(track) {
  try { return track?.getConstraints?.() ?? {}; } catch { return {}; }
}

export function nfeZoomRange(capabilities, settings = {}) {
  const zoom = capabilities.zoom;
  if (!Number.isFinite(zoom?.min) || !Number.isFinite(zoom?.max) || zoom.min <= 0) return null;
  const min = zoom.min;
  const step = Number.isFinite(zoom.step) && zoom.step > 0 ? zoom.step : 0.1;
  const max = zoom.max;
  if (max <= min || step > max - min) return null;
  // A missing setting is unknown, not evidence that the requested zoom was applied.
  return { min, max, step, value: Number.isFinite(settings.zoom) ? settings.zoom : null };
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
export function createNfeCameraControls(track, isCancelled = () => false, getActiveTrack = () => track) {
  let constraints = trackConstraints(track);
  let queue = Promise.resolve();
  let zoomRevision = 0;
  const stopped = () => isCancelled() || track.readyState === 'ended' || getActiveTrack() !== track;
  function state() {
    if (stopped()) return { torchSupported: false, torchOn: false, zoom: null };
    const capabilities = trackCapabilities(track);
    const settings = trackSettings(track);
    return {
      torchSupported: capabilities.torch === true ||
        (Array.isArray(capabilities.torch) && capabilities.torch.includes(true)),
      torchOn: settings.torch === true,
      zoom: nfeZoomRange(capabilities, settings),
    };
  }

  function diagnostics(event, extra = {}) {
    const capabilities = trackCapabilities(track);
    logNfeScanner(event, { camera: track.label, trackId: track.id,
      capabilities: { torch: capabilities.torch, zoom: capabilities.zoom },
      settings: trackSettings(track), effectiveConstraints: trackConstraints(track), ...extra });
  }

  function enqueue(operation) {
    // Include readback/fallback in the same operation so another request cannot
    // change settings between applyConstraints and verification.
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  }

  async function apply(next, context = {}) {
    if (stopped() || !track.applyConstraints) return { ok: false };
    try {
      await track.applyConstraints(next);
      if (stopped()) return { ok: false };
      constraints = next;
      diagnostics('camera constraints applied', { requestedConstraints: next, ...context });
      return { ok: true };
    } catch (error) {
      diagnostics('optional camera control unavailable', { requestedConstraints: next,
        error: { name: error?.name, message: error?.message }, ...context });
      return { ok: false, error };
    }
  }

  async function changeControl(key, requested, superseded = () => false) {
    const before = trackSettings(track)[key];
    const previous = key === 'torch' ? before === true : Number.isFinite(before) ? before : null;
    const failed = () => ({ ok: false, value: previous });
    if (stopped() || superseded()) return failed();
    const snapshot = constraints;
    let appliedAny = false;
    for (const variant of ['advanced', 'exact']) {
      if (stopped() || superseded()) return failed();
      const next = variant === 'advanced'
        ? mergeCameraConstraints(snapshot, {}, { [key]: requested })
        : mergeCameraConstraints(snapshot, { [key]: { exact: requested } });
      const result = await apply(next, { control: key, variant, requested });
      if (stopped()) return failed();
      appliedAny ||= result.ok;
      const effective = trackSettings(track)[key];
      const confirmed = key === 'torch'
        ? typeof effective === 'boolean' && effective === requested
        : Number.isFinite(effective) && (Math.abs(effective - requested) < 1e-6 || effective !== before);
      if (result.ok && confirmed) return { ok: true, value: effective };
      diagnostics('camera control not confirmed', { control: key, variant, requested, effective });
      if (['NotAllowedError', 'SecurityError', 'InvalidStateError', 'NotReadableError'].includes(result.error?.name)) break;
    }
    // Successful advanced constraints may have been ignored or cannot be verified.
    // Restore prior constraints; never use the requested value as a UI fallback.
    if (appliedAny && !stopped() && !superseded()) {
      const restore = key === 'torch' || Number.isFinite(before)
        ? mergeCameraConstraints(snapshot, {}, { [key]: previous }) : snapshot;
      await apply(restore, { control: key, variant: 'restore' });
    }
    return failed();
  }

  return {
    get torchSupported() { return state().torchSupported; },
    get zoom() { return state().zoom; },
    isActive: () => !stopped(),
    getState: state,
    configure() {
      return enqueue(async () => {
        if (stopped()) return;
        const capabilities = trackCapabilities(track);
        diagnostics('active camera controls');
        logNfeScanner('track capabilities', capabilities);
        const settings = trackSettings(track);
        const upgrade = nfeResolutionUpgrade(settings, capabilities);
        if (upgrade) {
          const applied = await apply(mergeCameraConstraints(constraints, upgrade));
          logNfeScanner('resolution improvement', { before: settings, requested: upgrade,
            applied: applied.ok, effective: trackSettings(track) });
        }
        for (const mode of ['focusMode', 'exposureMode', 'whiteBalanceMode']) {
          if (capabilities[mode]?.includes('continuous')) {
            const applied = await apply(mergeCameraConstraints(constraints, {}, { [mode]: 'continuous' }));
            logNfeScanner('continuous camera mode', { mode, applied: applied.ok, effective: trackSettings(track)[mode] });
          }
        }
      });
    },
    setTorch(enabled) {
      return enqueue(() => state().torchSupported
        ? changeControl('torch', Boolean(enabled)) : { ok: false });
    },
    setZoom(requested) {
      const revision = ++zoomRevision;
      return enqueue(() => {
        const zoom = state().zoom;
        if (!zoom || !Number.isFinite(requested) || revision !== zoomRevision) return { ok: false };
        const steps = Math.max(0, Math.min(Math.floor((zoom.max - zoom.min) / zoom.step + 1e-8),
          Math.round((requested - zoom.min) / zoom.step)));
        const value = Number((zoom.min + steps * zoom.step).toFixed(8));
        return changeControl('zoom', value, () => revision !== zoomRevision);
      });
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
