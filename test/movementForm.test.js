import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateReturnBalance,
  selectableMovementLinks,
} from '../src/utils/movementForm.js';

const links = [
  { id: 1, nome: 'Ativo', ativo: true },
  { id: 2, nome: 'Inativo', ativo: false },
];

test('retirada disponibiliza somente funcionário e contrato ativos', () => {
  assert.deepEqual(
    selectableMovementLinks(links, 'RETIRADA').map(({ id }) => id),
    [1],
  );
});

test('devolução disponibiliza vínculos existentes mesmo quando inativos', () => {
  assert.deepEqual(
    selectableMovementLinks(links, 'DEVOLUCAO').map(({ id }) => id),
    [1, 2],
  );
});

test('saldo de devolução preserva os efeitos dos estornos da RN-14', () => {
  const movements = [
    { material: 'Cabo', contrato: 'Obra', tipo: 'RETIRADA', quantidade: 10 },
    { material: 'Cabo', contrato: 'Obra', tipo: 'DEVOLUCAO', quantidade: 4 },
    { material: 'Cabo', contrato: 'Obra', tipo: 'ESTORNO_RETIRADA', quantidade: 2 },
    { material: 'Cabo', contrato: 'Obra', tipo: 'ESTORNO_DEVOLUCAO', quantidade: 1 },
    { material: 'Outro', contrato: 'Obra', tipo: 'RETIRADA', quantidade: 99 },
    { material: 'Cabo', contrato: 'Outro', tipo: 'RETIRADA', quantidade: 99 },
  ];

  assert.equal(calculateReturnBalance(movements, 'Cabo', 'Obra'), 5);
});
