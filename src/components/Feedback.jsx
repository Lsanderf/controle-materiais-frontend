import { safeErrorFields, safeErrorText } from '../services/apiErrors.js';

export function Loading({ label = 'Carregando...' }) {
  return (
    <div className="state-box" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorMessage({ error }) {
  if (!error) return null;
  const fields = Object.values(safeErrorFields(error.fields));

  return (
    <div className="alert alert-error" role="alert">
      <strong>{safeErrorText(typeof error === 'string' ? error : error.message)}</strong>
      {fields.length > 0 && (
        <ul>
          {fields.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SuccessMessage({ children }) {
  if (!children) return null;
  return (
    <div className="alert alert-success" role="status">
      {children}
    </div>
  );
}

export function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </div>
  );
}

export function StatusBadge({ active }) {
  return (
    <span className={`badge ${active ? 'badge-active' : 'badge-inactive'}`}>
      {active ? 'Ativo' : 'Inativo'}
    </span>
  );
}

export function MovementBadge({ type }) {
  const labels = {
    ENTRADA: 'Entrada',
    RETIRADA: 'Retirada',
    DEVOLUCAO: 'Devolução',
    ESTORNO_RETIRADA: 'Estorno de retirada',
    ESTORNO_DEVOLUCAO: 'Estorno de devolução',
  };
  return (
    <span className={`badge badge-${type?.toLowerCase()}`}>
      {labels[type] ?? type}
    </span>
  );
}
