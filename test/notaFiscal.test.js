import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildNotaFiscalPayload,
  canConfirmNotaFiscal,
  canEditNotaFiscal,
  canManageNotaFiscal,
  filterNotasFiscais,
  formFromNotaFiscal,
  notaFiscalErrorMessage,
  todayIsoDate,
  validateNotaFiscalForm,
} from '../src/utils/notaFiscal.js';

function chave(value) {
  return String(value).padStart(44, '0');
}

function validForm() {
  return {
    numero: ' 12345 ',
    serie: ' 1 ',
    chaveAcesso: chave(1),
    fornecedor: ' ABC Materiais Ltda ',
    cnpjFornecedor: '11.222.333/0001-81',
    dataEmissao: todayIsoDate(),
    itens: [
      { materialId: '7', quantidade: '3', valorUnitario: '12.50' },
      { materialId: '8', quantidade: '2', valorUnitario: '1,99' },
    ],
  };
}

test('listagem filtra notas fiscais por busca e status', () => {
  const notas = [
    {
      id: 1,
      numero: '100',
      serie: '1',
      chaveAcesso: chave(100),
      fornecedor: 'ABC Materiais',
      cnpjFornecedor: '11222333000181',
      status: 'RASCUNHO',
      dataEmissao: '2026-08-01',
    },
    {
      id: 2,
      numero: '200',
      serie: '1',
      chaveAcesso: chave(200),
      fornecedor: 'Fornecedor Sul',
      cnpjFornecedor: '11222333000181',
      status: 'CONFIRMADA',
      dataEntrada: '2026-08-02T10:00:00',
    },
  ];

  assert.deepEqual(
    filterNotasFiscais(notas, 'abc', 'TODOS').map(({ id }) => id),
    [1],
  );
  assert.deepEqual(
    filterNotasFiscais(notas, '', 'CONFIRMADA').map(({ id }) => id),
    [2],
  );
});

test('criacao de NF monta payload com itens no formato do backend', () => {
  assert.deepEqual(buildNotaFiscalPayload(validForm()), {
    numero: '12345',
    serie: '1',
    chaveAcesso: chave(1),
    fornecedor: 'ABC Materiais Ltda',
    cnpjFornecedor: '11.222.333/0001-81',
    dataEmissao: todayIsoDate(),
    itens: [
      { materialId: 7, quantidade: 3, valorUnitario: '12.50' },
      { materialId: 8, quantidade: 2, valorUnitario: '1.99' },
    ],
  });
});

test('edicao de rascunho reaproveita resposta da API no formulario', () => {
  const form = formFromNotaFiscal({
    numero: '12345',
    serie: '1',
    chaveAcesso: chave(2),
    fornecedor: 'ABC',
    cnpjFornecedor: '11222333000181',
    dataEmissao: '2026-08-01',
    status: 'RASCUNHO',
    itens: [
      {
        materialId: 9,
        quantidade: 4,
        valorUnitario: 10.5,
      },
    ],
  });

  assert.equal(form.itens[0].materialId, '9');
  assert.equal(form.itens[0].quantidade, '4');
  assert.equal(form.itens[0].valorUnitario, '10.5');
  assert.equal(validateNotaFiscalForm(form), '');
});

test('confirmacao de NF fica restrita a admin e operador com rascunho e itens', () => {
  const rascunho = { status: 'RASCUNHO', itens: [{ id: 1 }] };
  const semItens = { status: 'RASCUNHO', itens: [] };
  const confirmada = { status: 'CONFIRMADA', itens: [{ id: 1 }] };

  assert.equal(canConfirmNotaFiscal(rascunho, 'ADMIN'), true);
  assert.equal(canConfirmNotaFiscal(rascunho, 'OPERADOR'), true);
  assert.equal(canConfirmNotaFiscal(rascunho, 'CONSULTA'), false);
  assert.equal(canConfirmNotaFiscal(semItens, 'ADMIN'), false);
  assert.equal(canConfirmNotaFiscal(confirmada, 'ADMIN'), false);
});

test('NF confirmada nao pode ser editada no frontend', () => {
  assert.equal(canEditNotaFiscal({ status: 'CONFIRMADA' }, 'ADMIN'), false);
  assert.equal(canEditNotaFiscal({ status: 'RASCUNHO' }, 'ADMIN'), true);
});

test('perfil consulta lista e visualiza, mas nao gerencia NF', () => {
  assert.equal(canManageNotaFiscal('CONSULTA'), false);
  assert.equal(canEditNotaFiscal({ status: 'RASCUNHO' }, 'CONSULTA'), false);
  assert.equal(canConfirmNotaFiscal({ status: 'RASCUNHO', itens: [{}] }, 'CONSULTA'), false);
});

test('validacao exibe erro amigavel antes do envio', () => {
  const form = validForm();
  form.itens[0].quantidade = '10001';

  assert.match(validateNotaFiscalForm(form), /quantidade maxima/);
});

test('tratamento de erro da API preserva mensagem e campos', () => {
  assert.equal(
    notaFiscalErrorMessage({
      message: 'Nao foi possivel salvar.',
      fields: {
        chaveAcesso: 'Chave duplicada.',
      },
    }),
    'Nao foi possivel salvar. Chave duplicada.',
  );
});

test('servico de nota fiscal usa os endpoints reais do backend', () => {
  const source = readFileSync(
    new URL('../src/services/notaFiscalService.js', import.meta.url),
    'utf8',
  );

  assert.match(source, /apiRequest\('\/notas-fiscais'\)/);
  assert.match(source, /`\/notas-fiscais\/\$\{id\}`/);
  assert.match(source, /`\/notas-fiscais\/\$\{id\}\/confirmar`/);
});

test('entrada manual antiga nao aparece mais em rotas, paginas ou servicos', () => {
  const files = [
    '../src/App.jsx',
    '../src/pages/DashboardPage.jsx',
    '../src/pages/MovementsPage.jsx',
    '../src/pages/MaterialsPage.jsx',
    '../src/pages/MovementFormPage.jsx',
    '../src/services/movimentacaoService.js',
  ];

  const source = files
    .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
    .join('\n');

  assert.doesNotMatch(source, /\/movimentacoes\/entrada/);
  assert.doesNotMatch(source, /createEntry/);
  assert.doesNotMatch(source, /Registrar entrada/);
});
