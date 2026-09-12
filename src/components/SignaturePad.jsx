import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorMessage } from './Feedback';
import {
  canvasToPngBlob,
  canSubmitSignature,
} from '../utils/signature';

const MAX_PIXEL_RATIO = 2;

function prepareContext(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));

  if (canvas.width !== width || canvas.height !== height) {
    const snapshot = document.createElement('canvas');
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    if (canvas.width && canvas.height) {
      snapshot.getContext('2d').drawImage(canvas, 0, 0);
    }

    canvas.width = width;
    canvas.height = height;
    const resizedContext = canvas.getContext('2d');
    resizedContext.fillStyle = '#ffffff';
    resizedContext.fillRect(0, 0, width, height);
    if (snapshot.width && snapshot.height) {
      resizedContext.drawImage(snapshot, 0, 0, width, height);
    }
  }

  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.strokeStyle = '#172033';
  context.fillStyle = '#172033';
  context.lineWidth = 2.5;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  return context;
}

export default function SignaturePad({
  employeeName,
  saving = false,
  error = null,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirmar assinatura',
  savingLabel = 'Salvando assinatura...',
  summary,
  children,
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const submittingRef = useRef(false);
  const [capturing, setCapturing] = useState(false);
  const busy = saving || capturing;
  const [hasInk, setHasInk] = useState(false);
  const [captureError, setCaptureError] = useState(null);

  const resizeCanvas = useCallback(() => {
    if (canvasRef.current) prepareContext(canvasRef.current);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
    setHasInk(false);
    setCaptureError(null);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    cancelButtonRef.current?.focus();

    return () => {
      observer.disconnect();
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [resizeCanvas]);

  function pointFromEvent(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function startDrawing(event) {
    if (busy || event.button > 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;

    const point = pointFromEvent(event);
    lastPointRef.current = point;
    const context = prepareContext(event.currentTarget);
    context.beginPath();
    context.arc(point.x, point.y, 1.25, 0, Math.PI * 2);
    context.fill();
    setHasInk(true);
    setCaptureError(null);
  }

  function continueDrawing(event) {
    if (!drawingRef.current || busy) return;
    event.preventDefault();

    const point = pointFromEvent(event);
    const previous = lastPointRef.current ?? point;
    const context = prepareContext(event.currentTarget);
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
  }

  function stopDrawing(event) {
    if (!drawingRef.current) return;
    event.preventDefault();
    drawingRef.current = false;
    lastPointRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function confirmSignature() {
    if (submittingRef.current) return;
    if (!canSubmitSignature(hasInk, busy)) {
      setCaptureError(new Error('Faça a assinatura antes de confirmar.'));
      return;
    }

    setCaptureError(null);
    submittingRef.current = true;
    setCapturing(true);
    try {
      const blob = await canvasToPngBlob(canvasRef.current);
      await onConfirm(blob);
    } catch (conversionError) {
      setCaptureError(conversionError);
    } finally {
      submittingRef.current = false;
      setCapturing(false);
    }
  }

  return (
      <dialog
        ref={dialogRef}
        className="dialog signature-dialog"
        aria-modal="true"
        aria-labelledby="signature-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) onCancel();
        }}
      >
        <div className="signature-dialog-body">
        <header className="signature-dialog-header">
          <span className="eyebrow">Comprovação da movimentação</span>
          <h2 id="signature-dialog-title">Assinatura do responsável</h2>
          <p>
            Assine dentro da área abaixo
            {employeeName ? ` — ${employeeName}` : ''}.
          </p>
        </header>

        {summary}
        <ErrorMessage error={captureError ?? error} />

        <div className="signature-canvas-frame">
          <canvas
            ref={canvasRef}
            className="signature-canvas"
            aria-label="Área para desenhar a assinatura"
            onPointerDown={startDrawing}
            onPointerMove={continueDrawing}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
          />
          {!hasInk && (
            <span className="signature-placeholder" aria-hidden="true">
              Assine aqui
            </span>
          )}
          <span className="signature-line" aria-hidden="true" />
        </div>

        <div className="signature-secondary-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={clearCanvas}
            disabled={!hasInk || busy}
          >
            Limpar
          </button>
        </div>

        {children && <fieldset className="signature-extra" disabled={busy}>{children}</fieldset>}
        </div>
        <footer className="signature-dialog-actions">
          <button
            ref={cancelButtonRef}
            className="button button-secondary"
            type="button"
            onClick={onCancel}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={confirmSignature}
            disabled={!canSubmitSignature(hasInk, busy)}
          >
            {busy ? savingLabel : confirmLabel}
          </button>
        </footer>
      </dialog>
  );
}
