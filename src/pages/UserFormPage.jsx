import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorMessage, Loading } from '../components/Feedback';
import { usuarioService } from '../services/usuarioService';
import { roleLabel } from '../utils/formatters';
import { buildUserPayload, passwordsMatch } from '../utils/userForm';

const roles = ['ADMIN', 'OPERADOR', 'CONSULTA'];

const roleDescriptions = {
  ADMIN: 'Gerencia cadastros, usuários e movimentações.',
  OPERADOR: 'Consulta, cria materiais e registra movimentações.',
  CONSULTA: 'Apenas consulta dados e histórico.',
};

export default function UserFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState({
    username: '',
    role: 'OPERADOR',
    password: '',
    passwordConfirmation: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!editing) return;
    usuarioService
      .get(id)
      .then((user) =>
        setForm((current) => ({
          ...current,
          username: user.username,
          role: user.role,
        })),
      )
      .catch(setError)
      .finally(() => setLoading(false));
  }, [editing, id]);

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!passwordsMatch(form)) {
      setError({ message: 'A senha e a confirmação precisam ser iguais.' });
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await usuarioService.update(id, buildUserPayload(form, true));
        navigate('/usuarios', {
          replace: true,
          state: { success: 'Usuário atualizado com sucesso.' },
        });
      } else {
        await usuarioService.create(buildUserPayload(form, false));
        navigate('/usuarios', {
          replace: true,
          state: { success: 'Usuário criado com sucesso.' },
        });
      }
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Carregando usuário..." />;

  return (
    <div className="page-stack narrow-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Usuários</span>
          <h1>{editing ? 'Editar usuário' : 'Novo usuário'}</h1>
          <p>
            {editing
              ? 'Atualize o acesso; deixe a nova senha vazia para manter a atual.'
              : 'Crie um acesso de acordo com a responsabilidade da pessoa.'}
          </p>
        </div>
      </header>

      <form className="content-card form-card" onSubmit={handleSubmit}>
        <ErrorMessage error={error} />

        <label className="field">
          <span>Nome de usuário</span>
          <input
            value={form.username}
            onChange={(event) => change('username', event.target.value)}
            required
            minLength="3"
            maxLength="100"
            autoComplete="off"
            placeholder="Ex.: operador1"
          />
          <small>Entre 3 e 100 caracteres e sem duplicidade.</small>
        </label>

        <fieldset className="role-selector">
          <legend>Perfil de acesso</legend>
          {roles.map((role) => (
            <label key={role}>
              <input
                type="radio"
                name="role"
                value={role}
                checked={form.role === role}
                onChange={(event) => change('role', event.target.value)}
              />
              <span>
                <strong>{roleLabel(role)}</strong>
                <small>{roleDescriptions[role]}</small>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="form-grid">
          <label className="field">
            <span>{editing ? 'Nova senha (opcional)' : 'Senha inicial'}</span>
            <span className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(event) => change('password', event.target.value)}
                required={!editing}
                minLength={form.password || !editing ? 8 : undefined}
                maxLength="100"
                autoComplete="new-password"
                placeholder={editing ? 'Manter senha atual' : 'No mínimo 8 caracteres'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </span>
          </label>

          <label className="field">
            <span>Confirmar senha</span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.passwordConfirmation}
              onChange={(event) =>
                change('passwordConfirmation', event.target.value)
              }
              required={!editing || Boolean(form.password)}
              minLength={form.password || !editing ? 8 : undefined}
              maxLength="100"
              autoComplete="new-password"
              placeholder="Repita a senha"
            />
          </label>
        </div>

        <div className="form-actions">
          <Link className="button button-secondary" to="/usuarios">
            Cancelar
          </Link>
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving
              ? 'Salvando...'
              : editing
                ? 'Salvar alterações'
                : 'Criar usuário'}
          </button>
        </div>
      </form>
    </div>
  );
}
