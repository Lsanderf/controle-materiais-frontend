import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { roleLabel } from '../utils/formatters';
import telminasIcon from '../assets/telminas-icon.png';

const itemsByRole = {
  ADMIN: [
    ['/dashboard', 'Início', '⌂'], ['/materiais', 'Materiais', '▣'],
    ['/movimentacoes', 'Movimentar', '⇄'], ['/notas-fiscais', 'Notas fiscais', 'NF'],
    ['/movimentacoes/historico', 'Histórico', '◷'], ['/requisicoes', 'Requisições', '☷'],
    ['/encarregados', 'Encarregados', '♙'], ['/contratos', 'Contratos', '▤'],
    ['/usuarios', 'Usuários', '♚'],
  ],
  OPERADOR: [
    ['/dashboard', 'Início', '⌂'], ['/materiais', 'Materiais', '▣'],
    ['/movimentacoes', 'Movimentar', '⇄'], ['/notas-fiscais', 'Notas fiscais', 'NF'],
    ['/movimentacoes/historico', 'Histórico', '◷'], ['/requisicoes', 'Requisições', '☷'],
    ['/encarregados', 'Encarregados', '♙'], ['/contratos', 'Contratos', '▤'],
  ],
  GERENTE: [
    ['/dashboard', 'Início', '⌂'], ['/requisicoes', 'Requisições', '☷'],
    ['/encarregados', 'Encarregados', '♙'], ['/contratos', 'Contratos', '▤'],
  ],
  ENCARREGADO: [['/dashboard', 'Início', '⌂'], ['/requisicoes', 'Minhas requisições', '☷']],
};

function NavigationLink({ item }) {
  const [to, label, icon] = item;
  return <NavLink to={to} end={to === '/movimentacoes'} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><span aria-hidden="true">{icon}</span><span>{label}</span></NavLink>;
}

export default function AppLayout() {
  const { auth, role, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const items = itemsByRole[role] ?? [];
  const current = items.find(([to]) => location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(`${to}/`)));
  const pageTitle = current?.[1] ?? 'Controle de materiais';
  function handleLogout() { logout(); navigate('/login', { replace: true }); }
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark"><img src={telminasIcon} alt="Logo da Telminas" className="brand-logo" /></span><span className="brand-name"><strong>Telminas</strong><small>Controle de materiais</small></span></div>
      <nav className="sidebar-nav" aria-label="Navegação principal">{items.map((item) => <NavigationLink item={item} key={item[0]} />)}</nav>
      <div className="sidebar-user"><div><strong>{auth.username}</strong><span>{roleLabel(role)}</span></div><button type="button" className="text-button" onClick={handleLogout}>Sair</button></div>
    </aside>
    <div className="app-main"><header className="mobile-header"><div className="brand compact"><span className="brand-mark"><img src={telminasIcon} alt="Logo da Telminas" className="brand-logo" /></span></div><div><small>Controle de materiais</small><strong>{pageTitle}</strong></div></header><main className="page-content"><Outlet /></main><nav className="bottom-nav" aria-label="Navegação móvel">{items.slice(0, 3).map((item) => <NavigationLink item={item} key={item[0]} />)}<NavigationLink item={['/mais', 'Mais', '•••']} /></nav></div>
  </div>;
}
