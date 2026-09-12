import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cameraAccessErrorMessage,
  createNfeScanSession,
  releaseVideoStream,
} from '../utils/nfeBarcode';
import {
  createNfeCameraControls,
  logNfeVideoDimensions,
  openNfeCamera,
  stopCameraStream,
} from '../utils/nfeCamera';
import { logNfeScannerError } from '../utils/nfeScannerDebug';

const INVALID_BARCODE_MESSAGES = {
  INVALID_LENGTH:
    'Código detectado, mas não corresponde a uma chave NF-e.',
  INVALID_CHECK_DIGIT:
    'Chave NF-e detectada, mas o dígito verificador é inválido. Tente novamente.',
};

function unsupportedCameraError() {
  const error = new Error('Camera API unavailable');
  error.name = 'UnsupportedError';
  return error;
}

function insecureContextError() {
  const error = new Error('Secure context required');
  error.name = 'InsecureContextError';
  return error;
}

export default function NotaFiscalBarcodeScanner({ onDetected, onCancel }) {
  const videoRef = useRef(null);
  const guideRef = useRef(null);
  const cameraControlsRef = useRef(null);
  const zoomTimerRef = useRef(null);
  const zoomRevisionRef = useRef(0);
  const sessionRef = useRef(null);
  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const onDetectedRef = useRef(onDetected);
  const cancelButtonRef = useRef(null);
  const [starting, setStarting] = useState(true);
  const [fatalError, setFatalError] = useState('');
  const [scanNotice, setScanNotice] = useState('');
  const [cameras, setCameras] = useState([]);
  const [activeDeviceId, setActiveDeviceId] = useState('');
  const [cameraState, setCameraState] = useState(null);
  const [cameraNotice, setCameraNotice] = useState('');
  const [torchBusy, setTorchBusy] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const stopScanner = useCallback(() => {
    generationRef.current += 1;
    sessionRef.current?.stop();
    sessionRef.current = null;
    releaseVideoStream(videoRef.current);
  }, []);

  const startScanner = useCallback(async (deviceId) => {
    sessionRef.current?.stop();
    releaseVideoStream(videoRef.current);

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setStarting(true);
    setFatalError('');
    setScanNotice('');
    setCameraState(null);
    setCameraNotice('');
    setTorchBusy(false);
    setTipIndex(0);
    const video = videoRef.current;
    let stream;

    const session = createNfeScanSession({
      onDetected: (accessKey) => {
        if (!mountedRef.current || sessionRef.current !== session) return;
        onDetectedRef.current(accessKey);
      },
      onInvalid: (reason) => {
        if (mountedRef.current && sessionRef.current === session) {
          setScanNotice(INVALID_BARCODE_MESSAGES[reason]);
        }
      },
      onStop: () => {
        if (sessionRef.current === session) {
          cameraControlsRef.current = null;
          clearTimeout(zoomTimerRef.current);
          zoomRevisionRef.current += 1;
        }
        stopCameraStream(stream);
        // A late completion from an older session must not clear a new preview.
        if (stream && video?.srcObject === stream) releaseVideoStream(video);
      },
    });
    sessionRef.current = session;
    const isCancelled = () => !mountedRef.current ||
      generationRef.current !== generation || session.isStopped();
    function failScanner(error) {
      if (isCancelled()) return;
      logNfeScannerError('fatal camera/ZXing error', error);
      session.stop();
      setStarting(false);
      setFatalError(cameraAccessErrorMessage(error, window.isSecureContext));
    }

    try {
      if (window.isSecureContext === false) throw insecureContextError();
      if (!navigator.mediaDevices?.getUserMedia) throw unsupportedCameraError();

      const { createNfeBarcodeReader, handleNfeDecodeResult } =
        await import('../utils/nfeBarcodeReader');
      if (isCancelled()) return;

      const camera = await openNfeCamera({
        mediaDevices: navigator.mediaDevices,
        deviceId,
        isCancelled,
        onStream: (acquiredStream) => { stream = acquiredStream; },
      });
      if (isCancelled()) {
        stopCameraStream(stream);
        return;
      }
      setCameras(camera.devices);
      setActiveDeviceId(stream.getVideoTracks()[0]?.getSettings?.().deviceId || deviceId || '');
      const cameraControls = createNfeCameraControls(stream.getVideoTracks()[0], isCancelled);
      cameraControlsRef.current = cameraControls;
      await cameraControls.configure();
      if (isCancelled()) return;
      setCameraState(cameraControls.getState());

      video.srcObject = stream;
      const reader = createNfeBarcodeReader(video, guideRef.current);
      // We own the stream so cancellation also releases it while ZXing awaits
      // video playback. ZXing owns only its scan loop and capture canvas.
      const controls = await reader.decodeFromVideoElement(
        video,
        (result, error, callbackControls) => {
          session.attachControls(callbackControls);
          if (isCancelled()) return;
          handleNfeDecodeResult(session, result, error, failScanner);
        },
      );
      session.attachControls(controls);

      if (isCancelled()) {
        session.stop();
        return;
      }
      logNfeVideoDimensions(video);
      setStarting(false);
    } catch (error) {
      failScanner(error);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    cancelButtonRef.current?.focus();
    startScanner();

    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function cancelOnEscape(event) {
      if (event.key === 'Escape') {
        stopScanner();
        onCancel();
      }
    }
    window.addEventListener('keydown', cancelOnEscape);
    return () => window.removeEventListener('keydown', cancelOnEscape);
  }, [onCancel, stopScanner]);

  useEffect(() => {
    if (starting || fatalError) return;
    // Timed suggestions, not a claim to have measured focus, glare or distance.
    const timer = setInterval(() => setTipIndex((index) => index + 1), 5000);
    return () => clearInterval(timer);
  }, [starting, fatalError]);

  async function toggleTorch() {
    const controls = cameraControlsRef.current;
    if (!controls || torchBusy) return;
    setTorchBusy(true);
    const result = await controls.setTorch(!cameraState.torchOn);
    if (cameraControlsRef.current !== controls) return;
    setTorchBusy(false);
    setCameraState((state) => ({ ...state, torchOn: result.value ?? state.torchOn }));
    setCameraNotice(result.ok ? '' : 'Não foi possível alterar a lanterna. A leitura continua.');
  }

  function changeZoom(value) {
    const controls = cameraControlsRef.current;
    if (!controls) return;
    setCameraState((state) => ({ ...state, zoom: { ...state.zoom, value } }));
    clearTimeout(zoomTimerRef.current);
    const revision = ++zoomRevisionRef.current;
    zoomTimerRef.current = setTimeout(async () => {
      const result = await controls.setZoom(value);
      if (cameraControlsRef.current !== controls || revision !== zoomRevisionRef.current) return;
      const effective = result.value ?? controls.getState().zoom?.value;
      setCameraState((state) => ({ ...state, zoom: { ...state.zoom, value: effective } }));
      setCameraNotice(result.ok ? '' : 'Não foi possível ajustar o zoom. A leitura continua.');
    }, 180);
  }

  const tips = ['Aproxime um pouco', 'Afaste um pouco', 'Evite reflexos'];
  if (cameraState?.torchSupported && !cameraState.torchOn) tips.push('Use a lanterna se necessário');

  function cancelScanner() {
    stopScanner();
    onCancel();
  }

  function switchCamera() {
    if (starting || cameras.length < 2) return;
    const currentIndex = cameras.findIndex(
      (camera) => camera.deviceId === activeDeviceId,
    );
    const nextCamera = cameras[(currentIndex + 1) % cameras.length];
    setActiveDeviceId(nextCamera.deviceId);
    startScanner(nextCamera.deviceId);
  }

  return (
    <div
      className="dialog-backdrop barcode-scanner-backdrop"
      role="presentation"
      onMouseDown={cancelScanner}
    >
      <section
        className="dialog barcode-scanner-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="barcode-scanner-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="barcode-scanner-header">
          <span className="eyebrow">Leitura pela câmera</span>
          <h2 id="barcode-scanner-title">Escanear NF-e</h2>
          <p>
            Aproxime ou afaste até que todo o código de barras apareça dentro da área,
            incluindo as margens laterais.
          </p>
        </header>

        <div className="barcode-video-frame">
          <video
            ref={videoRef}
            className="barcode-video"
            muted
            playsInline
            autoPlay
            onLoadedMetadata={(event) => logNfeVideoDimensions(event.currentTarget)}
            onResize={(event) => logNfeVideoDimensions(event.currentTarget)}
            aria-label="Visualização da câmera para leitura do código de barras"
          />
          <span ref={guideRef} className="barcode-target" aria-hidden="true" />
          {starting && !fatalError && (
            <div className="barcode-video-state" role="status">
              <span className="spinner" aria-hidden="true" />
              Iniciando câmera...
            </div>
          )}
          {fatalError && (
            <div className="barcode-video-state barcode-video-error" role="alert">
              {fatalError}
            </div>
          )}
        </div>

        {!starting && !fatalError && (
          <>
            <p className="barcode-scan-notice" role="status">
              {scanNotice || 'Procurando código...'}
            </p>
            <p className="barcode-scan-tip">Dica: {tips[tipIndex % tips.length]}</p>
            <div className="barcode-camera-controls">
              {cameraState?.torchSupported && (
                <button
                  className="button button-secondary"
                  type="button"
                  aria-pressed={cameraState.torchOn}
                  onClick={toggleTorch}
                  disabled={torchBusy}
                >
                  {cameraState.torchOn ? 'Desativar lanterna' : 'Ativar lanterna'}
                </button>
              )}
              {cameraState?.zoom && (
                <label className="barcode-zoom">
                  <span>Zoom: {cameraState.zoom.value.toFixed(1)}×</span>
                  <input
                    type="range"
                    aria-label="Zoom da câmera"
                    min={cameraState.zoom.min}
                    max={cameraState.zoom.max}
                    step={cameraState.zoom.step}
                    value={cameraState.zoom.value}
                    onChange={(event) => changeZoom(Number(event.target.value))}
                  />
                </label>
              )}
            </div>
            {cameraNotice && <p className="barcode-scan-notice" role="status">{cameraNotice}</p>}
          </>
        )}

        <div className="barcode-scanner-actions">
          <button
            ref={cancelButtonRef}
            className="button button-secondary"
            type="button"
            onClick={cancelScanner}
          >
            Cancelar
          </button>
          {fatalError ? (
            <button
              className="button button-primary"
              type="button"
              onClick={() => startScanner(activeDeviceId)}
            >
              Tentar novamente
            </button>
          ) : (
            cameras.length > 1 && (
              <button
                className="button button-primary"
                type="button"
                onClick={switchCamera}
                disabled={starting}
              >
                Trocar câmera
              </button>
            )
          )}
        </div>
      </section>
    </div>
  );
}
