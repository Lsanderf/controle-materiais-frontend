import { useCallback, useState } from 'react';
import EncarregadoForm from '../components/EncarregadoForm';
import { EmptyState, ErrorMessage, Loading, StatusBadge } from '../components/Feedback';
import { useAuth } from '../context/useAuth';
import { useResource } from '../hooks/useResource';
import { usuarioService } from '../services/usuarioService';
import { formatCelular } from '../utils/formatters';

export default function EncarregadosPage() {
  const { hasAnyRole } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const loader = useCallback(() => usuarioService.listEncarregados(), []);
  const { data, setData, loading, error, reload } = useResource(loader, [loader]);
  const canCreate = hasAnyRole('ADMIN', 'GERENTE');

  return (
    <div className="page-stack">
      <header className="page-heading"><div><span className="eyebrow">Pessoas</span><h1>Encarregados</h1><p>Usuários ativos disponíveis para requisições e movimentações.</p></div>
        {canCreate && <button className="button button-primary" onClick={() => setShowForm(true)}>+ Novo encarregado</button>}
      </header>
      {showForm && <EncarregadoForm onCancel={() => setShowForm(false)} onCreated={(created) => { setData((current) => [...(current ?? []), created]); setShowForm(false); }} />}
      {loading ? <Loading label="Carregando encarregados..." /> : error ? <><ErrorMessage error={error} /><button className="button button-secondary" onClick={reload}>Tentar novamente</button></> : !data?.length ? <EmptyState title="Nenhum encarregado ativo." /> : (
        <div className="mobile-card-list">
          {data.map((user) => <article className="resource-card" key={user.id}><div className="resource-card-heading"><div><small>Encarregado #{user.id}</small><h2>{user.nome}</h2></div><StatusBadge active={user.ativo} /></div><p>{user.username} · {formatCelular(user.celular)}</p></article>)}
        </div>
      )}
    </div>
  );
}
