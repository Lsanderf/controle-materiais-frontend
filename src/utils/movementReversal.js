const REVERSIBLE_TYPES = new Set(['RETIRADA', 'DEVOLUCAO']);

export function canReverseMovement(movement, role) {
  return role === 'ADMIN'
    && REVERSIBLE_TYPES.has(movement?.tipo)
    && !movement?.estornada;
}

export function normalizeReversalJustification(value) {
  const normalized = value?.trim() ?? '';
  if (!normalized) throw new Error('Informe a justificativa do estorno.');
  if (normalized.length > 1000) {
    throw new Error('A justificativa deve possuir no máximo 1.000 caracteres.');
  }
  return normalized;
}
