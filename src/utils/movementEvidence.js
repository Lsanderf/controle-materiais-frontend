import { SIGNATURE_FILE_NAME } from './signature.js';

export function createMovementFormData(movement, signature, photo) {
  if (!['RETIRADA', 'DEVOLUCAO'].includes(movement.tipo)) {
    throw new Error('Entradas devem ser registradas pela confirmação de uma nota fiscal.');
  }
  if (!signature?.size) throw new Error('Faça a assinatura antes de confirmar.');
  if (photo && movement.tipo !== 'DEVOLUCAO') {
    throw new Error('Foto do material é permitida apenas na devolução.');
  }
  const body = new FormData();
  body.append('movimentacao', new Blob([JSON.stringify(movement)], { type: 'application/json' }));
  body.append('assinatura', signature, SIGNATURE_FILE_NAME);
  if (photo) body.append('foto', photo, photo.name || 'foto.png');
  return body;
}
