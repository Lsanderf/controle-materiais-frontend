import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('serviço consulta comprovante e arquivo de evidência nos endpoints reais', () => {
  const source = readFileSync(
    new URL('../src/services/movimentacaoService.js', import.meta.url),
    'utf8',
  );

  assert.match(source, /`\/movimentacoes\/\$\{id\}\/comprovante`/);
  assert.match(source, /apiBlobRequest\(path\)/);
});

test('histórico oferece a ação Ver comprovante e abre o modal', () => {
  const source = readFileSync(
    new URL('../src/pages/HistoryPage.jsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /Ver comprovante/);
  assert.match(source, /<MovementReceiptModal/);
});

test('modal mostra dados imutáveis, NF e assinatura sem expor CPF', () => {
  const source = readFileSync(
    new URL('../src/components/MovementReceiptModal.jsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /Registro imutável/);
  assert.match(source, /Nota Fiscal/);
  assert.match(source, /Assinatura do funcionário/);
  assert.doesNotMatch(source, /funcionario\?\.cpf/);
});

test('retirada e devolução aceitam observação opcional no formulário', () => {
  const source = readFileSync(
    new URL('../src/pages/MovementFormPage.jsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /Observacao \(opcional\)/);
  assert.match(source, /observacao: form\.observacao\.trim\(\)/);
});
