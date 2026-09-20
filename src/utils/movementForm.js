const BALANCE_EFFECT = {
  RETIRADA: 1,
  DEVOLUCAO: -1,
  ESTORNO_RETIRADA: -1,
  ESTORNO_DEVOLUCAO: 1,
};

export function selectableMovementLinks(records = [], type) {
  if (type === 'DEVOLUCAO') return records;
  return records.filter((record) => record.ativo);
}

export function calculateReturnBalance(movements = [], materialName, contractName) {
  return movements
    .filter(
      (movement) =>
        movement.material === materialName && movement.contrato === contractName,
    )
    .reduce(
      (balance, movement) =>
        balance + (BALANCE_EFFECT[movement.tipo] ?? 0) * movement.quantidade,
      0,
    );
}
