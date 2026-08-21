import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  EmptyState,
  ErrorMessage,
  Loading,
  SuccessMessage,
} from '../components/Feedback';
import { materialService } from '../services/materialService';
import { notaFiscalService } from '../services/notaFiscalService';
import {
  buildNotaFiscalPayload,
  emptyNotaFiscalForm,
  emptyNotaFiscalItem,
  formatCnpj,
  formFromNotaFiscal,
  todayIsoDate,
  validateNotaFiscalForm,
} from '../utils/notaFiscal';

export default function NotaFiscalFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState(emptyNotaFiscalForm);
  const [materials, setMaterials] = useState([]);
  const [notaFiscal, setNotaFiscal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    const loader = editing
      ? Promise.all([materialService.list(), notaFiscalService.get(id)])
      : materialService.list().then((items) => [items, null]);

    loader
      .then(([loadedMaterials, loadedNotaFiscal]) => {
        if (!active) return;
        setMaterials(loadedMaterials);
        setNotaFiscal(loadedNotaFiscal);
        if (loadedNotaFiscal) {
          setForm(formFromNotaFiscal(loadedNotaFiscal));
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [editing, id]);

  const clientError = useMemo(() => validateNotaFiscalForm(form), [form]);
  const blocked = editing && notaFiscal?.status === 'CONFIRMADA';

  function change(field, value) {
    setError(null);
    setSuccess('');
    setForm((current) => ({ ...current, [field]: value }));
  }

  function changeItem(index, field, value) {
    setError(null);
    setSuccess('');
    setForm((current) => ({
      ...current,
      itens: current.itens.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      itens: [...current.itens, emptyNotaFiscalItem()],
    }));
  }

  function removeItem(index) {
    setForm((current) => ({
      ...current,
      itens: current.itens.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSuccess('');

    if (clientError) {
      setError(new Error(clientError));
      return;
    }

    setSaving(true);
    try {
      const payload = buildNotaFiscalPayload(form);
      if (editing) {
        const updated = await notaFiscalService.update(id, payload);
        navigate(`/notas-fiscais/${updated.id}`, {
          replace: true,
          state: { success: 'Nota fiscal atualizada com sucesso.' },
        });
      } else {
        const created = await notaFiscalService.create(payload);
        navigate(`/notas-fiscais/${created.id}`, {
          replace: true,
          state: { success: 'Nota fiscal cadastrada como rascunho.' },
        });
      }
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Carregando nota fiscal..." />;

  if (blocked) {
    return (
      <EmptyState
        title="Nota fiscal confirmada."
        description="Notas fiscais confirmadas ficam disponiveis somente para consulta."
      />
    );
  }

  if (error && !materials.length && !notaFiscal && editing) {
    return <ErrorMessage error={error} />;
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Recebimento</span>
          <h1>{editing ? 'Editar nota fiscal' : 'Nova nota fiscal'}</h1>
          <p>Cadastre os dados da NF de Entrada e seus itens em rascunho.</p>
        </div>
      </header>

      <form className="content-card form-card" onSubmit={handleSubmit}>
        <ErrorMessage error={error} />
        <SuccessMessage>{success}</SuccessMessage>

        <div className="form-grid">
          <label className="field">
            <span>Numero</span>
            <input
              value={form.numero}
              onChange={(event) => change('numero', event.target.value)}
              required
              maxLength="50"
              placeholder="Ex.: 12345"
            />
          </label>

          <label className="field">
            <span>Serie</span>
            <input
              value={form.serie}
              onChange={(event) => change('serie', event.target.value)}
              required
              maxLength="20"
              placeholder="Ex.: 1"
            />
          </label>

          <label className="field field-wide">
            <span>Chave de acesso</span>
            <input
              value={form.chaveAcesso}
              onChange={(event) => change('chaveAcesso', event.target.value)}
              required
              maxLength="80"
              inputMode="numeric"
              placeholder="44 digitos da NF-e"
            />
            <small>Use a chave com 44 digitos, com ou sem formatacao.</small>
          </label>

          <label className="field">
            <span>Fornecedor</span>
            <input
              value={form.fornecedor}
              onChange={(event) => change('fornecedor', event.target.value)}
              required
              maxLength="200"
              placeholder="Nome do fornecedor"
            />
          </label>

          <label className="field">
            <span>CNPJ do fornecedor</span>
            <input
              value={formatCnpj(form.cnpjFornecedor)}
              onChange={(event) => change('cnpjFornecedor', event.target.value)}
              required
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
            />
          </label>

          <label className="field">
            <span>Data de emissao</span>
            <input
              type="date"
              value={form.dataEmissao}
              max={todayIsoDate()}
              onChange={(event) => change('dataEmissao', event.target.value)}
              required
            />
          </label>
        </div>

        <section className="invoice-items-section">
          <div className="section-heading">
            <div>
              <h2>Itens da nota fiscal</h2>
              <p>Selecione materiais existentes e informe os valores da API.</p>
            </div>
            <button
              className="button button-secondary"
              type="button"
              onClick={addItem}
            >
              + Adicionar item
            </button>
          </div>

          {materials.length === 0 ? (
            <div className="alert alert-warning">
              Cadastre materiais antes de incluir itens na nota fiscal.
            </div>
          ) : form.itens.length === 0 ? (
            <EmptyState
              title="Nenhum item adicionado."
              description="O rascunho pode ser salvo sem itens, mas so uma NF com itens pode ser confirmada."
            />
          ) : (
            <div className="invoice-item-list">
              {form.itens.map((item, index) => {
                const selectedMaterial = materials.find(
                  (material) => String(material.id) === item.materialId,
                );

                return (
                  <div className="invoice-item-row" key={`${index}-${item.materialId}`}>
                    <label className="field invoice-material-field">
                      <span>Material</span>
                      <select
                        value={item.materialId}
                        onChange={(event) =>
                          changeItem(index, 'materialId', event.target.value)
                        }
                        required
                      >
                        <option value="">Selecione</option>
                        {materials.map((material) => (
                          <option key={material.id} value={material.id}>
                            #{material.id} - {material.nome}
                          </option>
                        ))}
                      </select>
                      {selectedMaterial && (
                        <small>
                          {selectedMaterial.descricao} | Estoque atual:{' '}
                          <strong>{selectedMaterial.quantidadeEstoque} un.</strong>
                        </small>
                      )}
                    </label>

                    <label className="field">
                      <span>Quantidade</span>
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        step="1"
                        inputMode="numeric"
                        value={item.quantidade}
                        onChange={(event) =>
                          changeItem(index, 'quantidade', event.target.value)
                        }
                        required
                      />
                    </label>

                    <label className="field">
                      <span>Valor unitario</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={item.valorUnitario}
                        onChange={(event) =>
                          changeItem(index, 'valorUnitario', event.target.value)
                        }
                        required
                      />
                    </label>

                    <button
                      className="text-button danger"
                      type="button"
                      onClick={() => removeItem(index)}
                    >
                      Remover
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="form-actions">
          <Link
            className="button button-secondary"
            to={editing ? `/notas-fiscais/${id}` : '/notas-fiscais'}
          >
            Cancelar
          </Link>
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving
              ? 'Salvando...'
              : editing
                ? 'Salvar rascunho'
                : 'Criar rascunho'}
          </button>
        </div>
      </form>
    </div>
  );
}
