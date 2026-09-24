import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ErrorMessage, Loading, MovementBadge } from '../components/Feedback';
import { useAuth } from '../context/useAuth';
import { useResource } from '../hooks/useResource';
import { contratoService } from '../services/contratoService';
import { usuarioService } from '../services/usuarioService';
import { materialService } from '../services/materialService';
import { movimentacaoService } from '../services/movimentacaoService';
import { sortMovementsNewestFirst } from '../utils/formatters';

export default function DashboardPage() {
  const { auth, hasAnyRole } = useAuth();
  const canAccessOperationalData = hasAnyRole('ADMIN', 'OPERADOR');
  const canAccessManagementData = hasAnyRole('ADMIN', 'OPERADOR', 'GERENTE');
  const loader = useCallback(
    () => {
      if (canAccessOperationalData) {
        return Promise.all([
          materialService.list(),
          usuarioService.listEncarregados(),
          contratoService.list(),
          movimentacaoService.list(),
        ]);
      }

      if (canAccessManagementData) {
        return Promise.all([
          usuarioService.listEncarregados(),
          contratoService.list(),
        ]);
      }

      return Promise.resolve([]);
    },
    [canAccessManagementData, canAccessOperationalData],
  );
  const { data, loading, error, reload } = useResource(loader, [loader]);

  const [materials = [], employees = [], contracts = [], movements = []] =
    canAccessOperationalData
      ? data ?? []
      : canAccessManagementData
        ? [[], ...(data ?? []), []]
        : [];
  const latestMovements = sortMovementsNewestFirst(movements).slice(0, 5);
  const canMove = canAccessOperationalData;

  return (
    <div className="page-stack">
      <header className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">Visão geral</span>
          <h1>Olá, {auth.username}</h1>
          <p>Acompanhe o estoque e escolha o que precisa fazer agora.</p>
        </div>
      </header>

      <section className="quick-actions" aria-label="Ações rápidas">
        {canMove && (
          <>
            <Link className="action-card action-entry" to="/notas-fiscais/nova">
              <span className="action-icon">＋</span>
              <span>
                <strong>Nova nota fiscal</strong>
                <small>Receber materiais por NF</small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              className="action-card action-withdraw"
              to="/movimentacoes/retirada"
            >
              <span className="action-icon">−</span>
              <span>
                <strong>Registrar retirada</strong>
                <small>Entregar material a um encarregado</small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              className="action-card action-return"
              to="/movimentacoes/devolucao"
            >
              <span className="action-icon">↩</span>
              <span>
                <strong>Registrar devolução</strong>
                <small>Retornar material ao estoque</small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          </>
        )}
        {canAccessOperationalData && (
          <Link className="action-card action-materials" to="/materiais">
            <span className="action-icon">▣</span>
            <span>
              <strong>Ver materiais</strong>
              <small>Ver itens e saldo disponível</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </section>

      {loading ? (
        <Loading label="Carregando resumo..." />
      ) : error ? (
        <div>
          <ErrorMessage error={error} />
          <button className="button button-secondary" onClick={reload}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          {canAccessManagementData ? (
            <>
              <section className="stat-grid" aria-label="Indicadores">
                {canAccessOperationalData && (
                  <article className="stat-card">
                    <span>Materiais</span>
                    <strong>{materials.length}</strong>
                    <small>
                      {materials.reduce(
                        (total, material) => total + material.quantidadeEstoque,
                        0,
                      )}{' '}
                      unidades em estoque
                    </small>
                  </article>
                )}
                <article className="stat-card">
                  <span>Encarregados ativos</span>
                  <strong>{employees.filter((employee) => employee.ativo).length}</strong>
                  <small>{employees.length} cadastrados no total</small>
                </article>
                <article className="stat-card">
                  <span>Contratos ativos</span>
                  <strong>{contracts.filter((contract) => contract.ativo).length}</strong>
                  <small>{contracts.length} cadastrados no total</small>
                </article>
              </section>

              {canAccessOperationalData && (
                <section className="content-card">
                  <div className="section-heading">
                    <div>
                      <h2>Movimentações recentes</h2>
                      <p>Os últimos registros encontrados no sistema.</p>
                    </div>
                    <Link className="text-link" to="/movimentacoes/historico">
                      Ver histórico
                    </Link>
                  </div>
                  {latestMovements.length === 0 ? (
                    <p className="muted">Nenhuma movimentação registrada.</p>
                  ) : (
                    <div className="recent-list">
                      {latestMovements.map((movement) => (
                        <article className="recent-item" key={movement.id}>
                          <MovementBadge type={movement.tipo} />
                          <div>
                            <strong>{movement.material}</strong>
                            <span>
                              {movement.funcionario || 'Estoque'} ·{' '}
                              {movement.dataMovimentacao}
                            </span>
                            <span>
                              Registrado por{' '}
                              {movement.usuarioUsername || 'Não informado'}
                            </span>
                          </div>
                          <strong>{movement.quantidade} un.</strong>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          ) : (
            <div className="alert alert-info">
              Seu perfil não possui acesso às informações gerenciais.
            </div>
          )}
        </>
      )}
    </div>
  );
}
