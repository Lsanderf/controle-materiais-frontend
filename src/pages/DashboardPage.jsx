import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ErrorMessage, Loading, MovementBadge } from '../components/Feedback';
import { useAuth } from '../context/useAuth';
import { useResource } from '../hooks/useResource';
import { contratoService } from '../services/contratoService';
import { usuarioService } from '../services/usuarioService';
import { materialService } from '../services/materialService';
import { movimentacaoService } from '../services/movimentacaoService';
import { requisicaoService } from '../services/requisicaoService';
import { sortMovementsNewestFirst } from '../utils/formatters';

export default function DashboardPage() {
  const { auth, hasAnyRole } = useAuth();
  const canAccessOperationalData = hasAnyRole('ADMIN', 'OPERADOR');
  const canAccessManagementData = hasAnyRole('ADMIN', 'OPERADOR', 'GERENTE');
  const isEncarregado = hasAnyRole('ENCARREGADO');
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

      if (isEncarregado) return requisicaoService.list();

      return Promise.resolve([]);
    },
    [canAccessManagementData, canAccessOperationalData, isEncarregado],
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
  const requisicoesRecebidas = isEncarregado ? data ?? [] : [];
  const requisicoesPendentes = requisicoesRecebidas.filter(
    (requisicao) => requisicao.status === 'PENDENTE',
  );

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
        {hasAnyRole('GERENTE') && (
          <Link className="action-card action-materials" to="/requisicoes">
            <span className="action-icon">✉</span>
            <span>
              <strong>Nova requisição</strong>
              <small>Solicite materiais a um encarregado</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        )}
        {isEncarregado && (
          <Link className="action-card action-materials" to="/requisicoes">
            <span className="action-icon">✉</span>
            <span>
              <strong>Requisições recebidas</strong>
              <small>{requisicoesPendentes.length} pendentes</small>
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
          {isEncarregado ? (
            <>
              <section className="stat-grid" aria-label="Indicadores de requisições">
                <article className="stat-card">
                  <span>Requisições recebidas</span>
                  <strong>{requisicoesRecebidas.length}</strong>
                  <small>{requisicoesPendentes.length} pendentes</small>
                </article>
              </section>
              <section className="content-card">
                <div className="section-heading">
                  <div>
                    <h2>Requisições recebidas</h2>
                    <p>Abra uma solicitação para visualizar seus materiais e concluí-la.</p>
                  </div>
                  <Link className="text-link" to="/requisicoes">Ver todas</Link>
                </div>
                {requisicoesRecebidas.length === 0 ? (
                  <p className="muted">Nenhuma requisição recebida.</p>
                ) : (
                  <div className="recent-list">
                    {requisicoesRecebidas.slice(0, 5).map((requisicao) => (
                      <Link className="recent-item requisicao-dashboard-item" to={`/requisicoes/${requisicao.id}`} key={requisicao.id}>
                        <span className="badge">{requisicao.tipo === 'RETIRADA' ? 'Retirada' : 'Devolução'}</span>
                        <div>
                          <strong>{requisicao.gerenteSolicitante.nome}</strong>
                          <span>{requisicao.contrato.nome} · {requisicao.status}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : canAccessManagementData ? (
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
