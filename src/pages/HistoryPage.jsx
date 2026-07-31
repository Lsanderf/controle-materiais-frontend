import { useCallback, useMemo, useState } from 'react';
import {
  EmptyState,
  ErrorMessage,
  Loading,
  MovementBadge,
} from '../components/Feedback';
import { useResource } from '../hooks/useResource';
import { movimentacaoService } from '../services/movimentacaoService';
import { sortMovementsNewestFirst } from '../utils/formatters';

const filters = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'ENTRADA', label: 'Entrada' },
  { value: 'RETIRADA', label: 'Retirada' },
  { value: 'DEVOLUCAO', label: 'Devolução' },
];

export default function HistoryPage() {
  const [filter, setFilter] = useState('TODOS');
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
                </dl>
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
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{movement.dataMovimentacao}</td>
                    <td>
                      <MovementBadge type={movement.tipo} />
                    </td>
                    <td>
                      <strong>{movement.material}</strong>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
