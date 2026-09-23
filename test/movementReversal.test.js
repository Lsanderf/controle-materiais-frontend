import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  canReverseMovement,
  normalizeReversalJustification,
} from '../src/utils/movementReversal.js';

test('somente ADMIN pode estornar retirada ou devolução ainda não estornada', () => {
  for (const tipo of ['RETIRADA', 'DEVOLUCAO']) {
    assert.equal(canReverseMovement({ tipo, estornada: false }, 'ADMIN'), true);
    assert.equal(canReverseMovement({ tipo, estornada: false }, 'OPERADOR'), false);
    assert.equal(canReverseMovement({ tipo, estornada: false }, 'GERENTE'), false);
    assert.equal(canReverseMovement({ tipo, estornada: false }, 'ENCARREGADO'), false);
    assert.equal(canReverseMovement({ tipo, estornada: true }, 'ADMIN'), false);
  }
});

test('entrada e estornos nunca oferecem novo estorno', () => {
  for (const tipo of ['ENTRADA', 'ESTORNO_RETIRADA', 'ESTORNO_DEVOLUCAO']) {
    assert.equal(canReverseMovement({ tipo, estornada: false }, 'ADMIN'), false);
  }
});

test('justificativa é obrigatória, normalizada e limitada', () => {
  assert.equal(
    normalizeReversalJustification('  Quantidade incorreta  '),
    'Quantidade incorreta',
  );
  assert.throws(() => normalizeReversalJustification('   '), /justificativa/);
  assert.throws(() => normalizeReversalJustification('a'.repeat(1001)), /1\.000/);
});

test('serviço envia estorno no endpoint dedicado com chave de idempotência', () => {
  const source = readFileSync(
    new URL('../src/services/movimentacaoService.js', import.meta.url),
    'utf8',
  );

  assert.match(source, /`\/movimentacoes\/\$\{id\}\/estorno`/);
  assert.match(source, /'Idempotency-Key': idempotencyKey/);
  assert.match(source, /body: \{ justificativa \}/);
});
