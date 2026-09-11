const SIGNABLE_MOVEMENT_TYPES = new Set(['RETIRADA', 'DEVOLUCAO']);
const SIGNATURE_MANAGER_ROLES = new Set(['ADMIN', 'OPERADOR']);

export const SIGNATURE_FILE_NAME = 'assinatura.png';
export const SIGNATURE_CONTENT_TYPE = 'image/png';

export function hasSignature(receipt) {
  return Boolean(
    receipt?.evidencias?.some((evidence) => evidence.tipo === 'ASSINATURA'),
  );
}

export function canAddSignature(receipt, role) {
  return (
    SIGNABLE_MOVEMENT_TYPES.has(receipt?.tipo) &&
    SIGNATURE_MANAGER_ROLES.has(role) &&
    !hasSignature(receipt)
  );
}

export function canSubmitSignature(hasInk, saving) {
  return Boolean(hasInk) && !saving;
}

export function isSignatureConflict(error) {
  return error?.status === 409;
}

export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    if (!canvas?.toBlob) {
      reject(new Error('O navegador não oferece suporte à captura da assinatura.'));
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Não foi possível gerar a imagem da assinatura.'));
        return;
      }
      resolve(blob);
    }, SIGNATURE_CONTENT_TYPE);
  });
}

export function createSignatureFormData(blob) {
  const formData = new FormData();
  formData.append('arquivo', blob, SIGNATURE_FILE_NAME);
  return formData;
}
