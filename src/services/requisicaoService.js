import { apiRequest } from './api';

export const requisicaoService = {
  list: (role) => {
    if (role === 'ENCARREGADO') return apiRequest('/requisicoes/minhas');
    if (role === 'OPERADOR') return apiRequest('/requisicoes/pendentes');
    return apiRequest('/requisicoes');
  },
  get: (id) => apiRequest(`/requisicoes/${id}`),
  create: (requisicao) => apiRequest('/requisicoes', {
    method: 'POST', body: requisicao,
  }),
  finalizar: (id) => apiRequest(`/requisicoes/${id}/finalizar-atendimento`, {
    method: 'POST',
  }),
  confirmar: (id) => apiRequest(`/requisicoes/${id}/confirmar`, {
    method: 'POST',
  }),
};
