import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cameraAccessErrorMessage,
  createNfeScanSession,
  releaseVideoStream,
} from '../utils/nfeBarcode';

const INVALID_BARCODE_MESSAGE =
  'Código detectado não corresponde a uma chave NF-e de 44 dígitos.';

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

    const session = createNfeScanSession({
      onDetected: (accessKey) => {
        if (!mountedRef.current || sessionRef.current !== session) return;
        onDetectedRef.current(accessKey);
      },
      onInvalid: () => {
        if (mountedRef.current && sessionRef.current === session) {
          setScanNotice(INVALID_BARCODE_MESSAGE);
        }
      },
      onStop: () => releaseVideoStream(videoRef.current),
    });
    sessionRef.current = session;

    try {
      if (window.isSecureContext === false) throw insecureContextError();
      if (!navigator.mediaDevices?.getUserMedia) throw unsupportedCameraError();

      const {
        BarcodeFormat,
        BrowserCodeReader,
        BrowserMultiFormatReader,
      } = await import('@zxing/browser');
      if (
        !mountedRef.current ||
        generationRef.current !== generation ||
        session.isStopped()
      ) {
        return;
      }

      const reader = new BrowserMultiFormatReader(undefined, {
        delayBetweenScanAttempts: 250,
        delayBetweenScanSuccess: 400,
      });
      reader.possibleFormats = [BarcodeFormat.CODE_128];

      const controls = await reader.decodeFromVideoDevice(
        deviceId || undefined,
        videoRef.current,
        (result, _error, callbackControls) => {
          if (sessionRef.current !== session) return;
          session.attachControls(callbackControls);
          if (
            result &&
            result.getBarcodeFormat() === BarcodeFormat.CODE_128
          ) {
            session.handleDetection(result.getText());
          }
        },
      );
      session.attachControls(controls);

      if (
        !mountedRef.current ||
        generationRef.current !== generation ||
        session.isStopped()
      ) {
        session.stop();
        return;
      }

      setStarting(false);

      try {
        const devices = await BrowserCodeReader.listVideoInputDevices();
        if (!mountedRef.current || generationRef.current !== generation) return;
        setCameras(devices);
        const selectedDevice = videoRef.current?.srcObject
          ?.getVideoTracks?.()[0]
          ?.getSettings?.().deviceId;
        setActiveDeviceId(selectedDevice || deviceId || devices[0]?.deviceId || '');
      } catch {
        // A leitura pode continuar mesmo que o navegador não permita enumerar câmeras.
      }
    } catch (error) {
      if (!mountedRef.current || generationRef.current !== generation) return;
      session.stop();
      setStarting(false);
      setFatalError(cameraAccessErrorMessage(error, window.isSecureContext));
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
          <p>Aponte a câmera para o código de barras do DANFE.</p>
        </header>

        <div className="barcode-video-frame">
          <video
            ref={videoRef}
            className="barcode-video"
            muted
            playsInline
            aria-label="Visualização da câmera para leitura do código de barras"
          />
          <span className="barcode-target" aria-hidden="true" />
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

        {scanNotice && !fatalError && (
          <p className="barcode-scan-notice" role="status">
            {scanNotice}
          </p>
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
