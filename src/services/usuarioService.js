import { apiRequest } from './api';

export const usuarioService = {
  list: () => apiRequest('/usuarios'),
  listEncarregados: () => apiRequest('/usuarios/encarregados'),
  get: (id) => apiRequest(`/usuarios/${id}`),
  create: (usuario) =>
    apiRequest('/usuarios', { method: 'POST', body: usuario }),
  createEncarregado: (usuario) =>
    apiRequest('/usuarios/encarregados', { method: 'POST', body: usuario }),
  update: (id, usuario) =>
    apiRequest(`/usuarios/${id}`, { method: 'PUT', body: usuario }),
  activate: (id) =>
    apiRequest(`/usuarios/${id}/ativar`, { method: 'PATCH' }),
  deactivate: (id) =>
    apiRequest(`/usuarios/${id}/desativar`, { method: 'PATCH' }),
};
