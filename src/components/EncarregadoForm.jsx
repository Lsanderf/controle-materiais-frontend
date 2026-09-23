import { useState } from 'react';
import { ErrorMessage } from './Feedback';
import { usuarioService } from '../services/usuarioService';
import { formatCelular, formatCpf } from '../utils/formatters';
import { buildEncarregadoPayload } from '../utils/encarregados';

const emptyForm = {
  nome: '',
  cpf: '',
  celular: '',
  username: '',
  password: '',
};

export default function EncarregadoForm({ onCreated, onCancel }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await usuarioService.createEncarregado(buildEncarregadoPayload(form));
      setForm(emptyForm);
      onCreated?.();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="content-card form-card" onSubmit={handleSubmit}>
      <div className="section-heading">
        <div>
          <h2>Novo encarregado</h2>
          <p>Cadastre os dados de identificação e acesso do encarregado.</p>
        </div>
      </div>

      <ErrorMessage error={error} />

      <div className="form-grid">
        <label className="field field-wide">
          <span>Nome</span>
          <input
            value={form.nome}
            onChange={(event) => change('nome', event.target.value)}
            required
            minLength="2"
            maxLength="150"
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
            maxLength="15"
            placeholder="(00) 00000-0000"
          />
        </label>

        <label className="field">
          <span>Usuário</span>
          <input
            value={form.username}
            onChange={(event) => change('username', event.target.value)}
            required
            minLength="3"
            maxLength="100"
            autoComplete="off"
            placeholder="Usuário de acesso"
          />
        </label>

        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) => change('password', event.target.value)}
            required
            minLength="8"
            maxLength="100"
            autoComplete="new-password"
            placeholder="Mínimo de 8 caracteres"
          />
        </label>
      </div>

      <p className="muted">
        O perfil de Encarregado será definido automaticamente pelo servidor.
      </p>

      <div className="form-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="button button-primary"
          disabled={saving}
        >
          {saving ? 'Salvando...' : 'Cadastrar encarregado'}
        </button>
      </div>
    </form>
  );
}
