import { apiBlobRequest, apiRequest } from './api';
import { createSignatureFormData } from '../utils/signature';

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
  byFuncionario: (id) => apiRequest(`/movimentacoes/funcionario/${id}`),
  byContrato: (id) => apiRequest(`/movimentacoes/contrato/${id}`),
  byMaterial: (id) => apiRequest(`/movimentacoes/material/${id}`),
  create: (movement) =>
    apiRequest('/movimentacoes', { method: 'POST', body: movement }),
};
