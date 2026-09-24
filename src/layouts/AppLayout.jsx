import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { roleLabel } from '../utils/formatters';
import { canAccessEncarregados } from '../utils/encarregados';
import telminasIcon from '../assets/telminas-icon.png';

const mainItems = [
  { to: '/dashboard', label: 'Início', icon: '⌂' },
  { to: '/materiais', label: 'Materiais', icon: '▣', roles: ['ADMIN', 'OPERADOR'] },
  { to: '/movimentacoes', label: 'Movimentar', icon: '⇄', end: true, roles: ['ADMIN', 'OPERADOR'] },
  { to: '/requisicoes', label: 'Requisições', icon: '✉', roles: ['ADMIN', 'GERENTE', 'ENCARREGADO'] },
  { to: '/notas-fiscais', label: 'Notas fiscais', icon: 'NF', roles: ['ADMIN', 'OPERADOR'] },
  { to: '/movimentacoes/historico', label: 'Histórico', icon: '◷', roles: ['ADMIN', 'OPERADOR'] },
];

function NavigationLink({ item, onClick }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        isActive ? 'nav-link active' : 'nav-link'
      }
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
    '/encarregados': 'Encarregados',
    '/contratos': 'Contratos',
    '/movimentacoes': 'Movimentações',
    '/requisicoes': 'Requisições',
    '/movimentacoes/retirada': 'Registrar retirada',
    '/movimentacoes/devolucao': 'Registrar devolução',
    '/movimentacoes/historico': 'Histórico',
    '/notas-fiscais': 'Notas fiscais',
    '/notas-fiscais/nova': 'Nova nota fiscal',
    '/usuarios': 'Usuários',
    '/mais': 'Mais opções',
  };

  const pageTitle =
    titles[location.pathname] ??
    (location.pathname.startsWith('/notas-fiscais/') &&
    location.pathname.includes('/editar')
      ? 'Editar nota fiscal'
      : location.pathname.startsWith('/notas-fiscais/')
        ? 'Nota fiscal'
        : null) ??
    (location.pathname.includes('/editar')
      ? 'Editar cadastro'
      : 'Novo cadastro');
  const visibleMainItems = mainItems.filter(
    (item) => !item.roles || item.roles.includes(role),
  );
  const canAccessContracts = ['ADMIN', 'OPERADOR', 'GERENTE'].includes(role);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <img
              src={telminasIcon}
              alt="Logo da Telminas"
              className="brand-logo"
            />
          </span>

          <span className="brand-name">
            <strong>Telminas</strong>
            <small>Controle de materiais</small>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {visibleMainItems.map((item) => (
            <NavigationLink item={item} key={item.to} />
          ))}

          <p className="nav-section">Cadastros</p>

          {canAccessEncarregados(role) && (
            <NavigationLink
              item={{
                to: '/encarregados',
                label: 'Encarregados',
                icon: '♙',
              }}
            />
          )}

          {canAccessContracts && (
            <NavigationLink
              item={{
                to: '/contratos',
                label: 'Contratos',
                icon: '▤',
              }}
            />
          )}

          {role === 'ADMIN' && (
            <NavigationLink
              item={{
                to: '/usuarios',
                label: 'Usuários',
                icon: '♚',
              }}
            />
          )}
        </nav>

        <div className="sidebar-user">
          <div>
            <strong>{auth.username}</strong>
            <span>{roleLabel(role)}</span>
          </div>

          <button
            type="button"
            className="text-button"
            onClick={handleLogout}
          >
            Sair
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="mobile-header">
          <div className="brand compact">
            <span className="brand-mark">
              <img
                src={telminasIcon}
                alt="Logo da Telminas"
                className="brand-logo"
              />
            </span>
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
          {visibleMainItems.slice(0, 3).map((item) => (
            <NavigationLink item={item} key={item.to} />
          ))}

          <NavigationLink
            item={{
              to: '/mais',
              label: 'Mais',
              icon: '•••',
            }}
          />
        </nav>
      </div>
    </div>
  );
}
