import { Link } from 'react-router-dom';
import { EmptyState, ErrorMessage, Loading } from '../components/Feedback';
import RequisicaoStatusBadge from '../components/RequisicaoStatusBadge';
import { useAuth } from '../context/useAuth';
import { useResource } from '../hooks/useResource';
import { solicitacaoRetiradaService } from '../services/solicitacaoRetiradaService';
import { formatDateTime } from '../utils/formatters';

export default function WithdrawalRequestsPage() {
  const { role } = useAuth();
  const { data = [], loading, error, reload } = useResource(solicitacaoRetiradaService.list, []);
  if (loading) return <Loading label="Carregando solicitações..." />;
  if (error) return <div><ErrorMessage error={error} /><button className="button button-secondary" onClick={reload}>Tentar novamente</button></div>;
  const isEncarregado = role === 'ENCARREGADO';

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Retiradas</span>
          <h1>Solicitações de retirada</h1>
          <p>
            {isEncarregado
              ? 'Confira e assine somente as retiradas destinadas a você.'
              : 'Acompanhe as retiradas preparadas e o estado de cada assinatura.'}
          </p>
        </div>
      </header>

      {data.length === 0 ? (
        <EmptyState
          title="Nenhuma solicitação de retirada encontrada."
          description={isEncarregado ? 'As retiradas destinadas a você aparecerão aqui.' : 'Prepare uma retirada para iniciar o fluxo de assinatura.'}
        />
      ) : (
        <section className="requisicao-list" aria-label="Lista de solicitações de retirada">
          {data.map((item) => (
            <Link className="resource-card requisicao-card" to={`/solicitacoes-retirada/${item.id}`} key={item.id}>
              <div className="resource-card-heading">
                <div>
                  <small>{formatDateTime(item.criadaEm) ?? 'Data não informada'}</small>
                  <h2>Retirada #{item.id}</h2>
                </div>
                <RequisicaoStatusBadge status={item.status} />
              </div>
              <dl className="requisicao-summary">
                <div><dt>Encarregado</dt><dd>{item.encarregadoAssinante?.nome ?? 'Não informado'}</dd></div>
                <div><dt>Operador</dt><dd>{item.operadorResponsavel?.nome ?? 'Não informado'}</dd></div>
                <div><dt>Contrato</dt><dd>{item.contrato?.nome ?? 'Não informado'}</dd></div>
                <div><dt>Materiais</dt><dd>{item.itens.length}</dd></div>
              </dl>
              <span className="text-link">Ver detalhes →</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
