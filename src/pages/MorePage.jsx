import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { roleLabel } from '../utils/formatters';

const roleItems = {
  ADMIN: [['/requisicoes', 'Requisições'], ['/encarregados', 'Encarregados'], ['/contratos', 'Contratos'], ['/movimentacoes/historico', 'Histórico'], ['/notas-fiscais', 'Notas fiscais'], ['/usuarios', 'Usuários']],
  OPERADOR: [['/requisicoes', 'Requisições'], ['/encarregados', 'Encarregados'], ['/contratos', 'Contratos'], ['/movimentacoes/historico', 'Histórico'], ['/notas-fiscais', 'Notas fiscais']],
  GERENTE: [['/requisicoes', 'Requisições'], ['/encarregados', 'Encarregados'], ['/contratos', 'Contratos']],
  ENCARREGADO: [['/requisicoes', 'Minhas requisições']],
};

export default function MorePage() {
  const { auth, role, logout } = useAuth();
  const navigate = useNavigate();
  function handleLogout() { logout(); navigate('/login', { replace: true }); }
  return <div className="page-stack"><header className="page-heading"><div><span className="eyebrow">Menu</span><h1>Mais opções</h1><p>Acesse apenas as funções disponíveis para o seu perfil.</p></div></header><section className="profile-card"><span className="profile-avatar">{auth.username?.slice(0, 1).toUpperCase()}</span><div><strong>{auth.username}</strong><span>{roleLabel(role)}</span></div></section><nav className="more-list" aria-label="Mais opções">{(roleItems[role] ?? []).map(([to, title]) => <Link key={to} to={to}><span className="more-icon">→</span><span><strong>{title}</strong></span><span aria-hidden="true">→</span></Link>)}<button type="button" onClick={handleLogout}><span className="more-icon danger">↪</span><span><strong>Sair</strong><small>Encerrar a sessão neste dispositivo</small></span><span aria-hidden="true">→</span></button></nav></div>;
}
