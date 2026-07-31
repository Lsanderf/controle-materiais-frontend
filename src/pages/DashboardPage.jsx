import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ErrorMessage, Loading, MovementBadge } from '../components/Feedback';
import { useAuth } from '../context/useAuth';
import { useResource } from '../hooks/useResource';
import { contratoService } from '../services/contratoService';
import { funcionarioService } from '../services/funcionarioService';
import { materialService } from '../services/materialService';
import { movimentacaoService } from '../services/movimentacaoService';
import { sortMovementsNewestFirst } from '../utils/formatters';

export default function DashboardPage() {
  const { auth, hasAnyRole } = useAuth();
  const loader = useCallback(
    () =>
      Promise.all([
        materialService.list(),
        funcionarioService.list(),
        contratoService.list(),
        movimentacaoService.list(),
      ]),
    [],
  );
  const { data, loading, error, reload } = useResource(loader, [loader]);

  const [materials = [], employees = [], contracts = [], movements = []] =
    data ?? [];
  const latestMovements = sortMovementsNewestFirst(movements).slice(0, 5);
  const canMove = hasAnyRole('ADMIN', 'OPERADOR');

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
            <Link className="action-card action-entry" to="/movimentacoes/entrada">
              <span className="action-icon">＋</span>
              <span>
                <strong>Registrar entrada</strong>
                <small>Adicionar itens ao estoque</small>
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
                <small>Entregar material a um funcionário</small>
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
        <Link className="action-card action-materials" to="/materiais">
          <span className="action-icon">▣</span>
          <span>
            <strong>Consultar materiais</strong>
            <small>Ver itens e saldo disponível</small>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
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
          <section className="stat-grid" aria-label="Indicadores">
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
            <article className="stat-card">
              <span>Funcionários ativos</span>
              <strong>{employees.filter((employee) => employee.ativo).length}</strong>
              <small>{employees.length} cadastrados no total</small>
            </article>
            <article className="stat-card">
              <span>Contratos ativos</span>
              <strong>{contracts.filter((contract) => contract.ativo).length}</strong>
              <small>{contracts.length} cadastrados no total</small>
            </article>
          </section>

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
        </>
      )}
    </div>
  );
}
