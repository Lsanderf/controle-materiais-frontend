import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="empty-state not-found">
      <span className="eyebrow">Erro 404</span>
      <h1>Página não encontrada</h1>
      <p>O endereço informado não existe nesta aplicação.</p>
      <Link className="button button-primary" to="/dashboard">
        Voltar ao início
      </Link>
    </div>
  );
}
