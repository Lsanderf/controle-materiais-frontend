import { apiRequest } from './api';

export const movimentacaoService = {
  list: () => apiRequest('/movimentacoes'),
  get: (id) => apiRequest(`/movimentacoes/${id}`),
  byFuncionario: (id) => apiRequest(`/movimentacoes/funcionario/${id}`),
  byContrato: (id) => apiRequest(`/movimentacoes/contrato/${id}`),
  byMaterial: (id) => apiRequest(`/movimentacoes/material/${id}`),
  create: (movement) =>
    apiRequest('/movimentacoes', { method: 'POST', body: movement }),
};
