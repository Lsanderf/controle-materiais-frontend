import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorMessage, Loading, SuccessMessage } from '../components/Feedback';
import RequisicaoStatusBadge from '../components/RequisicaoStatusBadge';
import { useAuth } from '../context/useAuth';
import { useResource } from '../hooks/useResource';
import { contratoService } from '../services/contratoService';
import { materialService } from '../services/materialService';
import { requisicaoService } from '../services/requisicaoService';
import { usuarioService } from '../services/usuarioService';
import { formatRequisicaoDate, requisicaoTipoLabel } from '../utils/requisicoes';

const emptyItem = () => ({ materialId: '', quantidade: '' });

export default function RequisicoesPage() {
  const { role } = useAuth();
  const isGerente = role === 'GERENTE';
  const isEncarregado = role === 'ENCARREGADO';
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ encarregadoDestinatarioId: '', contratoId: '', tipo: 'RETIRADA', observacao: '', itens: [emptyItem()] });
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState('');
  const loader = useCallback(() => {
    if (!isGerente) return requisicaoService.list();
    return Promise.all([requisicaoService.list(), usuarioService.listEncarregados(), contratoService.list(), materialService.list()]);
  }, [isGerente]);
  const { data, loading, error, reload } = useResource(loader, [loader]);
  const [requisicoes = [], encarregados = [], contratos = [], materiais = []] = isGerente ? data ?? [] : [data ?? []];

  function updateForm(field, value) { setActionError(null); setForm((current) => ({ ...current, [field]: value })); }
  function updateItem(index, field, value) {
    setActionError(null);
    setForm((current) => ({ ...current, itens: current.itens.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  }
  function addItem() { setForm((current) => ({ ...current, itens: [...current.itens, emptyItem()] })); }
  function removeItem(index) { setForm((current) => ({ ...current, itens: current.itens.length === 1 ? current.itens : current.itens.filter((_, itemIndex) => itemIndex !== index) })); }
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const itens = form.itens.map((item) => ({ materialId: Number(item.materialId), quantidade: Number(item.quantidade) }));
    if (!form.encarregadoDestinatarioId || !form.contratoId || itens.some((item) => !Number.isInteger(item.materialId) || !Number.isInteger(item.quantidade) || item.quantidade < 1)) {
      setActionError(new Error('Selecione destinatário, contrato e informe uma quantidade válida para cada material.'));
      return;
    }
    setSaving(true); setActionError(null);
    try {
      await requisicaoService.create({ encarregadoDestinatarioId: Number(form.encarregadoDestinatarioId), contratoId: Number(form.contratoId), tipo: form.tipo, observacao: form.observacao.trim() || null, itens });
      setSuccess('Requisição enviada ao encarregado com sucesso.'); setFormOpen(false);
      setForm({ encarregadoDestinatarioId: '', contratoId: '', tipo: 'RETIRADA', observacao: '', itens: [emptyItem()] });
      reload().catch(() => {});
    } catch (requestError) { setActionError(requestError); } finally { setSaving(false); }
  }

  return <div className="page-stack"><header className="page-heading"><div><span className="eyebrow">{isEncarregado ? 'Recebimento' : 'Solicitações'}</span><h1>{isEncarregado ? 'Requisições recebidas' : isGerente ? 'Minhas requisições' : 'Requisições'}</h1><p>{isEncarregado ? 'Confira e conclua as solicitações enviadas para você.' : 'Acompanhe solicitações de retirada e devolução sem alterar o estoque.'}</p></div>{isGerente && <button className="button button-primary" type="button" onClick={() => setFormOpen((open) => !open)}>+ Nova requisição</button>}</header><SuccessMessage>{success}</SuccessMessage><ErrorMessage error={actionError} />
    {isGerente && formOpen && <form className="content-card form-card" onSubmit={submit}><h2>Nova requisição</h2><div className="form-grid"><label className="field"><span>Encarregado destinatário</span><select value={form.encarregadoDestinatarioId} onChange={(event) => updateForm('encarregadoDestinatarioId', event.target.value)} required><option value="">Selecione</option>{encarregados.filter((item) => item.ativo).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><label className="field"><span>Contrato</span><select value={form.contratoId} onChange={(event) => updateForm('contratoId', event.target.value)} required><option value="">Selecione</option>{contratos.filter((item) => item.ativo).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label><label className="field"><span>Tipo</span><select value={form.tipo} onChange={(event) => updateForm('tipo', event.target.value)}><option value="RETIRADA">Retirada</option><option value="DEVOLUCAO">Devolução</option></select></label></div><fieldset className="requisicao-items"><legend>Materiais</legend>{form.itens.map((item, index) => <div className="requisicao-item-row" key={index}><label className="field"><span>Material</span><select value={item.materialId} onChange={(event) => updateItem(index, 'materialId', event.target.value)} required><option value="">Selecione</option>{materiais.map((material) => <option key={material.id} value={material.id}>{material.nome}</option>)}</select></label><label className="field"><span>Quantidade</span><input type="number" min="1" max="10000" value={item.quantidade} onChange={(event) => updateItem(index, 'quantidade', event.target.value)} required /></label>{form.itens.length > 1 && <button className="text-button danger requisicao-remove" type="button" onClick={() => removeItem(index)}>Remover</button>}</div>)}</fieldset><button className="text-button" type="button" onClick={addItem}>+ Adicionar material</button><label className="field"><span>Observação (opcional)</span><textarea maxLength="1000" value={form.observacao} onChange={(event) => updateForm('observacao', event.target.value)} /></label><div className="form-actions"><button className="button button-secondary" type="button" onClick={() => setFormOpen(false)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Enviando...' : 'Enviar requisição'}</button></div></form>}
    {loading ? <Loading label="Carregando requisições..." /> : error ? <div><ErrorMessage error={error} /><button className="button button-secondary" onClick={reload}>Tentar novamente</button></div> : requisicoes.length === 0 ? <EmptyState title={isEncarregado ? 'Nenhuma requisição recebida.' : 'Nenhuma requisição enviada.'} description={isGerente ? 'Use “Nova requisição” para enviar a primeira solicitação.' : undefined} /> : <section className="requisicao-list" aria-label="Lista de requisições">{requisicoes.map((requisicao) => <Link className="resource-card requisicao-card" key={requisicao.id} to={`/requisicoes/${requisicao.id}`}><div className="resource-card-heading"><div><small>{formatRequisicaoDate(requisicao.criadaEm)}</small><h2>{requisicaoTipoLabel(requisicao.tipo)}</h2></div><RequisicaoStatusBadge status={requisicao.status} /></div><dl className="requisicao-summary"><div><dt>{isEncarregado ? 'Gerente' : 'Destinatário'}</dt><dd>{isEncarregado ? requisicao.gerenteSolicitante.nome : requisicao.encarregadoDestinatario.nome}</dd></div><div><dt>Contrato</dt><dd>{requisicao.contrato.nome}</dd></div><div><dt>Materiais</dt><dd>{requisicao.itens.length}</dd></div></dl><span className="text-link">Ver detalhes →</span></Link>)}</section>}</div>;
}
