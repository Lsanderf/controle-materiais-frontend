import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('serviço usa as coleções por perfil e as transições explícitas da requisição', () => {
  const service = source('../src/services/requisicaoService.js');

  assert.match(service, /\/requisicoes\/minhas/);
  assert.match(service, /\/requisicoes\/pendentes/);
  assert.match(service, /finalizar-atendimento/);
  assert.match(service, /\/confirmar/);
});

test('tela mantém retirada e finalização como ações separadas', () => {
  const page = source('../src/pages/RequisitionsPage.jsx');

  assert.match(page, /Registrar retirada/);
  assert.match(page, /Finalizar atendimento/);
  assert.match(page, /Confirmar recebimento/);
  assert.match(page, /ConfirmDialog/);
});

test('cadastro permite criar encarregado e contrato sem perder a requisição', () => {
  const page = source('../src/pages/RequisitionFormPage.jsx');

  assert.match(page, /<EncarregadoForm/);
  assert.match(page, /\+ Novo encarregado/);
  assert.match(page, /\+ Novo contrato/);
  assert.match(page, /encarregadoId: String\(created\.id\)/);
  assert.match(page, /contratoId: String\(created\.id\)/);
});
