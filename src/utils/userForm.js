import { onlyDigits } from './formatters.js';

export function passwordsMatch(form) {
  return form.password === form.passwordConfirmation;
}

export function buildUserPayload(form, editing) {
  if (!editing) {
    return {
      nome: form.nome.trim(),
      cpf: form.cpf,
      celular: onlyDigits(form.celular),
      username: form.username.trim(),
      password: form.password,
      role: form.role,
    };
  }

  const payload = {
    nome: form.nome.trim(),
    cpf: form.cpf,
    celular: onlyDigits(form.celular),
    username: form.username.trim(),
    role: form.role,
  };

  if (form.password) {
    payload.novaSenha = form.password;
  }

  return payload;
}
