import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUserPayload,
  passwordsMatch,
  USER_ROLES,
} from '../src/utils/userForm.js';

test('formulário aceita exatamente os quatro perfis finais', () => {
  assert.deepEqual(USER_ROLES, [
    'ADMIN',
    'OPERADOR',
    'GERENTE',
    'ENCARREGADO',
  ]);
});

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

test('cadastro mantém o contrato para cada perfil suportado', () => {
  for (const role of USER_ROLES) {
    assert.deepEqual(
      buildUserPayload(
        {
          username: ' usuario.teste ',
          role,
          password: 'senhaForte123',
          passwordConfirmation: 'senhaForte123',
        },
        false,
      ),
      {
        username: 'usuario.teste',
        role,
        password: 'senhaForte123',
      },
    );
  }
});

test('cadastro rejeita perfil fora da lista suportada', () => {
  assert.throws(
    () =>
      buildUserPayload(
        {
          username: 'usuario.teste',
          role: 'LEITOR',
          password: 'senhaForte123',
          passwordConfirmation: 'senhaForte123',
        },
        false,
      ),
    /Perfil de usuário inválido/,
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
