export const NFE_ACCESS_KEY_LENGTH = 44;

export function normalizeNfeBarcode(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === NFE_ACCESS_KEY_LENGTH ? digits : null;
}

export function cameraAccessErrorMessage(error, secureContext) {
  if (secureContext === false || error?.name === 'InsecureContextError') {
    return 'A câmera exige uma conexão segura. Acesse o sistema por HTTPS ou use localhost durante o desenvolvimento.';
  }

  if (
    error?.name === 'NotAllowedError' ||
    error?.name === 'PermissionDeniedError' ||
    error?.name === 'SecurityError'
  ) {
    return 'Não foi possível acessar a câmera. Verifique a permissão do navegador.';
  }

  if (
    error?.name === 'NotFoundError' ||
    error?.name === 'DevicesNotFoundError'
  ) {
    return 'Nenhuma câmera compatível foi encontrada neste dispositivo.';
  }

  if (
    error?.name === 'NotReadableError' ||
    error?.name === 'TrackStartError' ||
    error?.name === 'AbortError'
  ) {
    return 'A câmera está indisponível ou sendo usada por outro aplicativo. Feche-o e tente novamente.';
  }

  if (error?.name === 'UnsupportedError') {
    return 'Este navegador não oferece suporte ao acesso à câmera.';
  }

  if (error?.name === 'OverconstrainedError') {
    return 'Não foi possível iniciar a câmera selecionada. Tente trocar de câmera.';
  }

  return 'Não foi possível inicializar a câmera. Verifique as permissões e tente novamente.';
}

export function releaseVideoStream(video) {
  const stream = video?.srcObject;
  stream?.getTracks?.().forEach((track) => track.stop());
  if (video) {
    video.pause?.();
    video.srcObject = null;
  }
}

export function createNfeScanSession({
  onDetected,
  onInvalid,
  onStop = () => {},
}) {
  let accepted = false;
  let stopped = false;
  let controls = null;

  function stopControls(nextControls) {
    try {
      nextControls?.stop?.();
    } catch {
      // A liberação do MediaStream continua no callback onStop.
    }
  }

  function stop() {
    if (stopped) return false;
    stopped = true;
    stopControls(controls);
    onStop();
    return true;
  }

  return {
    attachControls(nextControls) {
      if (!nextControls || controls === nextControls) return;
      controls = nextControls;
      if (stopped) stopControls(nextControls);
    },

    handleDetection(value) {
      if (accepted || stopped) return false;
      const accessKey = normalizeNfeBarcode(value);
      if (!accessKey) {
        onInvalid?.();
        return false;
      }

      accepted = true;
      stop();
      onDetected(accessKey);
      return true;
    },

    stop,
    isAccepted: () => accepted,
    isStopped: () => stopped,
  };
}
