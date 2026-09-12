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
  importXml: (arquivo, { chaveAcessoInformada, notaFiscalId } = {}) => {
    const body = new FormData();
    body.append('arquivo', arquivo);
    if (chaveAcessoInformada) {
      body.append('chaveAcessoInformada', chaveAcessoInformada);
    }
    if (notaFiscalId) {
      body.append('notaFiscalId', String(notaFiscalId));
    }
    return apiRequest('/notas-fiscais/importar-xml', {
      method: 'POST',
      body,
    });
  },
  confirm: (id) =>
    apiRequest(`/notas-fiscais/${id}/confirmar`, { method: 'POST' }),
};
