import { apiRequest } from './api';

export const funcionarioService = {
  list: () => apiRequest('/funcionarios'),
  get: (id) => apiRequest(`/funcionarios/${id}`),
  create: (funcionario) =>
    apiRequest('/funcionarios', { method: 'POST', body: funcionario }),
  update: (id, funcionario) =>
    apiRequest(`/funcionarios/${id}`, {
      method: 'PUT',
      body: funcionario,
    }),
  activate: (id) =>
    apiRequest(`/funcionarios/${id}/ativar`, { method: 'PATCH' }),
  deactivate: (id) =>
    apiRequest(`/funcionarios/${id}/desativar`, { method: 'PATCH' }),
};
