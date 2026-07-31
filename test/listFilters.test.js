import test from 'node:test';
import assert from 'node:assert/strict';
import { filterBySearchAndStatus } from '../src/utils/listFilters.js';

const records = [
  { id: 1, nome: 'João Silva', descricao: 'Obra Norte', ativo: true },
  { id: 2, nome: 'João Souza', descricao: 'Obra Sul', ativo: false },
  { id: 3, nome: 'Maria Lima', descricao: 'Obra Norte', ativo: false },
];

const values = (record) => [record.nome, record.descricao];

test('Todos mantém registros ativos e inativos', () => {
  assert.deepEqual(
    filterBySearchAndStatus(records, '', 'TODOS', values).map(({ id }) => id),
    [1, 2, 3],
  );
});

test('Ativos e Inativos usam o campo ativo', () => {
  assert.deepEqual(
    filterBySearchAndStatus(records, '', 'ATIVOS', values).map(({ id }) => id),
    [1],
  );
  assert.deepEqual(
    filterBySearchAndStatus(records, '', 'INATIVOS', values).map(({ id }) => id),
    [2, 3],
  );
});

test('pesquisa textual e filtro de status são combinados', () => {
  assert.deepEqual(
    filterBySearchAndStatus(records, 'joão', 'INATIVOS', values).map(
      ({ id }) => id,
    ),
    [2],
  );
});

test('pesquisa ignora diferenças entre maiúsculas e minúsculas', () => {
  assert.deepEqual(
    filterBySearchAndStatus(records, 'JOÃO', 'TODOS', values).map(
      ({ id }) => id,
    ),
    [1, 2],
  );
});
