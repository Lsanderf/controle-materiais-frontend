import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { roleLabel } from '../utils/formatters';

export default function MorePage() {
  const { auth, role, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const items = [
    {
      to: '/funcionarios',
      title: 'Funcionários',
      description: 'Cadastros e situação dos funcionários',
      icon: '♙',
    },
    {
      to: '/contratos',
      title: 'Contratos',
      description: 'Contratos ativos e inativos',
      icon: '▤',
    },
    {
      to: '/movimentacoes/historico',
      title: 'Histórico',
      description: 'Todas as entradas, retiradas e devoluções',
      icon: '◷',
    },
  ];

  if (role === 'ADMIN') {
    items.push({
      to: '/usuarios',
      title: 'Usuários',
      description: 'Criar um novo acesso ao sistema',
      icon: '♚',
    });
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Menu</span>
          <h1>Mais opções</h1>
          <p>Acesse cadastros e configurações da sua conta.</p>
        </div>
      </header>

      <section className="profile-card">
        <span className="profile-avatar">
          {auth.username?.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <strong>{auth.username}</strong>
          <span>{roleLabel(role)}</span>
        </div>
      </section>

      <nav className="more-list" aria-label="Mais opções">
        {items.map((item) => (
          <Link key={item.to} to={item.to}>
            <span className="more-icon">{item.icon}</span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
        <button type="button" onClick={handleLogout}>
          <span className="more-icon danger">↪</span>
          <span>
            <strong>Sair</strong>
            <small>Encerrar a sessão neste dispositivo</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      </nav>
    </div>
  );
}
