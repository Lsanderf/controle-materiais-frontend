import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUserPayload,
  passwordsMatch,
} from '../src/utils/userForm.js';

test('edição sem nova senha não envia senha ao backend', () => {
  assert.deepEqual(
    buildUserPayload(
      {
        username: ' operador ',
        role: 'OPERADOR',
        password: '',
        passwordConfirmation: '',
      },
      true,
    ),
    { username: 'operador', role: 'OPERADOR' },
  );
});

test('edição com nova senha envia somente novaSenha', () => {
  assert.deepEqual(
    buildUserPayload(
      {
        username: 'operador',
        role: 'ADMIN',
        password: 'senhaNova123',
        passwordConfirmation: 'senhaNova123',
      },
      true,
    ),
    {
      username: 'operador',
      role: 'ADMIN',
      novaSenha: 'senhaNova123',
    },
  );
});

test('cadastro mantém o contrato de payload existente', () => {
  assert.deepEqual(
    buildUserPayload(
      {
        username: ' consulta ',
        role: 'CONSULTA',
        password: 'senhaForte123',
        passwordConfirmation: 'senhaForte123',
      },
      false,
    ),
    {
      username: 'consulta',
      role: 'CONSULTA',
      password: 'senhaForte123',
    },
  );
});

test('validação detecta confirmação de senha diferente', () => {
  assert.equal(
    passwordsMatch({
      password: 'senhaNova123',
      passwordConfirmation: 'senhaOutra123',
    }),
    false,
  );
});
