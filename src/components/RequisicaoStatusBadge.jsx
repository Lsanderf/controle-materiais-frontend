const labels = {
  PENDENTE: 'Pendente',
  VISUALIZADA: 'Visualizada',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
  AGUARDANDO_ASSINATURA: 'Aguardando assinatura',
  CONFIRMADA: 'Confirmada',
};

const styleStatus = {
  AGUARDANDO_ASSINATURA: 'pendente',
  CONFIRMADA: 'concluida',
};

export default function RequisicaoStatusBadge({ status }) {
  const statusClass = styleStatus[status] ?? status?.toLowerCase();
  return <span className={`badge requisicao-status requisicao-status-${statusClass}`}>{labels[status] ?? status}</span>;
}
