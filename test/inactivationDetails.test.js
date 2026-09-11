import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  InactivationTableValue,
  MobileInactivationDetails,
} from '../src/components/InactivationDetails.js';
import {
  formatDateTime,
  formatInactivationDate,
} from '../src/utils/formatters.js';

const dateValue = '2026-07-31T13:30:00';

test('data sem fuso é formatada como horário local sem deslocamento', () => {
  const expected = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(2026, 6, 31, 13, 30));

  assert.equal(formatDateTime(dateValue), expected);
});

test('registro ativo não mostra detalhe mobile e usa traço na tabela', () => {
  const active = { ativo: true, dataInativacao: null };

  assert.equal(
    renderToStaticMarkup(
      createElement(MobileInactivationDetails, { record: active }),
    ),
    '',
  );
  assert.match(
    renderToStaticMarkup(createElement(InactivationTableValue, { record: active })),
    /—/,
  );
});

test('registro inativo mostra data nos cartões mobile e na tabela desktop', () => {
  const inactive = { ativo: false, dataInativacao: dateValue };
  const formatted = formatDateTime(dateValue);
  const mobile = renderToStaticMarkup(
    createElement(MobileInactivationDetails, { record: inactive }),
  );
  const desktop = renderToStaticMarkup(
    createElement(InactivationTableValue, { record: inactive }),
  );

  assert.match(mobile, /Inativo desde:/);
  assert.ok(mobile.includes(formatted));
  assert.ok(desktop.includes(formatted));
});

test('registro antigo inativo sem data mostra Não disponível', () => {
  const legacyInactive = { ativo: false, dataInativacao: null };
  assert.equal(formatInactivationDate(legacyInactive), 'Não disponível');
});

test('reativação remove a data e nova inativação mostra a nova data', () => {
  const deactivated = { ativo: false, dataInativacao: dateValue };
  const reactivated = { ...deactivated, ativo: true, dataInativacao: null };
  const deactivatedAgain = {
    ...reactivated,
    ativo: false,
    dataInativacao: '2026-08-01T09:45:00',
  };

  assert.notEqual(formatInactivationDate(deactivated), '—');
  assert.equal(formatInactivationDate(reactivated), '—');
  assert.equal(
    formatInactivationDate(deactivatedAgain),
    formatDateTime(deactivatedAgain.dataInativacao),
  );
});
