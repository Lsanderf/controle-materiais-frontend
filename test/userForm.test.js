import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUserPayload,
  isValidCpf,
  passwordsMatch,
  registrationValidationError,
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
          nome: ' Usuário de teste ',
          cpf: '123.456.789-09',
          celular: '(11) 99999-0000',
          username: ' usuario.teste ',
          role,
          password: 'senhaForte123',
          passwordConfirmation: 'senhaForte123',
        },
        false,
      ),
      {
        nome: 'Usuário de teste',
        cpf: '12345678909',
        celular: '11999990000',
        username: 'usuario.teste',
        role,
        password: 'senhaForte123',
      },
    );
  }
});

test('cadastro valida CPF obrigatório, inválido e celular obrigatório', () => {
  const baseForm = {
    nome: 'Usuário de teste',
    cpf: '123.456.789-09',
    celular: '(11) 99999-0000',
  };

  assert.equal(
    registrationValidationError({ ...baseForm, cpf: '' }),
    'O CPF é obrigatório.',
  );
  assert.equal(
    registrationValidationError({ ...baseForm, cpf: '111.111.111-11' }),
    'O CPF informado é inválido.',
  );
  assert.equal(
    registrationValidationError({ ...baseForm, celular: '' }),
    'O celular é obrigatório.',
  );
  assert.equal(
    registrationValidationError({ ...baseForm, celular: '(11) 9999-0000' }),
    'Informe um celular com 11 dígitos.',
  );
  assert.equal(registrationValidationError(baseForm), null);
});

test('validação de CPF aceita valor formatado e rejeita dígitos verificadores incorretos', () => {
  assert.equal(isValidCpf('123.456.789-09'), true);
  assert.equal(isValidCpf('12345678900'), false);
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
