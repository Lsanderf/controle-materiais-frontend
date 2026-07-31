export function passwordsMatch(form) {
  return form.password === form.passwordConfirmation;
}

export function buildUserPayload(form, editing) {
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
