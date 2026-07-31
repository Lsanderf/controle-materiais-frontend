export function parseBackendDate(value) {
  if (!value) return 0;
  const match = value.match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/,
  );
  if (!match) return 0;
  const [, day, month, year, hour, minute] = match;
  return new Date(year, month - 1, day, hour, minute).getTime();
}

export function sortMovementsNewestFirst(movements) {
  return [...movements].sort(
    (a, b) =>
      parseBackendDate(b.dataMovimentacao) -
        parseBackendDate(a.dataMovimentacao) || b.id - a.id,
  );
}

export function movementLabel(type) {
  return {
    ENTRADA: 'Entrada',
    RETIRADA: 'Retirada',
    DEVOLUCAO: 'Devolução',
  }[type] ?? type;
}

export function roleLabel(role) {
  return {
    ADMIN: 'Administrador',
    OPERADOR: 'Operador',
    CONSULTA: 'Consulta',
  }[role] ?? role;
}

export function onlyDigits(value) {
  return value.replace(/\D/g, '');
}

export function formatCpf(value) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
