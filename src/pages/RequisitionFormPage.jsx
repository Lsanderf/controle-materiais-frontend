import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import EncarregadoForm from '../components/EncarregadoForm';
import { ErrorMessage, Loading } from '../components/Feedback';
import { useResource } from '../hooks/useResource';
import { contratoService } from '../services/contratoService';
import { requisicaoService } from '../services/requisicaoService';
import { usuarioService } from '../services/usuarioService';

export default function RequisitionFormPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ encarregadoId: '', contratoId: '', descricao: '' });
  const [showEncarregado, setShowEncarregado] = useState(false);
  const [showContrato, setShowContrato] = useState(false);
  const [contractForm, setContractForm] = useState({ nome: '', descricao: '', ativo: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const loader = useCallback(() => Promise.all([
    usuarioService.listEncarregados(), contratoService.list(),
  ]), []);
  const { data, setData, loading, error: loadError } = useResource(loader, [loader]);
  const [encarregados = [], contratos = []] = data ?? [];

  async function createContract(event) {
    event.preventDefault();
    setError(null);
    try {
      const created = await contratoService.create({
        nome: contractForm.nome.trim(), descricao: contractForm.descricao.trim(), ativo: true,
      });
      setData(([users, current]) => [users, [...current, created]]);
      setForm((current) => ({ ...current, contratoId: String(created.id) }));
      setShowContrato(false);
      setContractForm({ nome: '', descricao: '', ativo: true });
    } catch (requestError) { setError(requestError); }
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await requisicaoService.create({
        encarregadoId: Number(form.encarregadoId),
        contratoId: Number(form.contratoId),
        descricao: form.descricao.trim(),
      });
      navigate('/requisicoes', { replace: true, state: { success: 'Requisição criada com sucesso.' } });
    } catch (requestError) { setError(requestError); } finally { setSaving(false); }
  }

  if (loading) return <Loading label="Carregando formulário..." />;
  return (
    <div className="page-stack narrow-page">
      <header className="page-heading"><div><span className="eyebrow">Requisições</span><h1>Nova requisição</h1><p>Descreva livremente o que deve ser entregue ao encarregado.</p></div></header>
      <ErrorMessage error={loadError || error} />
      {showEncarregado && <EncarregadoForm onCancel={() => setShowEncarregado(false)} onCreated={(created) => { setData(([users, contracts]) => [[...users, created], contracts]); setForm((current) => ({ ...current, encarregadoId: String(created.id) })); setShowEncarregado(false); }} />}
      {showContrato && <form className="content-card form-card" onSubmit={createContract}><h2>Novo contrato</h2><label className="field"><span>Nome</span><input required maxLength="100" value={contractForm.nome} onChange={(e) => setContractForm({ ...contractForm, nome: e.target.value })} /></label><label className="field"><span>Descrição</span><textarea required maxLength="500" rows="3" value={contractForm.descricao} onChange={(e) => setContractForm({ ...contractForm, descricao: e.target.value })} /></label><div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setShowContrato(false)}>Cancelar</button><button className="button button-primary">Cadastrar contrato</button></div></form>}
      <form className="content-card form-card" onSubmit={submit}>
        <label className="field"><span>Encarregado</span><select required value={form.encarregadoId} onChange={(e) => setForm({ ...form, encarregadoId: e.target.value })}><option value="">Selecionar</option>{encarregados.map((user) => <option value={user.id} key={user.id}>{user.nome}</option>)}</select></label>
        <button type="button" className="text-button" onClick={() => setShowEncarregado(true)}>+ Novo encarregado</button>
        <label className="field"><span>Contrato</span><select required value={form.contratoId} onChange={(e) => setForm({ ...form, contratoId: e.target.value })}><option value="">Selecionar</option>{contratos.filter((contract) => contract.ativo).map((contract) => <option value={contract.id} key={contract.id}>{contract.nome}</option>)}</select></label>
        <button type="button" className="text-button" onClick={() => setShowContrato(true)}>+ Novo contrato</button>
        <label className="field"><span>Solicitação</span><textarea required maxLength="4000" rows="10" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descreva materiais, quantidades e orientações." /><small>{form.descricao.length}/4000 caracteres</small></label>
        <div className="form-actions"><Link className="button button-secondary" to="/requisicoes">Cancelar</Link><button className="button button-primary" disabled={saving}>{saving ? 'Criando...' : 'Criar requisição'}</button></div>
      </form>
    </div>
  );
}
