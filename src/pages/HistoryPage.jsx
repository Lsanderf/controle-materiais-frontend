import { useCallback, useMemo, useState } from 'react';
import {
  EmptyState,
  ErrorMessage,
  Loading,
  MovementBadge,
  SuccessMessage,
} from '../components/Feedback';
import { useResource } from '../hooks/useResource';
import { movimentacaoService } from '../services/movimentacaoService';
import { sortMovementsNewestFirst } from '../utils/formatters';
import MovementReceiptModal from '../components/MovementReceiptModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/useAuth';
import {
  canReverseMovement,
  normalizeReversalJustification,
} from '../utils/movementReversal';

const filters = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'ENTRADA', label: 'Entrada' },
  { value: 'RETIRADA', label: 'Retirada' },
  { value: 'DEVOLUCAO', label: 'Devolução' },
  { value: 'ESTORNO_RETIRADA', label: 'Estorno de retirada' },
  { value: 'ESTORNO_DEVOLUCAO', label: 'Estorno de devolução' },
];

export default function HistoryPage() {
  const { role } = useAuth();
  const [filter, setFilter] = useState('TODOS');
  const [selectedMovementId, setSelectedMovementId] = useState(null);
  const [movementToReverse, setMovementToReverse] = useState(null);
  const [justification, setJustification] = useState('');
  const [reversalKey, setReversalKey] = useState('');
  const [reversing, setReversing] = useState(false);
  const [reversalError, setReversalError] = useState(null);
  const [reversalFeedback, setReversalFeedback] = useState('');
  const loader = useCallback(() => movimentacaoService.list(), []);
  const {
    data: movements,
    loading,
    error,
    reload,
  } = useResource(loader, [loader]);

  const filteredMovements = useMemo(() => {
    const sorted = sortMovementsNewestFirst(movements ?? []);
    return filter === 'TODOS'
      ? sorted
      : sorted.filter((movement) => movement.tipo === filter);
  }, [filter, movements]);

  function canReverse(movement) {
    return canReverseMovement(movement, role);
  }

  function openReversal(movement) {
    setMovementToReverse(movement);
    setJustification('');
    setReversalError(null);
    setReversalFeedback('');
    setReversalKey(crypto.randomUUID());
  }

  function closeReversal() {
    if (reversing) return;
    setMovementToReverse(null);
    setJustification('');
    setReversalError(null);
    setReversalKey('');
  }

  async function reverseMovement() {
    if (reversing) return;
    let normalizedJustification;
    try {
      normalizedJustification = normalizeReversalJustification(justification);
    } catch (validationError) {
      setReversalError(validationError);
      return;
    }

    setReversing(true);
    setReversalError(null);
    try {
      const reversed = await movimentacaoService.estornar(
        movementToReverse.id,
        normalizedJustification,
        reversalKey,
      );
      setReversalFeedback(
        `Movimentação #${movementToReverse.id} estornada no registro #${reversed.id}.`,
      );
      setMovementToReverse(null);
      setJustification('');
      setReversalKey('');
      reload().catch(() => {});
    } catch (requestError) {
      setReversalError(requestError);
    } finally {
      setReversing(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Auditoria</span>
          <h1>Histórico</h1>
          <p>Consulte todas as movimentações registradas no sistema.</p>
        </div>
        <button className="button button-secondary" onClick={reload} disabled={loading}>
          Atualizar
        </button>
      </header>

      <SuccessMessage>{reversalFeedback}</SuccessMessage>

      <div className="filter-tabs" role="group" aria-label="Filtrar por tipo">
        {filters.map((item) => (
          <button
            type="button"
            key={item.value}
            className={filter === item.value ? 'active' : ''}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading label="Carregando histórico..." />
      ) : error ? (
        <div>
          <ErrorMessage error={error} />
          <button className="button button-secondary" onClick={reload}>
            Tentar novamente
          </button>
        </div>
      ) : filteredMovements.length === 0 ? (
        <EmptyState
          title="Nenhuma movimentação encontrada."
          description={
            filter === 'TODOS'
              ? 'Os registros aparecerão aqui após a primeira movimentação.'
              : 'Não há registros para o tipo selecionado.'
          }
        />
      ) : (
        <>
          <div className="mobile-card-list">
            {filteredMovements.map((movement) => (
              <article className="resource-card history-card" key={movement.id}>
                <div className="resource-card-heading">
                  <div>
                    <small>{movement.dataMovimentacao}</small>
                    <h2>{movement.material}</h2>
                  </div>
                  <MovementBadge type={movement.tipo} />
                </div>
                <dl className="history-details">
                  <div>
                    <dt>Quantidade</dt>
                    <dd>{movement.quantidade} un.</dd>
                  </div>
                  {movement.funcionario && (
                    <div>
                      <dt>Funcionário</dt>
                      <dd>{movement.funcionario}</dd>
                    </div>
                  )}
                  {movement.contrato && (
                    <div>
                      <dt>Contrato</dt>
                      <dd>{movement.contrato}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Registrado por</dt>
                    <dd>
                      {movement.usuarioUsername || 'Não informado'}
                      {movement.usuarioId && <small>ID {movement.usuarioId}</small>}
                    </dd>
                  </div>
                  {movement.movimentacaoOrigemId && (
                    <div>
                      <dt>Movimentação original</dt>
                      <dd>#{movement.movimentacaoOrigemId}</dd>
                    </div>
                  )}
                  {movement.movimentacaoOrigemId && movement.observacao && (
                    <div>
                      <dt>Justificativa</dt>
                      <dd>{movement.observacao}</dd>
                    </div>
                  )}
                  {movement.estornada && (
                    <div>
                      <dt>Estornada por</dt>
                      <dd>#{movement.estornoId}</dd>
                    </div>
                  )}
                </dl>
                <div className="resource-actions">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setSelectedMovementId(movement.id)}
                  >
                    Ver comprovante
                  </button>
                  {canReverse(movement) && (
                    <button
                      className="text-button danger"
                      type="button"
                      onClick={() => openReversal(movement)}
                    >
                      Estornar movimentação
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="table-wrap desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Material</th>
                  <th className="number-cell">Quantidade</th>
                  <th>Funcionário</th>
                  <th>Contrato</th>
                  <th>Registrado por</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{movement.dataMovimentacao}</td>
                    <td>
                      <MovementBadge type={movement.tipo} />
                      {movement.movimentacaoOrigemId && (
                        <small>Origem #{movement.movimentacaoOrigemId}</small>
                      )}
                      {movement.estornada && (
                        <small>Estornada por #{movement.estornoId}</small>
                      )}
                    </td>
                    <td>
                      <strong>{movement.material}</strong>
                      {movement.movimentacaoOrigemId && movement.observacao && (
                        <small>Justificativa: {movement.observacao}</small>
                      )}
                    </td>
                    <td className="number-cell">{movement.quantidade} un.</td>
                    <td>{movement.funcionario || '—'}</td>
                    <td>{movement.contrato || '—'}</td>
                    <td>
                      {movement.usuarioUsername ? (
                        <>
                          <strong>{movement.usuarioUsername}</strong>
                          <small>ID {movement.usuarioId}</small>
                        </>
                      ) : (
                        'Não informado'
                      )}
                    </td>
                    <td>
                      <div className="history-actions">
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => setSelectedMovementId(movement.id)}
                        >
                          Ver comprovante
                        </button>
                        {canReverse(movement) && (
                          <button
                            className="text-button danger"
                            type="button"
                            onClick={() => openReversal(movement)}
                          >
                            Estornar movimentação
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedMovementId && (
        <MovementReceiptModal
          movementId={selectedMovementId}
          onClose={() => setSelectedMovementId(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(movementToReverse)}
        title="Estornar movimentação"
        confirmLabel="Confirmar estorno"
        loading={reversing}
        onConfirm={reverseMovement}
        onCancel={closeReversal}
      >
        {movementToReverse && (
          <>
            <p>
              Será criado um estorno total da movimentação #{movementToReverse.id}.
              O registro original permanecerá intacto.
            </p>
            <label className="field" htmlFor="reversal-justification">
              <span>Justificativa</span>
              <textarea
                id="reversal-justification"
                value={justification}
                maxLength={1000}
                required
                disabled={reversing}
                placeholder="Descreva o erro que está sendo corrigido"
                onChange={(event) => {
                  setJustification(event.target.value);
                  setReversalError(null);
                }}
              />
            </label>
            <ErrorMessage error={reversalError} />
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
