import { apiRequest } from './api';

export const contratoService = {
  list: () => apiRequest('/contratos'),
  get: (id) => apiRequest(`/contratos/${id}`),
  create: (contrato) =>
    apiRequest('/contratos', { method: 'POST', body: contrato }),
  update: (id, contrato) =>
    apiRequest(`/contratos/${id}`, { method: 'PUT', body: contrato }),
};
