const labels = { PENDENTE: 'Pendente', VISUALIZADA: 'Visualizada', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada' };

export default function RequisicaoStatusBadge({ status }) {
  return <span className={`badge requisicao-status requisicao-status-${status?.toLowerCase()}`}>{labels[status] ?? status}</span>;
}
