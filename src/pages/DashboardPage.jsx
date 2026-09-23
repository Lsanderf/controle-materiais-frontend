import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function DashboardPage() {
  const { auth, role } = useAuth();
  const content = {
    ADMIN: ['Administração completa', 'Gerencie usuários, estoque, contratos e rastreabilidade.', [['/usuarios', 'Administrar usuários'], ['/requisicoes', 'Ver requisições'], ['/movimentacoes', 'Movimentar estoque']]],
    OPERADOR: ['Operação do almoxarifado', 'Atenda requisições e registre o que realmente saiu ou voltou ao estoque.', [['/requisicoes', 'Atender requisições'], ['/movimentacoes', 'Registrar movimentação'], ['/notas-fiscais', 'Notas fiscais']]],
    GERENTE: ['Gestão de solicitações', 'Crie requisições para encarregados e administre contratos.', [['/requisicoes/nova', 'Nova requisição'], ['/requisicoes', 'Minhas requisições'], ['/contratos', 'Contratos']]],
    ENCARREGADO: ['Recebimentos', 'Acompanhe apenas suas requisições e confirme os materiais recebidos.', [['/requisicoes', 'Minhas requisições']]],
  }[role];
  return <div className="page-stack"><header className="page-heading dashboard-heading"><div><span className="eyebrow">Visão geral</span><h1>Olá, {auth.username}</h1><p>{content?.[1]}</p></div></header><section className="content-card"><h2>{content?.[0]}</h2><div className="quick-actions">{content?.[2].map(([to, label]) => <Link className="action-card" to={to} key={to}><strong>{label}</strong><span aria-hidden="true">→</span></Link>)}</div></section></div>;
}
