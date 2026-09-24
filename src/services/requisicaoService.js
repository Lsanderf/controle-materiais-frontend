import { apiRequest } from './api';

export const requisicaoService = {
  list: () => apiRequest('/requisicoes'),
  get: (id) => apiRequest(`/requisicoes/${id}`),
  create: (requisicao) => apiRequest('/requisicoes', { method: 'POST', body: requisicao }),
  visualizar: (id) => apiRequest(`/requisicoes/${id}/visualizar`, { method: 'PATCH' }),
  concluir: (id) => apiRequest(`/requisicoes/${id}/concluir`, { method: 'PATCH' }),
  cancelar: (id) => apiRequest(`/requisicoes/${id}/cancelar`, { method: 'PATCH' }),
};
