import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUserPayload,
  passwordsMatch,
} from '../src/utils/userForm.js';
import { formatCelular } from '../src/utils/formatters.js';

test('edição sem nova senha não envia senha ao backend', () => {
  assert.deepEqual(
    buildUserPayload(
      {
        nome: ' Operador Um ',
        cpf: '529.982.247-25',
        celular: '31999999999',
        username: ' operador ',
        role: 'OPERADOR',
        password: '',
        passwordConfirmation: '',
      },
      true,
    ),
    { nome: 'Operador Um', cpf: '529.982.247-25', celular: '31999999999', username: 'operador', role: 'OPERADOR' },
  );
});

test('edição com nova senha envia somente novaSenha', () => {
  assert.deepEqual(
    buildUserPayload(
      {
        nome: 'Administrador',
        cpf: '11144477735',
        celular: '31999999998',
        username: 'operador',
        role: 'ADMIN',
        password: 'senhaNova123',
        passwordConfirmation: 'senhaNova123',
      },
      true,
    ),
    {
      nome: 'Administrador',
      cpf: '11144477735',
      celular: '31999999998',
      username: 'operador',
      role: 'ADMIN',
      novaSenha: 'senhaNova123',
    },
  );
});

test('cadastro envia dados pessoais e um dos quatro perfis finais', () => {
  assert.deepEqual(
    buildUserPayload(
      {
        nome: ' Encarregado Um ',
        cpf: '93541134780',
        celular: '31999999997',
        username: ' encarregado ',
        role: 'ENCARREGADO',
        password: 'senhaForte123',
        passwordConfirmation: 'senhaForte123',
      },
      false,
    ),
    {
      nome: 'Encarregado Um',
      cpf: '93541134780',
      celular: '31999999997',
      username: 'encarregado',
      role: 'ENCARREGADO',
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

test('celular é formatado progressivamente e enviado somente com dígitos', () => {
  assert.equal(formatCelular('31999999999'), '(31) 99999-9999');
  assert.equal(formatCelular('(31) 999'), '(31) 999');
  assert.equal(formatCelular('31abc999999999'), '(31) 99999-9999');

  assert.equal(
    buildUserPayload({
      nome: 'Operador',
      cpf: '52998224725',
      celular: '(31) 99999-9999',
      username: 'operador',
      role: 'OPERADOR',
      password: 'senhaForte123',
      passwordConfirmation: 'senhaForte123',
    }, false).celular,
    '31999999999',
  );
});
