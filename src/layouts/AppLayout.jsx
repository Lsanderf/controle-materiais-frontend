import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { roleLabel } from '../utils/formatters';

const mainItems = [
  { to: '/dashboard', label: 'Início', icon: '⌂' },
  { to: '/materiais', label: 'Materiais', icon: '▣' },
  { to: '/movimentacoes', label: 'Movimentar', icon: '⇄', end: true },
  { to: '/movimentacoes/historico', label: 'Histórico', icon: '◷' },
];

function NavigationLink({ item, onClick }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
    >
      <span aria-hidden="true">{item.icon}</span>
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function AppLayout() {
  const { auth, role, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const titles = {
    '/dashboard': 'Visão geral',
    '/materiais': 'Materiais',
    '/funcionarios': 'Funcionários',
    '/contratos': 'Contratos',
    '/movimentacoes': 'Movimentações',
    '/movimentacoes/entrada': 'Registrar entrada',
    '/movimentacoes/retirada': 'Registrar retirada',
    '/movimentacoes/devolucao': 'Registrar devolução',
    '/movimentacoes/historico': 'Histórico',
    '/usuarios': 'Usuários',
    '/mais': 'Mais opções',
  };
  const pageTitle =
    titles[location.pathname] ??
    (location.pathname.includes('/editar') ? 'Editar cadastro' : 'Novo cadastro');

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">CM</span>
          <span>
            <strong>Controle</strong>
            <small>de materiais</small>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {mainItems.map((item) => (
            <NavigationLink item={item} key={item.to} />
          ))}
          <p className="nav-section">Cadastros</p>
          <NavigationLink
            item={{ to: '/funcionarios', label: 'Funcionários', icon: '♙' }}
          />
          <NavigationLink
            item={{ to: '/contratos', label: 'Contratos', icon: '▤' }}
          />
          {role === 'ADMIN' && (
            <NavigationLink
              item={{ to: '/usuarios', label: 'Usuários', icon: '♚' }}
            />
          )}
        </nav>

        <div className="sidebar-user">
          <div>
            <strong>{auth.username}</strong>
            <span>{roleLabel(role)}</span>
          </div>
          <button type="button" className="text-button" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="mobile-header">
          <div className="brand compact">
            <span className="brand-mark">CM</span>
          </div>
          <div>
            <small>Controle de materiais</small>
            <strong>{pageTitle}</strong>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>

        <nav className="bottom-nav" aria-label="Navegação móvel">
          {mainItems.slice(0, 3).map((item) => (
            <NavigationLink item={item} key={item.to} />
          ))}
          <NavigationLink item={{ to: '/mais', label: 'Mais', icon: '•••' }} />
        </nav>
      </div>
    </div>
  );
}
