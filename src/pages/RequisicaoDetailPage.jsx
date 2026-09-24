import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorMessage, Loading, SuccessMessage } from '../components/Feedback';
import RequisicaoStatusBadge from '../components/RequisicaoStatusBadge';
import { useAuth } from '../context/useAuth';
import { useResource } from '../hooks/useResource';
import { requisicaoService } from '../services/requisicaoService';
import { formatRequisicaoDate, requisicaoTipoLabel } from '../utils/requisicoes';

export default function RequisicaoDetailPage() {
  const { id } = useParams(); const { role } = useAuth();
  const loader = useCallback(() => requisicaoService.get(id), [id]);
  const { data: requisicao, setData: setRequisicao, loading, error, reload } = useResource(loader, [loader]);
  const [actionError, setActionError] = useState(null); const [feedback, setFeedback] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { if (role === 'ENCARREGADO' && requisicao?.status === 'PENDENTE') requisicaoService.visualizar(requisicao.id).then(setRequisicao).catch(setActionError); }, [requisicao?.id, requisicao?.status, role, setRequisicao]);
  async function runAction(action, successMessage) { if (saving) return; setSaving(true); setActionError(null); try { setRequisicao(await action(requisicao.id)); setFeedback(successMessage); } catch (requestError) { setActionError(requestError); } finally { setSaving(false); } }
  if (loading && !requisicao) return <Loading label="Carregando requisição..." />;
  if (error && !requisicao) return <div><ErrorMessage error={error} /><button className="button button-secondary" onClick={reload}>Tentar novamente</button></div>;
  if (!requisicao) return null;
  const canConcluir = role === 'ENCARREGADO' && !['CONCLUIDA', 'CANCELADA'].includes(requisicao.status);
  const canCancelar = role === 'GERENTE' && ['PENDENTE', 'VISUALIZADA'].includes(requisicao.status);
  return <div className="page-stack narrow-page"><header className="page-heading"><div><Link className="text-link" to="/requisicoes">← Voltar</Link><span className="eyebrow">Requisição #{requisicao.id}</span><h1>{requisicaoTipoLabel(requisicao.tipo)}</h1><p>Enviada em {formatRequisicaoDate(requisicao.criadaEm)}</p></div><RequisicaoStatusBadge status={requisicao.status} /></header><SuccessMessage>{feedback}</SuccessMessage><ErrorMessage error={actionError} /><section className="content-card requisicao-detail"><dl><div><dt>Gerente solicitante</dt><dd>{requisicao.gerenteSolicitante.nome}</dd></div><div><dt>Encarregado destinatário</dt><dd>{requisicao.encarregadoDestinatario.nome}</dd></div><div><dt>Contrato</dt><dd>{requisicao.contrato.nome}</dd></div>{requisicao.visualizadaEm && <div><dt>Visualizada em</dt><dd>{formatRequisicaoDate(requisicao.visualizadaEm)}</dd></div>}{requisicao.concluidaEm && <div><dt>Concluída em</dt><dd>{formatRequisicaoDate(requisicao.concluidaEm)}</dd></div>}</dl><h2>Materiais solicitados</h2><ul className="requisicao-detail-items">{requisicao.itens.map((item) => <li key={item.id}>{item.descricao} x{item.quantidade}</li>)}</ul>{requisicao.observacao && <><h2>Observação</h2><p>{requisicao.observacao}</p></>}</section>{(canConcluir || canCancelar) && <div className="page-actions">{canCancelar && <button className="button button-secondary" disabled={saving} onClick={() => runAction(requisicaoService.cancelar, 'Requisição cancelada.')}>Cancelar requisição</button>}{canConcluir && <button className="button button-primary" disabled={saving} onClick={() => runAction(requisicaoService.concluir, 'Requisição marcada como concluída.')}>{saving ? 'Salvando...' : 'Marcar como concluída'}</button>}</div>}</div>;
}
