import { useId, useRef, useState } from 'react';
import { ErrorMessage, SuccessMessage } from './Feedback';
import { materialService } from '../services/materialService';

export default function MaterialForm({
  initialValues,
  materialId,
  onSaved,
  onCancel,
  onSavingChange,
}) {
  const editing = Boolean(materialId);
  const formId = useId();
  const [form, setForm] = useState(() => ({
    nome: initialValues?.nome ?? '',
    descricao: initialValues?.descricao ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const submittingRef = useRef(false);

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    onSavingChange?.(true);
    setError(null);
    setSuccess('');
    try {
      // MaterialRequest accepts only these fields. The existing backend mapper
      // always creates stock at zero; invoice/XML quantities never enter here.
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim(),
      };
      const material = editing
        ? await materialService.update(materialId, payload)
        : await materialService.create(payload);
      if (editing) setSuccess('Material atualizado com sucesso.');
      onSaved?.(material);
    } catch (requestError) {
      setError(requestError);
    } finally {
      submittingRef.current = false;
      setSaving(false);
      onSavingChange?.(false);
    }
  }

  return (
    <form className="content-card form-card material-form" onSubmit={handleSubmit} aria-busy={saving}>
      <div className="material-form-fields">
        <ErrorMessage error={error} />
        <SuccessMessage>{success}</SuccessMessage>

        <label className="field">
          <span id={`${formId}-name`}>Nome</span>
          <input
            aria-labelledby={`${formId}-name`}
            aria-describedby={`${formId}-name-help`}
            value={form.nome}
            onChange={(event) => change('nome', event.target.value)}
            required
            minLength="2"
            maxLength="100"
            placeholder="Ex.: Capacete de segurança"
            disabled={saving}
          />
          <small id={`${formId}-name-help`}>Entre 2 e 100 caracteres.</small>
        </label>

        <label className="field">
          <span id={`${formId}-description`}>Descrição</span>
          <textarea
            aria-labelledby={`${formId}-description`}
            aria-describedby={`${formId}-description-help`}
            value={form.descricao}
            onChange={(event) => change('descricao', event.target.value)}
            required
            minLength="2"
            maxLength="500"
            rows="4"
            placeholder="Descreva o material e seu uso"
            disabled={saving}
          />
          <small id={`${formId}-description-help`}>{form.descricao.length}/500 caracteres</small>
        </label>
      </div>

      <div className="form-actions">
        <button className="button button-secondary" type="button" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button className="button button-primary" type="submit" disabled={saving}>
          {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar material'}
        </button>
      </div>
    </form>
  );
}
