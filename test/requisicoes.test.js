import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatRequisicaoDate, requisicaoTipoLabel } from '../src/utils/requisicoes.js';

test('rótulos de requisição distinguem retirada e devolução', () => {
  assert.equal(requisicaoTipoLabel('RETIRADA'), 'Retirada');
  assert.equal(requisicaoTipoLabel('DEVOLUCAO'), 'Devolução');
  assert.match(formatRequisicaoDate('2026-09-24T10:30:00'), /24\/09\/2026/);
});

test('telas usam endpoint próprio de requisições e não movimentações', () => {
  const service = readFileSync(new URL('../src/services/requisicaoService.js', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/pages/RequisicoesPage.jsx', import.meta.url), 'utf8');
  const movementForm = readFileSync(new URL('../src/pages/MovementFormPage.jsx', import.meta.url), 'utf8');
  assert.match(service, /'\/requisicoes'/);
  assert.match(service, /\/visualizar/);
  assert.match(service, /\/concluir/);
  assert.doesNotMatch(page, /movimentacaoService/);
  assert.doesNotMatch(page, /materialService/);
  assert.doesNotMatch(page, /materialId/);
  assert.match(page, /\+ Criar contrato/);
  assert.match(page, /\+ Criar material/);
  assert.match(page, /descricao/);
  assert.match(movementForm, /\['ADMIN', 'OPERADOR'\]/);
});
