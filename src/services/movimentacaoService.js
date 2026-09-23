import { apiBlobRequest, apiRequest } from './api';
import { createSignatureFormData } from '../utils/signature';
import { createMovementFormData } from '../utils/movementEvidence';

export const movimentacaoService = {
  list: () => apiRequest('/movimentacoes'),
  get: (id) => apiRequest(`/movimentacoes/${id}`),
  getReceipt: (id) => apiRequest(`/movimentacoes/${id}/comprovante`),
  getEvidenceFile: (path) => apiBlobRequest(path),
  uploadSignature: (id, signature) =>
    apiRequest(`/movimentacoes/${id}/assinatura`, {
      method: 'POST',
      body: createSignatureFormData(signature),
    }),
  estornar: (id, justificativa, idempotencyKey) =>
    apiRequest(`/movimentacoes/${id}/estorno`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: { justificativa },
    }),
  byEncarregado: (id) => apiRequest(`/movimentacoes/encarregado/${id}`),
  byContrato: (id) => apiRequest(`/movimentacoes/contrato/${id}`),
  byMaterial: (id) => apiRequest(`/movimentacoes/material/${id}`),
  create: (movement, signature, photo) =>
    apiRequest('/movimentacoes', {
      method: 'POST', body: createMovementFormData(movement, signature, photo),
    }),
};
