import { apiRequest } from './api';

export const notaFiscalService = {
  list: () => apiRequest('/notas-fiscais'),
  get: (id) => apiRequest(`/notas-fiscais/${id}`),
  create: (notaFiscal) =>
    apiRequest('/notas-fiscais', { method: 'POST', body: notaFiscal }),
  update: (id, notaFiscal) =>
    apiRequest(`/notas-fiscais/${id}`, {
      method: 'PUT',
      body: notaFiscal,
    }),
  confirm: (id) =>
    apiRequest(`/notas-fiscais/${id}/confirmar`, { method: 'POST' }),
};
