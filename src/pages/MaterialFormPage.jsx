import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorMessage, Loading } from '../components/Feedback';
import MaterialForm from '../components/MaterialForm';
import { materialService } from '../services/materialService';

export default function MaterialFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState({ nome: '', descricao: '' });
  const [loading, setLoading] = useState(editing);
  const [error, setError] = useState(null);

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

  function handleSaved() {
    if (!editing) {
      navigate('/materiais', {
        replace: true,
        state: { success: 'Material cadastrado com sucesso.' },
      });
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

      <ErrorMessage error={error} />
      <MaterialForm
        key={id ?? 'new'}
        initialValues={form}
        materialId={id}
        onSaved={handleSaved}
        onCancel={() => navigate('/materiais')}
      />
    </div>
  );
}
