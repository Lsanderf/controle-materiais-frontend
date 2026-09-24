export const requisicaoTipoLabel = (tipo) => (
  tipo === 'RETIRADA' ? 'Retirada' : tipo === 'DEVOLUCAO' ? 'Devolução' : tipo
);

export function formatRequisicaoDate(value) {
  if (!value) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}
