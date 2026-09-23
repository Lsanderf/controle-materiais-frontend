import { onlyDigits } from './formatters.js';
import { filterBySearchAndStatus } from './listFilters.js';

export const ENCARREGADOS_ACCESS_ROLES = [
  'ADMIN',
  'OPERADOR',
  'GERENTE',
];

export const ENCARREGADOS_CREATE_ROLES = ['ADMIN', 'GERENTE'];

export function canAccessEncarregados(role) {
  return ENCARREGADOS_ACCESS_ROLES.includes(role);
}

export function canCreateEncarregado(role) {
  return ENCARREGADOS_CREATE_ROLES.includes(role);
}

export function buildEncarregadoPayload(form) {
  return {
    nome: form.nome.trim(),
    cpf: onlyDigits(form.cpf),
    celular: onlyDigits(form.celular),
    username: form.username.trim(),
    password: form.password,
  };
}

export function encarregadoSearchValues(encarregado) {
  return [
    encarregado.nome,
    encarregado.username,
    encarregado.celular,
  ];
}

export function filterEncarregados(encarregados, search, status) {
  return filterBySearchAndStatus(
    encarregados,
    search,
    status,
    encarregadoSearchValues,
  );
}
