import { apiRequest } from './api';

export const usuarioService = {
  list: () => apiRequest('/usuarios'),
  listEncarregados: () => apiRequest('/usuarios/encarregados'),
  get: (id) => apiRequest(`/usuarios/${id}`),
  create: (usuario) =>
    apiRequest('/usuarios', { method: 'POST', body: usuario }),
  createEncarregado: (usuario) =>
    apiRequest('/usuarios/encarregados', { method: 'POST', body: usuario }),
  updateEncarregado: (id, encarregado) =>
    apiRequest(`/usuarios/encarregados/${id}`, { method: 'PUT', body: encarregado }),
  activateEncarregado: (id) =>
    apiRequest(`/usuarios/encarregados/${id}/ativar`, { method: 'PATCH' }),
  deactivateEncarregado: (id) =>
    apiRequest(`/usuarios/encarregados/${id}/desativar`, { method: 'PATCH' }),
  update: (id, usuario) =>
    apiRequest(`/usuarios/${id}`, { method: 'PUT', body: usuario }),
  activate: (id) =>
    apiRequest(`/usuarios/${id}/ativar`, { method: 'PATCH' }),
  deactivate: (id) =>
    apiRequest(`/usuarios/${id}/desativar`, { method: 'PATCH' }),
};
