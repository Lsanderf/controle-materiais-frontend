import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorMessage, Loading } from '../components/Feedback';
import { usuarioService } from '../services/usuarioService';
import { formatCelular, formatCpf, roleLabel } from '../utils/formatters';
import {
  buildUserPayload,
  passwordsMatch,
  registrationValidationError,
  USER_ROLES,
} from '../utils/userForm';

const roleDescriptions = {
  ADMIN: 'Gerencia cadastros, usuários e movimentações.',
  OPERADOR: 'Cria materiais e registra movimentações.',
  GERENTE: 'Gerencia encarregados e demais recursos permitidos.',
  ENCARREGADO: 'Acessa somente as funções destinadas ao seu perfil.',
};

export default function UserFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState({
    nome: '',
    cpf: '',
    celular: '',
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

    if (!editing) {
      const validationError = registrationValidationError(form);
      if (validationError) {
        setError({ message: validationError });
        return;
      }
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

        {!editing && (
          <div className="form-grid">
            <label className="field field-wide">
              <span>Nome</span>
              <input
                value={form.nome}
                onChange={(event) => change('nome', event.target.value)}
                required
                minLength="2"
                maxLength="150"
                autoComplete="name"
                placeholder="Nome completo"
              />
            </label>

            <label className="field">
              <span>CPF</span>
              <input
                inputMode="numeric"
                autoComplete="off"
                value={form.cpf}
                onChange={(event) => change('cpf', formatCpf(event.target.value))}
                required
                pattern="\d{3}\.\d{3}\.\d{3}-\d{2}"
                maxLength="14"
                placeholder="000.000.000-00"
              />
              <small>Será enviado somente com números.</small>
            </label>

            <label className="field">
              <span>Celular</span>
              <input
                inputMode="numeric"
                autoComplete="tel"
                value={form.celular}
                onChange={(event) =>
                  change('celular', formatCelular(event.target.value))
                }
                required
                pattern="\(\d{2}\) \d{5}-\d{4}"
                maxLength="15"
                placeholder="(00) 00000-0000"
              />
              <small>Será enviado somente com números.</small>
            </label>
          </div>
        )}

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
          {USER_ROLES.map((role) => (
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
