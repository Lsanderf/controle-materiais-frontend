import { useCallback, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  EmptyState,
  ErrorMessage,
  Loading,
  MovementBadge,
  SuccessMessage,
} from '../components/Feedback';
import { useAuth } from '../context/useAuth';
import { useResource } from '../hooks/useResource';
import { notaFiscalService } from '../services/notaFiscalService';
import {
  canConfirmNotaFiscal,
  canEditNotaFiscal,
  canManageNotaFiscal,
  formatChaveAcesso,
  formatCnpj,
  formatCurrency,
  formatNotaFiscalDate,
  formatNotaFiscalDateTime,
  notaFiscalStatusLabel,
} from '../utils/notaFiscal';

function NotaFiscalStatusBadge({ status }) {
  return (
    <span className={`badge badge-${status?.toLowerCase()}`}>
      {notaFiscalStatusLabel(status)}
    </span>
  );
}

export default function NotaFiscalDetailPage() {
  const { id } = useParams();
  const { role } = useAuth();
  const location = useLocation();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState(location.state?.success ?? '');
  const loader = useCallback(() => notaFiscalService.get(id), [id]);
  const {
    data: notaFiscal,
    setData: setNotaFiscal,
    loading,
    error,
    reload,
  } = useResource(loader, [loader]);

  const canEdit = canEditNotaFiscal(notaFiscal, role);
  const canConfirm = canConfirmNotaFiscal(notaFiscal, role);
  const canManage = canManageNotaFiscal(role);
  const hasItems = (notaFiscal?.itens ?? []).length > 0;

  async function confirmNotaFiscal() {
    setSaving(true);
    setActionError(null);
    setSuccess('');
    try {
      const updated = await notaFiscalService.confirm(id);
      setNotaFiscal(updated);
      setSuccess('Nota fiscal confirmada. Os itens foram lancados no estoque.');
      setConfirming(false);
    } catch (requestError) {
      setActionError(requestError);
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Carregando nota fiscal..." />;

  if (error) {
    return (
      <div>
        <ErrorMessage error={error} />
        <button className="button button-secondary" onClick={reload}>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!notaFiscal) {
    return (
      <EmptyState
        title="Nota fiscal nao encontrada."
        description="Verifique se o registro ainda existe."
      />
    );
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Recebimento</span>
          <h1>
            NF {notaFiscal.numero} / {notaFiscal.serie}
          </h1>
          <p>{notaFiscal.fornecedor}</p>
        </div>
        <div className="page-actions">
          <Link className="button button-secondary" to="/notas-fiscais">
            Voltar
          </Link>
          {canEdit && (
            <Link
              className="button button-secondary"
              to={`/notas-fiscais/${notaFiscal.id}/editar`}
            >
              Editar
            </Link>
          )}
          {canManage && notaFiscal.status === 'RASCUNHO' && (
            <button
              className="button button-primary"
              type="button"
              disabled={!hasItems || !canConfirm}
              onClick={() => setConfirming(true)}
            >
              Confirmar NF
            </button>
          )}
        </div>
      </header>

      <SuccessMessage>{success}</SuccessMessage>
      <ErrorMessage error={actionError} />

      {canManage && notaFiscal.status === 'RASCUNHO' && !hasItems && (
        <div className="alert alert-warning">
          Inclua pelo menos um item para confirmar esta nota fiscal.
        </div>
      )}

      <section className="content-card">
        <div className="section-heading">
          <div>
            <h2>Dados gerais</h2>
            <p>Informacoes documentais retornadas pelo backend.</p>
          </div>
          <NotaFiscalStatusBadge status={notaFiscal.status} />
        </div>

        <dl className="summary-list invoice-summary-grid">
          <div>
            <dt>Identificador</dt>
            <dd>#{notaFiscal.id}</dd>
          </div>
          <div>
            <dt>Numero</dt>
            <dd>{notaFiscal.numero}</dd>
          </div>
          <div>
            <dt>Serie</dt>
            <dd>{notaFiscal.serie}</dd>
          </div>
          <div>
            <dt>Chave de acesso</dt>
            <dd className="monospace-cell">
              {formatChaveAcesso(notaFiscal.chaveAcesso)}
            </dd>
          </div>
          <div>
            <dt>Fornecedor</dt>
            <dd>{notaFiscal.fornecedor}</dd>
          </div>
          <div>
            <dt>CNPJ</dt>
            <dd>{formatCnpj(notaFiscal.cnpjFornecedor)}</dd>
          </div>
          <div>
            <dt>Data de emissao</dt>
            <dd>{formatNotaFiscalDate(notaFiscal.dataEmissao)}</dd>
          </div>
          <div>
            <dt>Data de entrada</dt>
            <dd>{formatNotaFiscalDateTime(notaFiscal.dataEntrada)}</dd>
          </div>
          <div>
            <dt>Cadastrada por</dt>
            <dd>{notaFiscal.cadastradaPorUsername ?? 'Nao informado'}</dd>
          </div>
          <div>
            <dt>Valor total</dt>
            <dd>{formatCurrency(notaFiscal.valorTotal)}</dd>
          </div>
        </dl>
      </section>

      <section className="content-card">
        <div className="section-heading">
          <div>
            <h2>Itens</h2>
            <p>Materiais que serao lancados ao confirmar a NF.</p>
          </div>
        </div>

        {(notaFiscal.itens ?? []).length === 0 ? (
          <p className="muted">Nenhum item cadastrado neste rascunho.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="number-cell">Quantidade</th>
                  <th className="number-cell">Valor unitario</th>
                  <th className="number-cell">Valor total</th>
                </tr>
              </thead>
              <tbody>
                {notaFiscal.itens.map((item) => (
                  <tr key={item.id ?? item.materialId}>
                    <td>
                      <strong>{item.material}</strong>
                      <small>Material #{item.materialId}</small>
                    </td>
                    <td className="number-cell">{item.quantidade} un.</td>
                    <td className="number-cell">
                      {formatCurrency(item.valorUnitario)}
                    </td>
                    <td className="number-cell">
                      {formatCurrency(item.valorTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="content-card">
        <div className="section-heading">
          <div>
            <h2>Movimentacoes geradas</h2>
            <p>Entradas criadas automaticamente pela confirmacao da NF.</p>
          </div>
        </div>

        {(notaFiscal.movimentacoes ?? []).length === 0 ? (
          <p className="muted">
            A confirmacao ainda nao gerou movimentacoes de entrada.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Material</th>
                  <th className="number-cell">Quantidade</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {notaFiscal.movimentacoes.map((movement) => (
                  <tr key={movement.id}>
                    <td>
                      <MovementBadge type={movement.tipo} />
                    </td>
                    <td>
                      <strong>{movement.material}</strong>
                      <small>NF #{movement.notaFiscalId}</small>
                    </td>
                    <td className="number-cell">{movement.quantidade} un.</td>
                    <td>{movement.dataMovimentacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirming}
        title="Confirmar Nota Fiscal?"
        loading={saving}
        confirmLabel="Confirmar e lancar estoque"
        onCancel={() => setConfirming(false)}
        onConfirm={confirmNotaFiscal}
      >
        <p>
          Ao confirmar esta Nota Fiscal, seus itens serao lancados no estoque.
          Deseja continuar?
        </p>
      </ConfirmDialog>
    </div>
  );
}
