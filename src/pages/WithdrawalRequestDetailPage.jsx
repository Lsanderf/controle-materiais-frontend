import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SignaturePad from '../components/SignaturePad';
import { ErrorMessage, Loading, SuccessMessage } from '../components/Feedback';
import RequisicaoStatusBadge from '../components/RequisicaoStatusBadge';
import { useAuth } from '../context/useAuth';
import { useResource } from '../hooks/useResource';
import { solicitacaoRetiradaService } from '../services/solicitacaoRetiradaService';
import { formatDateTime } from '../utils/formatters';

export default function WithdrawalRequestDetailPage() {
  const { id } = useParams();
  const { role } = useAuth();
  const loader = useCallback(() => solicitacaoRetiradaService.get(id), [id]);
  const { data, loading, error, reload } = useResource(loader, [loader]);
  const [signing, setSigning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState('');

  async function confirm(signature) {
    setSaving(true);
    setActionError(null);
    try {
      await solicitacaoRetiradaService.confirm(id, signature);
      setSigning(false);
      setSuccess('Retirada confirmada com sucesso.');
      await reload();
    } catch (requestError) {
      setActionError(requestError);
    } finally {
      setSaving(false);
    }
  }

  async function cancel() {
    if (saving) return;
    setSaving(true);
    setActionError(null);
    try {
      await solicitacaoRetiradaService.cancel(id);
      setSuccess('Solicitação cancelada.');
      await reload();
    } catch (requestError) {
      setActionError(requestError);
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) return <Loading label="Carregando solicitação..." />;
  if (error && !data) return <ErrorMessage error={error} />;
  const canConfirm = role === 'ENCARREGADO' && data.status === 'AGUARDANDO_ASSINATURA';
  const canCancel = ['ADMIN', 'OPERADOR'].includes(role) && data.status === 'AGUARDANDO_ASSINATURA';

  return (
    <div className="page-stack narrow-page">
      <header className="page-heading">
        <div>
          <Link className="text-link" to="/solicitacoes-retirada">← Voltar</Link>
          <span className="eyebrow">Retirada #{data.id}</span>
          <h1>Solicitação de retirada</h1>
          <p>Criada em {formatDateTime(data.criadaEm) ?? 'data não informada'}.</p>
        </div>
        <RequisicaoStatusBadge status={data.status} />
      </header>

      <SuccessMessage>{success}</SuccessMessage>
      <ErrorMessage error={actionError} />

      <section className="content-card requisicao-detail">
        <dl>
          <div><dt>Operador responsável</dt><dd>{data.operadorResponsavel?.nome ?? 'Não informado'}</dd></div>
          <div><dt>Encarregado assinante</dt><dd>{data.encarregadoAssinante?.nome ?? 'Não informado'}</dd></div>
          <div><dt>Contrato</dt><dd>{data.contrato?.nome ?? 'Não informado'}</dd></div>
          {data.confirmadaEm && <div><dt>Confirmada em</dt><dd>{formatDateTime(data.confirmadaEm)}</dd></div>}
        </dl>

        <h2>Materiais da retirada</h2>
        <ul className="requisicao-detail-items">
          {data.itens.map((item) => (
            <li key={item.id}>
              <span>{item.material}</span>
              <strong>{item.quantidade} un.</strong>
            </li>
          ))}
        </ul>

        {data.observacao && (
          <>
            <h2>Observação</h2>
            <p>{data.observacao}</p>
          </>
        )}
      </section>

      {(canCancel || canConfirm) && (
        <div className="page-actions">
          {canCancel && (
            <button className="button button-secondary" type="button" disabled={saving} onClick={cancel}>
              {saving ? 'Cancelando...' : 'Cancelar solicitação'}
            </button>
          )}
          {canConfirm && (
            <button className="button button-primary" type="button" disabled={saving} onClick={() => setSigning(true)}>
              Assinar e confirmar
            </button>
          )}
        </div>
      )}

      {signing && (
        <SignaturePad
          employeeName={data.encarregadoAssinante?.nome}
          saving={saving}
          error={actionError}
          confirmLabel="Confirmar retirada"
          savingLabel="Confirmando retirada..."
          onCancel={() => !saving && setSigning(false)}
          onConfirm={confirm}
          summary={(
            <dl className="summary-list">
              <div><dt>Operador</dt><dd>{data.operadorResponsavel?.nome}</dd></div>
              <div><dt>Contrato</dt><dd>{data.contrato?.nome ?? 'Não informado'}</dd></div>
              <div><dt>Materiais</dt><dd>{data.itens.length}</dd></div>
              <div><dt>Quantidade total</dt><dd>{data.itens.reduce((total, item) => total + item.quantidade, 0)} un.</dd></div>
            </dl>
          )}
        />
      )}
    </div>
  );
}
