import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorMessage, Loading, SuccessMessage } from '../components/Feedback';
import { funcionarioService } from '../services/funcionarioService';
import { formatCpf, onlyDigits } from '../utils/formatters';

export default function EmployeeFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState({ nome: '', cpf: '', cargo: '' });
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!editing) return;
    funcionarioService
      .get(id)
      .then((employee) =>
        setForm({
          nome: employee.nome,
          cpf: '',
          cargo: employee.cargo,
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
        cpf: onlyDigits(form.cpf),
        cargo: form.cargo.trim(),
      };
      if (editing) {
        await funcionarioService.update(id, payload);
        setSuccess('Funcionário atualizado com sucesso.');
        setForm((current) => ({ ...current, cpf: '' }));
      } else {
        await funcionarioService.create(payload);
        navigate('/funcionarios', {
          replace: true,
          state: { success: 'Funcionário cadastrado com sucesso.' },
        });
      }
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Carregando funcionário..." />;

  return (
    <div className="page-stack narrow-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Funcionários</span>
          <h1>{editing ? 'Editar funcionário' : 'Novo funcionário'}</h1>
          <p>Preencha os dados usados no controle de retiradas e devoluções.</p>
        </div>
      </header>

      <form className="content-card form-card" onSubmit={handleSubmit}>
        <ErrorMessage error={error} />
        <SuccessMessage>{success}</SuccessMessage>

        {editing && (
          <div className="alert alert-warning">
            O back-end não devolve o CPF cadastrado. Informe o CPF do funcionário
            novamente para salvar a edição.
          </div>
        )}

        <div className="form-grid">
          <label className="field field-wide">
            <span>Nome</span>
            <input
              value={form.nome}
              onChange={(event) => change('nome', event.target.value)}
              required
              minLength="2"
              maxLength="100"
              placeholder="Nome completo"
            />
          </label>

          <label className="field">
            <span>CPF</span>
            <input
              inputMode="numeric"
              value={form.cpf}
              onChange={(event) => change('cpf', formatCpf(event.target.value))}
              required
              pattern="\d{3}\.\d{3}\.\d{3}-\d{2}"
              placeholder="000.000.000-00"
            />
            <small>Será enviado somente com números.</small>
          </label>

          <label className="field">
            <span>Cargo</span>
            <input
              value={form.cargo}
              onChange={(event) => change('cargo', event.target.value)}
              required
              minLength="2"
              maxLength="100"
              placeholder="Ex.: Almoxarife"
            />
          </label>
        </div>

        <div className="form-actions">
          <Link className="button button-secondary" to="/funcionarios">
            Cancelar
          </Link>
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving
              ? 'Salvando...'
              : editing
                ? 'Salvar alterações'
                : 'Cadastrar funcionário'}
          </button>
        </div>
      </form>
    </div>
  );
}
