import { apiRequest } from './api';

export const usuarioService = {
  list: () => apiRequest('/usuarios'),
  get: (id) => apiRequest(`/usuarios/${id}`),
  create: (usuario) =>
    apiRequest('/usuarios', { method: 'POST', body: usuario }),
  update: (id, usuario) =>
    apiRequest(`/usuarios/${id}`, { method: 'PUT', body: usuario }),
  activate: (id) =>
    apiRequest(`/usuarios/${id}/ativar`, { method: 'PATCH' }),
  deactivate: (id) =>
    apiRequest(`/usuarios/${id}/desativar`, { method: 'PATCH' }),
};
