import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorMessage, Loading, SuccessMessage } from '../components/Feedback';
import { useResource } from '../hooks/useResource';
import { contratoService } from '../services/contratoService';
import { materialService } from '../services/materialService';
import { requisicaoService } from '../services/requisicaoService';
import { solicitacaoRetiradaService } from '../services/solicitacaoRetiradaService';
import { usuarioService } from '../services/usuarioService';

const emptyItem = () => ({ materialId: '', quantidade: '' });
const emptyForm = () => ({ encarregadoAssinanteId: '', contratoId: '', observacao: '', itens: [emptyItem()] });

export default function WithdrawalRequestFormPage() {
  const loader = useCallback(() => Promise.all([
    materialService.list(), usuarioService.listEncarregados(), contratoService.list(), usuarioService.listGerentes(),
  ]), []);
  const { data, loading, error: loadError, reload } = useResource(loader, [loader]);
  const [materiais = [], encarregados = [], contratos = [], gerentes = []] = data ?? [];
  const [form, setForm] = useState(emptyForm);
  const [gerenteDestinatarioId, setGerenteDestinatarioId] = useState('');
  const [saving, setSaving] = useState(false);
  const [creatingPurchase, setCreatingPurchase] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [faltantes, setFaltantes] = useState([]);

  const activeEncarregados = encarregados.filter((item) => item.ativo);
  const activeContratos = contratos.filter((item) => item.ativo);
  const activeGerentes = gerentes.filter((item) => item.ativo);
  const clientError = useMemo(() => {
    if (!form.encarregadoAssinanteId) return 'Selecione o encarregado que assinará o recebimento.';
    if (!form.contratoId) return 'Selecione o contrato relacionado.';
    if (!form.itens.length || form.itens.some((item) => !item.materialId || !Number.isInteger(Number(item.quantidade)) || Number(item.quantidade) <= 0)) {
      return 'Informe material e quantidade válida em todos os itens.';
    }
    if (new Set(form.itens.map((item) => item.materialId)).size !== form.itens.length) return 'Não repita o mesmo material na solicitação.';
    return '';
  }, [form]);

  const payload = () => ({
    encarregadoAssinanteId: Number(form.encarregadoAssinanteId),
    contratoId: Number(form.contratoId),
    ...(form.observacao.trim() && { observacao: form.observacao.trim() }),
    itens: form.itens.map((item) => ({ materialId: Number(item.materialId), quantidade: Number(item.quantidade) })),
  });

  function change(field, value) {
    setSuccess(''); setError(null); setFaltantes([]); setGerenteDestinatarioId('');
    setForm((current) => ({ ...current, [field]: value }));
  }
  function changeItem(index, field, value) {
    setSuccess(''); setError(null); setFaltantes([]); setGerenteDestinatarioId('');
    setForm((current) => ({ ...current, itens: current.itens.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  }
  function addItem() { setForm((current) => ({ ...current, itens: [...current.itens, emptyItem()] })); }
  function removeItem(index) { setForm((current) => ({ ...current, itens: current.itens.filter((_, itemIndex) => itemIndex !== index) })); }

  async function submit(event) {
    event.preventDefault();
    if (clientError || saving) { if (clientError) setError(new Error(clientError)); return; }
    setSaving(true); setError(null); setFaltantes([]);
    try {
      await solicitacaoRetiradaService.create(payload(), crypto.randomUUID());
      setSuccess('Solicitação enviada ao encarregado para assinatura. O estoque será baixado somente na confirmação.');
      setForm(emptyForm());
      reload().catch(() => {});
    } catch (requestError) {
      setError(requestError);
      setFaltantes(requestError?.details?.itens ?? []);
    } finally { setSaving(false); }
  }

  async function createPurchaseRequest() {
    if (!gerenteDestinatarioId || creatingPurchase) return;
    setCreatingPurchase(true); setError(null);
    try {
      await requisicaoService.createFaltaEstoque({
        gerenteDestinatarioId: Number(gerenteDestinatarioId),
        encarregadoNecessidadeId: Number(form.encarregadoAssinanteId),
        contratoId: Number(form.contratoId),
        itens: form.itens.map((item) => ({ materialId: Number(item.materialId), quantidadeSolicitada: Number(item.quantidade) })),
      });
      setSuccess('Requisição de compra criada para o gerente responsável.');
      setFaltantes([]); setGerenteDestinatarioId('');
    } catch (requestError) { setError(requestError); } finally { setCreatingPurchase(false); }
  }

  if (loading && !data) return <Loading label="Carregando dados da retirada..." />;
  if (loadError && !data) return <div><ErrorMessage error={loadError} /><button className="button button-secondary" onClick={reload}>Tentar novamente</button></div>;
  if (materiais.length === 0) {
    return (
      <EmptyState
        title="Nenhum material disponível."
        description="Cadastre um material antes de preparar uma retirada."
      />
    );
  }
  return (
    <div className="page-stack narrow-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Movimentações</span>
          <h1>Preparar retirada</h1>
          <p>Registre a entrega de materiais. O estoque será baixado somente após a assinatura do encarregado.</p>
        </div>
      </header>

      <SuccessMessage>{success}</SuccessMessage>
      <ErrorMessage error={error} />

      {faltantes.length > 0 && (
        <section className="alert alert-warning">
          <strong>Estoque insuficiente.</strong>
          {faltantes.map((item) => (
            <p key={item.materialId}>
              {item.material}: disponível {item.disponivel}, solicitado {item.solicitado}, faltante {item.faltante}.
            </p>
          ))}
          <label className="field">
            <span>Gerente responsável pela compra</span>
            <select value={gerenteDestinatarioId} onChange={(event) => setGerenteDestinatarioId(event.target.value)} required>
              <option value="">Selecione</option>
              {activeGerentes.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <button type="button" className="button button-primary" disabled={!gerenteDestinatarioId || creatingPurchase} onClick={createPurchaseRequest}>
            {creatingPurchase ? 'Criando requisição...' : 'Criar requisição de compra para o faltante'}
          </button>
        </section>
      )}

      {activeEncarregados.length === 0 || activeContratos.length === 0 ? (
        <div className="alert alert-warning">
          Não há {activeEncarregados.length === 0 ? 'encarregados' : 'contratos'} ativos disponíveis. Ative ou cadastre o recurso antes de continuar.
        </div>
      ) : (
        <form className="content-card form-card" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span>Encarregado assinante</span>
              <select value={form.encarregadoAssinanteId} onChange={(event) => change('encarregadoAssinanteId', event.target.value)} required>
                <option value="">Selecione</option>
                {activeEncarregados.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Contrato</span>
              <select value={form.contratoId} onChange={(event) => change('contratoId', event.target.value)} required>
                <option value="">Selecione</option>
                {activeContratos.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}
              </select>
            </label>
          </div>

          <fieldset className="requisicao-items">
            <legend>Materiais da retirada</legend>
            {form.itens.map((item, index) => {
              const selectedMaterial = materiais.find((material) => String(material.id) === item.materialId);
              return (
                <div className="requisicao-item-row" key={index}>
                  <label className="field">
                    <span>Material</span>
                    <select value={item.materialId} onChange={(event) => changeItem(index, 'materialId', event.target.value)} required>
                      <option value="">Selecione</option>
                      {materiais.map((material) => <option key={material.id} value={material.id}>{material.nome}</option>)}
                    </select>
                    {selectedMaterial && <small>Estoque atual: <strong>{selectedMaterial.quantidadeEstoque} un.</strong></small>}
                  </label>
                  <label className="field">
                    <span>Quantidade</span>
                    <input type="number" min="1" max="10000" step="1" inputMode="numeric" placeholder="0" value={item.quantidade} onChange={(event) => changeItem(index, 'quantidade', event.target.value)} required />
                    <small>Máximo de 10.000 unidades.</small>
                  </label>
                  {form.itens.length > 1 && <button type="button" className="text-button danger requisicao-remove" onClick={() => removeItem(index)}>Remover item</button>}
                </div>
              );
            })}
          </fieldset>
          <button type="button" className="text-button" onClick={addItem}>+ Adicionar material</button>

          <label className="field">
            <span>Observação (opcional)</span>
            <textarea
              maxLength="1000"
              value={form.observacao}
              onChange={(event) => change('observacao', event.target.value)}
              placeholder="Registre uma informação relevante para o comprovante."
            />
            <small>{form.observacao.length}/1.000 caracteres.</small>
          </label>
          <div className="form-actions">
            <Link className="button button-secondary" to="/movimentacoes">Cancelar</Link>
            <button className="button button-primary" type="submit" disabled={saving || Boolean(clientError)}>
              {saving ? 'Enviando...' : 'Enviar para assinatura'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
