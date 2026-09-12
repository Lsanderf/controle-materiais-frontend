import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateNfeCheckDigit } from '../src/utils/nfeBarcode.js';
import {
  NFE_XML_KEY_MISMATCH_MESSAGE,
  associateImportedMaterial,
  formFromImportedNfe,
  hasUnmappedImportedItems,
  nfeXmlComparisonKey,
} from '../src/utils/nfeXmlImport.js';

const ACCESS_KEY = '52060433009911002506550120000007800267301615';

function anotherAccessKey() {
  const base = '1'.repeat(43);
  return `${base}${calculateNfeCheckDigit(base)}`;
}

function currentForm() {
  return {
    numero: 'digitado',
    serie: '9',
    chaveAcesso: ACCESS_KEY,
    fornecedor: 'Fornecedor anterior',
    cnpjFornecedor: '11222333000181',
    dataEmissao: '2026-09-01',
    itens: [
      { materialId: '5', quantidade: '1', valorUnitario: '1.00' },
    ],
  };
}

function importedNfe(chaveAcesso = ACCESS_KEY) {
  return {
    chaveAcesso,
    numero: '12345',
    serie: '1',
    dataEmissao: '2026-09-10',
    cnpjFornecedor: '11222333000181',
    fornecedor: 'ABC Materiais Ltda',
    itens: [
      {
        numeroItem: 1,
        codigoProduto: '82731',
        descricaoProduto: 'PARAFUSO SEXTAVADO 10MM',
        quantidadeComercial: '2',
        unidadeComercial: 'UN',
        valorUnitarioComercial: '12.5',
        valorTotal: '25',
        eanGtin: '7891234567895',
      },
      {
        numeroItem: 2,
        codigoProduto: '900',
        descricaoProduto: 'ARRUELA',
        quantidadeComercial: '4',
        unidadeComercial: 'UN',
        valorUnitarioComercial: '1.25',
        valorTotal: null,
        eanGtin: null,
      },
    ],
  };
}

test('retorno do XML preenche campos e cria itens sem assumir IDs internos', () => {
  const form = formFromImportedNfe(
    currentForm(),
    importedNfe(),
    ACCESS_KEY,
  );

  assert.equal(form.numero, '12345');
  assert.equal(form.serie, '1');
  assert.equal(form.chaveAcesso, ACCESS_KEY);
  assert.equal(form.fornecedor, 'ABC Materiais Ltda');
  assert.equal(form.dataEmissao, '2026-09-10');
  assert.equal(form.itens.length, 2);
  assert.equal(form.itens[0].materialId, '');
  assert.equal(form.itens[0].quantidade, '2');
  assert.equal(form.itens[0].valorUnitario, '12.5');
  assert.equal(form.itens[0].origemXml.codigoProduto, '82731');
  assert.equal(form.itens[0].origemXml.descricaoProduto,
    'PARAFUSO SEXTAVADO 10MM');
});

test('chave scanner igual ao XML continua e chave diferente não sobrescreve', () => {
  const original = currentForm();

  assert.equal(
    nfeXmlComparisonKey(ACCESS_KEY.replace(/(.{4})(?=.)/g, '$1 ')),
    ACCESS_KEY,
  );
  assert.doesNotThrow(() =>
    formFromImportedNfe(original, importedNfe(), ACCESS_KEY));
  assert.throws(
    () => formFromImportedNfe(
      original,
      importedNfe(anotherAccessKey()),
      ACCESS_KEY,
    ),
    { message: NFE_XML_KEY_MISMATCH_MESSAGE },
  );
  assert.equal(original.chaveAcesso, ACCESS_KEY);
  assert.equal(original.numero, 'digitado');
});

test('itens importados bloqueiam conclusão até associação de materiais', () => {
  let form = formFromImportedNfe(
    currentForm(),
    importedNfe(),
    ACCESS_KEY,
  );

  assert.equal(hasUnmappedImportedItems(form), true);
  form = associateImportedMaterial(form, 0, 42);
  assert.equal(form.itens[0].materialId, '42');
  assert.equal(hasUnmappedImportedItems(form), true);
  form = associateImportedMaterial(form, 1, 77);
  assert.equal(hasUnmappedImportedItems(form), false);
});

test('campos opcionais ausentes não impedem apresentar item importado', () => {
  const form = formFromImportedNfe(
    currentForm(),
    importedNfe(),
    ACCESS_KEY,
  );

  assert.equal(form.itens[1].origemXml.valorTotal, '');
  assert.equal(form.itens[1].origemXml.eanGtin, '');
});

test('formulário oferece seleção XML, loading e mantém edição manual', () => {
  const source = readFileSync(
    new URL('../src/pages/NotaFiscalFormPage.jsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /type="file"/);
  assert.match(source, /accept="\.xml,application\/xml,text\/xml"/);
  assert.match(source, /Importar XML da NF-e/);
  assert.match(source, /Lendo Nota Fiscal\.\.\./);
  assert.match(source, /notaFiscalService\.importXml\(arquivo/);
  assert.match(source, /formFromImportedNfe/);
  assert.match(source, /Aguardando associação/);
  assert.match(source, /unmappedImportedItems/);
  assert.match(source, /\+ Adicionar item/);
  assert.match(source, /onChange=\{\(event\) => change\('numero'/);
});

test('erro de leitura do XML é exibido sem aplicar preenchimento', () => {
  const source = readFileSync(
    new URL('../src/pages/NotaFiscalFormPage.jsx', import.meta.url),
    'utf8',
  );
  const requestPosition = source.indexOf('await notaFiscalService.importXml');
  const fillPosition = source.indexOf('setForm(importedForm)');
  const errorPosition = source.indexOf('setError(requestError)', fillPosition);

  assert.ok(requestPosition >= 0);
  assert.ok(fillPosition > requestPosition);
  assert.ok(errorPosition > fillPosition);
  assert.match(source, /<ErrorMessage error=\{error\} \/>/);
});

test('serviço envia multipart para o endpoint de leitura sem salvar a NF', () => {
  const source = readFileSync(
    new URL('../src/services/notaFiscalService.js', import.meta.url),
    'utf8',
  );

  assert.match(source, /new FormData\(\)/);
  assert.match(source, /body\.append\('arquivo', arquivo\)/);
  assert.match(source, /body\.append\('chaveAcessoInformada'/);
  assert.match(source, /body\.append\('notaFiscalId'/);
  assert.match(source, /apiRequest\('\/notas-fiscais\/importar-xml'/);
});
