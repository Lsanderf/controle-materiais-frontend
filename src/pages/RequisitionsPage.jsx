import { useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import { EmptyState, ErrorMessage, Loading, SuccessMessage } from '../components/Feedback';
import { useAuth } from '../context/useAuth';
import { useResource } from '../hooks/useResource';
import { requisicaoService } from '../services/requisicaoService';
import { formatDateTime } from '../utils/formatters';

const statusLabels = {
  PENDENTE: 'Pendente',
  AGUARDANDO_CONFIRMACAO: 'Aguardando confirmação',
  CONCLUIDA: 'Concluída',
};

export default function RequisitionsPage() {
  const { role, hasAnyRole } = useAuth();
  const location = useLocation();
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState(location.state?.success ?? '');
  const loader = useCallback(() => requisicaoService.list(role), [role]);
  const { data, setData, loading, error, reload } = useResource(loader, [loader]);

  async function runAction() {
    setSaving(true);
    setActionError(null);
    try {
      const updated = action === 'finalizar'
        ? await requisicaoService.finalizar(selected.id)
        : await requisicaoService.confirmar(selected.id);
      setData((current) => (current ?? []).map((item) => item.id === updated.id ? updated : item));
      setSuccess(action === 'finalizar' ? 'Atendimento finalizado; aguardando confirmação.' : 'Recebimento confirmado.');
      setSelected(null);
      setAction(null);
    } catch (requestError) { setActionError(requestError); } finally { setSaving(false); }
  }

  const canCreate = hasAnyRole('ADMIN', 'GERENTE');
  return (
    <div className="page-stack">
      <header className="page-heading"><div><span className="eyebrow">Rastreabilidade</span><h1>{role === 'ENCARREGADO' ? 'Minhas requisições' : 'Requisições'}</h1><p>Acompanhe a solicitação, as retiradas efetivas e a confirmação de recebimento.</p></div>{canCreate && <Link className="button button-primary" to="/requisicoes/nova">+ Nova requisição</Link>}</header>
      <SuccessMessage>{success}</SuccessMessage><ErrorMessage error={actionError} />
      {loading ? <Loading label="Carregando requisições..." /> : error ? <><ErrorMessage error={error} /><button className="button button-secondary" onClick={reload}>Tentar novamente</button></> : !data?.length ? <EmptyState title="Nenhuma requisição encontrada." /> : (
        <div className="mobile-card-list">
          {data.map((request) => (
            <article className="resource-card" key={request.id}>
              <div className="resource-card-heading"><div><small>Requisição #{request.id} · {formatDateTime(request.criadoEm)}</small><h2>{request.encarregado.nome}</h2></div><span className="status-badge">{statusLabels[request.status]}</span></div>
              <p><strong>Gerente:</strong> {request.gerente.nome}</p><p><strong>Contrato:</strong> {request.contrato.nome}</p><p style={{ whiteSpace: 'pre-wrap' }}>{request.descricao}</p>
              {request.movimentacoes?.length > 0 && <div><strong>Movimentações vinculadas</strong><ul>{request.movimentacoes.map((movement) => <li key={movement.id}>#{movement.id} · {movement.tipo} · {movement.material} · {movement.quantidade} un.</li>)}</ul></div>}
              <div className="resource-actions">
                {role === 'OPERADOR' && request.status === 'PENDENTE' && <Link className="button button-secondary" to={`/movimentacoes/retirada?requisicao=${request.id}&encarregado=${request.encarregado.id}&contrato=${request.contrato.id}`}>Registrar retirada</Link>}
                {hasAnyRole('ADMIN', 'OPERADOR') && request.status === 'PENDENTE' && <button className="button button-primary" onClick={() => { setSelected(request); setAction('finalizar'); }}>Finalizar atendimento</button>}
                {role === 'ENCARREGADO' && request.status === 'AGUARDANDO_CONFIRMACAO' && <button className="button button-primary" onClick={() => { setSelected(request); setAction('confirmar'); }}>Confirmar recebimento</button>}
              </div>
            </article>
          ))}
        </div>
      )}
      <ConfirmDialog open={Boolean(selected)} title={action === 'finalizar' ? 'Finalizar atendimento?' : 'Confirmar recebimento?'} confirmLabel={action === 'finalizar' ? 'Finalizar' : 'Confirmar'} loading={saving} onCancel={() => { setSelected(null); setAction(null); }} onConfirm={runAction}><p>{action === 'finalizar' ? 'Após finalizar, novas retiradas não poderão ser incluídas até a confirmação do encarregado.' : 'Confirme apenas depois de conferir os materiais recebidos.'}</p></ConfirmDialog>
    </div>
  );
}
