import { apiRequest } from './api';

export const solicitacaoRetiradaService = {
  list: () => apiRequest('/solicitacoes-retirada'),
  get: (id) => apiRequest(`/solicitacoes-retirada/${id}`),
  create: (request, idempotencyKey) => apiRequest('/solicitacoes-retirada', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: request,
  }),
  cancel: (id) => apiRequest(`/solicitacoes-retirada/${id}/cancelar`, { method: 'PATCH' }),
  confirm: (id, assinatura) => {
    const body = new FormData();
    body.append('assinatura', assinatura, 'assinatura.png');
    return apiRequest(`/solicitacoes-retirada/${id}/confirmar`, { method: 'POST', body });
  },
};
