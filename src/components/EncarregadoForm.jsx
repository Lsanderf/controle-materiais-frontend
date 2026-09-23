import { useState } from 'react';
import { ErrorMessage } from './Feedback';
import { usuarioService } from '../services/usuarioService';
import { formatCelular, onlyDigits } from '../utils/formatters';

const emptyForm = { nome: '', cpf: '', celular: '', username: '', password: '' };

export default function EncarregadoForm({ onCreated, onCancel }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await usuarioService.createEncarregado({
        ...form,
        nome: form.nome.trim(),
        cpf: form.cpf.trim(),
        celular: onlyDigits(form.celular),
        username: form.username.trim(),
      });
      setForm(emptyForm);
      onCreated?.(created);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="content-card form-card" onSubmit={submit}>
      <h2>Novo encarregado</h2>
      <ErrorMessage error={error} />
      <div className="form-grid">
        <label className="field"><span>Nome</span><input required maxLength="150" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></label>
        <label className="field"><span>CPF</span><input required maxLength="14" inputMode="numeric" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></label>
        <label className="field"><span>Celular</span><input required inputMode="numeric" maxLength="15" value={form.celular} onChange={(e) => setForm({ ...form, celular: formatCelular(e.target.value) })} /></label>
        <label className="field"><span>Usuário</span><input required minLength="3" maxLength="100" autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
        <label className="field"><span>Senha</span><input required minLength="8" maxLength="100" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
      </div>
      <p className="muted">O perfil será definido pelo servidor como ENCARREGADO.</p>
      <div className="form-actions">
        {onCancel && <button type="button" className="button button-secondary" onClick={onCancel}>Cancelar</button>}
        <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar encarregado'}</button>
      </div>
    </form>
  );
}
