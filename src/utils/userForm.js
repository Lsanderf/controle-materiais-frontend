export const USER_ROLES = [
  'ADMIN',
  'OPERADOR',
  'GERENTE',
  'ENCARREGADO',
];

export function passwordsMatch(form) {
  return form.password === form.passwordConfirmation;
}

export function buildUserPayload(form, editing) {
  if (!USER_ROLES.includes(form.role)) {
    throw new Error('Perfil de usuário inválido.');
  }

  if (!editing) {
    return {
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
