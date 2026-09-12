export const NFE_ACCESS_KEY_LENGTH = 44;
export const NFE_ACCESS_KEY_WITHOUT_DV_LENGTH = NFE_ACCESS_KEY_LENGTH - 1;
export const INVALID_NFE_ACCESS_KEY_MESSAGE =
  'Chave de acesso da NF-e inválida. Verifique os números informados.';

export function calculateNfeCheckDigit(accessKeyWithoutDv) {
  const value = String(accessKeyWithoutDv ?? '');
  if (!/^\d{43}$/.test(value)) {
    throw new Error('A chave sem DV deve conter exatamente 43 dígitos.');
  }

  let sum = 0;
  let weight = 2;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    sum += Number(value[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const checkDigit = 11 - (sum % 11);
  return checkDigit === 10 || checkDigit === 11 ? 0 : checkDigit;
}

export function inspectNfeAccessKey(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  const hasValidLength = digits.length === NFE_ACCESS_KEY_LENGTH;
  const hasValidCheckDigit =
    hasValidLength &&
    calculateNfeCheckDigit(digits.slice(0, NFE_ACCESS_KEY_WITHOUT_DV_LENGTH)) ===
      Number(digits.at(-1));

  return {
    digits,
    hasValidLength,
    hasValidCheckDigit,
    isValid: hasValidLength && hasValidCheckDigit,
  };
}

export function isValidNfeAccessKey(value) {
  return inspectNfeAccessKey(value).isValid;
}

export function normalizeNfeBarcode(value) {
  const validation = inspectNfeAccessKey(value);
  return validation.isValid ? validation.digits : null;
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
      const validation = inspectNfeAccessKey(value);
      if (!validation.isValid) {
        onInvalid?.(
          validation.hasValidLength ? 'INVALID_CHECK_DIGIT' : 'INVALID_LENGTH',
        );
        return false;
      }

      accepted = true;
      stop();
      onDetected(validation.digits);
      return true;
    },

    stop,
    isAccepted: () => accepted,
    isStopped: () => stopped,
  };
}
