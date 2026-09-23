import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const movementOptions = [
  {
    type: 'retirada',
    title: 'Retirada',
    description: 'Entregar materiais a um encarregado e contrato.',
    icon: '−',
    className: 'movement-withdraw',
  },
  {
    type: 'devolucao',
    title: 'Devolução',
    description: 'Registrar o retorno de materiais retirados.',
    icon: '↩',
    className: 'movement-return',
  },
];

export default function MovementsPage() {
  const { hasAnyRole } = useAuth();
  const canMove = hasAnyRole('ADMIN', 'OPERADOR');

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Operações</span>
          <h1>Movimentações</h1>
          <p>Registre retiradas e devoluções. Recebimentos entram por Nota Fiscal.</p>
        </div>
        <Link className="button button-secondary" to="/movimentacoes/historico">
          Ver histórico
        </Link>
      </header>

      {!canMove ? (
        <div className="alert alert-info">
          Seu perfil possui acesso somente à consulta. Você pode visualizar o
          histórico, mas não registrar movimentações.
        </div>
      ) : (
        <section className="movement-options">
          {movementOptions.map((option) => (
            <Link
              key={option.type}
              className={`movement-option ${option.className}`}
              to={`/movimentacoes/${option.type}`}
            >
              <span className="movement-option-icon">{option.icon}</span>
              <span>
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </section>
      )}

      <section className="content-card operation-guide">
        <h2>Como funciona</h2>
        <div className="guide-grid">
          <div>
            <span>1</span>
            <p>Selecione os dados da retirada ou devolução.</p>
          </div>
          <div>
            <span>2</span>
            <p>Confira o resumo antes de confirmar.</p>
          </div>
          <div>
            <span>3</span>
            <p>Entradas de estoque são feitas pela confirmação da NF.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
