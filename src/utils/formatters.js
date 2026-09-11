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

function parseLocalDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/,
  );

  if (match) {
    const [, year, month, day, hour, minute, second = '0', fraction = ''] =
      match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(fraction.padEnd(3, '0').slice(0, 3)),
    );
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateTime(value) {
  const date = parseLocalDateTime(value);
  if (!date || Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function formatInactivationDate(record) {
  if (record?.ativo !== false) return '—';
  return formatDateTime(record.dataInativacao) ?? 'Não disponível';
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
