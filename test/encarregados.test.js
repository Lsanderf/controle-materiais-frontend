import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEncarregadoPayload,
  canAccessEncarregados,
  canCreateEncarregado,
  filterEncarregados,
} from '../src/utils/encarregados.js';
import { formatCelular, roleLabel } from '../src/utils/formatters.js';

test('acesso à listagem respeita os quatro perfis suportados', () => {
  assert.equal(canAccessEncarregados('ADMIN'), true);
  assert.equal(canAccessEncarregados('OPERADOR'), true);
  assert.equal(canAccessEncarregados('GERENTE'), true);
  assert.equal(canAccessEncarregados('ENCARREGADO'), false);
});

test('somente ADMIN cria encarregado; GERENTE e OPERADOR possuem somente leitura', () => {
  assert.equal(canCreateEncarregado('ADMIN'), true);
  assert.equal(canCreateEncarregado('GERENTE'), false);
  assert.equal(canCreateEncarregado('OPERADOR'), false);
  assert.equal(canCreateEncarregado('ENCARREGADO'), false);
});

test('listagem pesquisa campos públicos e não depende de CPF', () => {
  const encarregados = [
    {
      id: 1,
      nome: 'Ana Souza',
      username: 'ana.souza',
      celular: '31999998888',
      ativo: true,
    },
    {
      id: 2,
      nome: 'Bruno Lima',
      username: 'bruno.lima',
      celular: null,
      ativo: false,
    },
    {
      id: 3,
      nome: 'Carla Alves',
      username: 'carla.alves',
      celular: '31911112222',
      cpf: '12345678900',
      ativo: true,
    },
  ];

  assert.deepEqual(
    filterEncarregados(encarregados, 'ana', 'TODOS').map(({ id }) => id),
    [1],
  );
  assert.deepEqual(
    filterEncarregados(encarregados, '3199999', 'TODOS').map(({ id }) => id),
    [1],
  );
  assert.deepEqual(filterEncarregados(encarregados, '12345678900', 'TODOS'), []);
  assert.deepEqual(
    filterEncarregados(encarregados, '', 'INATIVOS').map(({ id }) => id),
    [2],
  );
});

test('criação envia somente os cinco campos permitidos e normaliza o celular', () => {
  const payload = buildEncarregadoPayload({
    nome: '  Ana Souza  ',
    cpf: '123.456.789-00',
    celular: '(31) 99999-8888',
    username: '  ana.souza  ',
    password: 'senhaForte123',
    role: 'ADMIN',
  });

  assert.deepEqual(payload, {
    nome: 'Ana Souza',
    cpf: '12345678900',
    celular: '31999998888',
    username: 'ana.souza',
    password: 'senhaForte123',
  });
  assert.equal(Object.hasOwn(payload, 'role'), false);
});

test('formatCelular é tolerante a valores ausentes', () => {
  assert.equal(formatCelular(null), '');
  assert.equal(formatCelular(undefined), '');
  assert.equal(formatCelular('31999998888'), '(31) 99999-8888');
});

test('roleLabel contempla exatamente os quatro perfis finais', () => {
  assert.equal(roleLabel('ADMIN'), 'Administrador');
  assert.equal(roleLabel('OPERADOR'), 'Operador');
  assert.equal(roleLabel('GERENTE'), 'Gerente');
  assert.equal(roleLabel('ENCARREGADO'), 'Encarregado');
});
