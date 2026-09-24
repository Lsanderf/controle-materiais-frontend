import { onlyDigits } from './formatters.js';

export const USER_ROLES = [
  'ADMIN',
  'OPERADOR',
  'GERENTE',
  'ENCARREGADO',
];

export function passwordsMatch(form) {
  return form.password === form.passwordConfirmation;
}

export function isValidCpf(value) {
  const cpf = onlyDigits(value);

  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

  const digitAt = (position) => {
    const sum = cpf
      .slice(0, position - 1)
      .split('')
      .reduce(
        (total, digit, index) => total + Number(digit) * (position - index),
        0,
      );
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return digitAt(10) === Number(cpf[9]) && digitAt(11) === Number(cpf[10]);
}

export function registrationValidationError(form) {
  const cpf = onlyDigits(form.cpf);
  const celular = onlyDigits(form.celular);

  if (!cpf) return 'O CPF é obrigatório.';
  if (!isValidCpf(cpf)) return 'O CPF informado é inválido.';
  if (!celular) return 'O celular é obrigatório.';
  if (celular.length !== 11) {
    return 'Informe um celular com 11 dígitos.';
  }

  return null;
}

export function buildUserPayload(form, editing) {
  if (!USER_ROLES.includes(form.role)) {
    throw new Error('Perfil de usuário inválido.');
  }

  if (!editing) {
    return {
      nome: form.nome.trim(),
      cpf: onlyDigits(form.cpf),
      celular: onlyDigits(form.celular),
      username: form.username.trim(),
      password: form.password,
      role: form.role,
    };
  }

  const payload = {
    username: form.username.trim(),
    role: form.role,
  };

  if (form.password) {
    payload.novaSenha = form.password;
  }

  return payload;
}
