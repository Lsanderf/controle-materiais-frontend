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
  const fields = error.fields ? Object.values(error.fields) : [];

  return (
    <div className="alert alert-error" role="alert">
      <strong>{error.message ?? String(error)}</strong>
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
  };
  return (
    <span className={`badge badge-${type?.toLowerCase()}`}>
      {labels[type] ?? type}
    </span>
  );
}
