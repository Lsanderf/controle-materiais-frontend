import { apiRequest } from './api';

export const materialService = {
  list: () => apiRequest('/materiais'),
  get: (id) => apiRequest(`/materiais/${id}`),
  create: (material) =>
    apiRequest('/materiais', { method: 'POST', body: material }),
  update: (id, material) =>
    apiRequest(`/materiais/${id}`, { method: 'PUT', body: material }),
};
