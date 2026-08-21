import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorMessage, Loading, SuccessMessage } from '../components/Feedback';
import { materialService } from '../services/materialService';

export default function MaterialFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState({ nome: '', descricao: '' });
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!editing) return;
    materialService
      .get(id)
      .then((material) =>
        setForm({ nome: material.nome, descricao: material.descricao }),
      )
      .catch(setError)
      .finally(() => setLoading(false));
  }, [editing, id]);

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess('');
    try {
      if (editing) {
        await materialService.update(id, {
          nome: form.nome.trim(),
          descricao: form.descricao.trim(),
        });
        setSuccess('Material atualizado com sucesso.');
      } else {
        await materialService.create({
          nome: form.nome.trim(),
          descricao: form.descricao.trim(),
        });
        navigate('/materiais', {
          replace: true,
          state: { success: 'Material cadastrado com sucesso.' },
        });
      }
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Carregando material..." />;

  return (
    <div className="page-stack narrow-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Materiais</span>
          <h1>{editing ? 'Editar material' : 'Novo material'}</h1>
          <p>O saldo inicial é zero e entradas de estoque vêm da confirmação de NF.</p>
        </div>
      </header>

      <form className="content-card form-card" onSubmit={handleSubmit}>
        <ErrorMessage error={error} />
        <SuccessMessage>{success}</SuccessMessage>

        <label className="field">
          <span>Nome</span>
          <input
            value={form.nome}
            onChange={(event) => change('nome', event.target.value)}
            required
            minLength="2"
            maxLength="100"
            placeholder="Ex.: Capacete de segurança"
          />
          <small>Entre 2 e 100 caracteres.</small>
        </label>

        <label className="field">
          <span>Descrição</span>
          <textarea
            value={form.descricao}
            onChange={(event) => change('descricao', event.target.value)}
            required
            minLength="2"
            maxLength="500"
            rows="4"
            placeholder="Descreva o material e seu uso"
          />
          <small>{form.descricao.length}/500 caracteres</small>
        </label>

        <div className="form-actions">
          <Link className="button button-secondary" to="/materiais">
            Cancelar
          </Link>
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar material'}
          </button>
        </div>
      </form>
    </div>
  );
}
