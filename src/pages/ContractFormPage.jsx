import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ErrorMessage, Loading, SuccessMessage } from '../components/Feedback';
import { contratoService } from '../services/contratoService';

export default function ContractFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath = location.state?.from ?? '/contratos';
  const editing = Boolean(id);
  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    ativo: true,
  });
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!editing) return;
    contratoService
      .get(id)
      .then((contract) =>
        setForm({
          nome: contract.nome,
          descricao: contract.descricao,
          ativo: contract.ativo,
        }),
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
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim(),
        ativo: form.ativo,
      };
      if (editing) {
        await contratoService.update(id, payload);
        setSuccess('Contrato atualizado com sucesso.');
      } else {
        await contratoService.create(payload);
        navigate(returnPath, {
          replace: true,
          state: { success: 'Contrato cadastrado com sucesso.' },
        });
      }
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Carregando contrato..." />;

  return (
    <div className="page-stack narrow-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Contratos</span>
          <h1>{editing ? 'Editar contrato' : 'Novo contrato'}</h1>
          <p>Contratos ativos podem ser usados em novas movimentações.</p>
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
            placeholder="Nome do contrato"
          />
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
            placeholder="Escopo ou identificação do contrato"
          />
          <small>{form.descricao.length}/500 caracteres</small>
        </label>

        {!editing && (
          <label className="switch-field">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(event) => change('ativo', event.target.checked)}
            />
            <span>
              <strong>Contrato ativo</strong>
              <small>Disponível para novas retiradas e devoluções.</small>
            </span>
          </label>
        )}

        <div className="form-actions">
          <Link className="button button-secondary" to={returnPath}>
            Cancelar
          </Link>
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving
              ? 'Salvando...'
              : editing
                ? 'Salvar alterações'
                : 'Cadastrar contrato'}
          </button>
        </div>
      </form>
    </div>
  );
}
