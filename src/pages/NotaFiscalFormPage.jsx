import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import NotaFiscalBarcodeScanner from '../components/NotaFiscalBarcodeScanner';
import NotaFiscalMaterialDialog from '../components/NotaFiscalMaterialDialog';
import {
  EmptyState,
  ErrorMessage,
  Loading,
  SuccessMessage,
} from '../components/Feedback';
import { useAuth } from '../context/useAuth';
import { materialService } from '../services/materialService';
import { notaFiscalService } from '../services/notaFiscalService';
import {
  buildNotaFiscalPayload,
  canManageNotaFiscal,
  emptyNotaFiscalForm,
  emptyNotaFiscalItem,
  formatCnpj,
  formFromNotaFiscal,
  todayIsoDate,
  validateNfeAccessKeyCheckDigit,
  validateNotaFiscalForm,
} from '../utils/notaFiscal';
import {
  associateImportedMaterial,
  formFromImportedNfe,
  hasUnmappedImportedItems,
  nfeXmlComparisonKey,
} from '../utils/nfeXmlImport';

// Local identity survives edits/removals and is excluded by buildNotaFiscalPayload.
let nextItemId = 0;

function identifyItems(form) {
  return {
    ...form,
    itens: form.itens.map((item) => ({
      ...item,
      localId: item.localId ?? `nf-item-${++nextItemId}`,
    })),
  };
}

export default function NotaFiscalFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const editing = Boolean(id);
  const [form, setForm] = useState(() => identifyItems(emptyNotaFiscalForm()));
  const [materials, setMaterials] = useState([]);
  const [notaFiscal, setNotaFiscal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importingXml, setImportingXml] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [materialCreationItem, setMaterialCreationItem] = useState(null);
  const xmlInputRef = useRef(null);
  const canCreateMaterial = role === 'ADMIN';

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
          setForm(identifyItems(formFromNotaFiscal(loadedNotaFiscal)));
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
  const accessKeyCheckDigitError = useMemo(
    () => validateNfeAccessKeyCheckDigit(form.chaveAcesso),
    [form.chaveAcesso],
  );
  const unmappedImportedItems = useMemo(
    () => hasUnmappedImportedItems(form),
    [form],
  );
  const blocked = editing && notaFiscal?.status === 'CONFIRMADA';

  function change(field, value) {
    setError(null);
    setSuccess('');
    setForm((current) => ({ ...current, [field]: value }));
  }

  function fillScannedAccessKey(accessKey) {
    change('chaveAcesso', accessKey);
    setScannerOpen(false);
    setSuccess('Chave de acesso preenchida pelo código de barras.');
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

  function associateMaterial(index, materialId) {
    setError(null);
    setSuccess('');
    setForm((current) =>
      associateImportedMaterial(current, index, materialId));
  }

  function addItem() {
    setForm((current) => identifyItems({
      ...current,
      itens: [...current.itens, emptyNotaFiscalItem()],
    }));
  }

  function openMaterialCreation(item) {
    if (!canCreateMaterial || importingXml || saving || materialCreationItem) return;
    setMaterialCreationItem(item);
  }

  function handleMaterialCreated(material) {
    const originId = materialCreationItem.localId;
    setMaterials((current) => [
      ...current.filter((existing) => String(existing.id) !== String(material.id)),
      material,
    ]);
    setForm((current) => {
      const index = current.itens.findIndex((item) => item.localId === originId);
      return associateImportedMaterial(current, index, material.id);
    });
    setMaterialCreationItem(null);
    setError(null);
    setSuccess('Material criado e associado ao item.');
  }

  function removeItem(index) {
    setForm((current) => ({
      ...current,
      itens: current.itens.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function handleXmlSelection(event) {
    const arquivo = event.target.files?.[0];
    event.target.value = '';
    if (!arquivo) return;

    const chaveAcessoInformada = nfeXmlComparisonKey(form.chaveAcesso);
    setError(null);
    setSuccess('');
    setImportingXml(true);

    try {
      const importedNfe = await notaFiscalService.importXml(arquivo, {
        chaveAcessoInformada,
        notaFiscalId: editing ? id : undefined,
      });
      const importedForm = identifyItems(formFromImportedNfe(
        form,
        importedNfe,
        chaveAcessoInformada,
      ));
      setForm(importedForm);
      setSuccess(
        'XML lido com sucesso. Revise os dados e associe cada produto a um material.',
      );
    } catch (requestError) {
      setError(requestError);
    } finally {
      setImportingXml(false);
    }
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

        <section className="nfe-xml-import-panel" aria-labelledby="xml-import-title">
          <div>
            <h2 id="xml-import-title">Preencher pelo XML</h2>
            <p>
              O arquivo é apenas lido para preencher este rascunho. Revise os
              dados antes de salvar.
            </p>
          </div>
          <input
            ref={xmlInputRef}
            className="visually-hidden-file-input"
            type="file"
            accept=".xml,application/xml,text/xml"
            onChange={handleXmlSelection}
            tabIndex="-1"
          />
          <button
            className="button button-secondary"
            type="button"
            disabled={importingXml || saving}
            onClick={() => xmlInputRef.current?.click()}
          >
            {importingXml ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Lendo Nota Fiscal...
              </>
            ) : (
              'Importar XML da NF-e'
            )}
          </button>
        </section>

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

          <div className="field field-wide">
            <div className="field-label-row">
              <label htmlFor="nota-fiscal-chave-acesso">Chave de acesso</label>
              {canManageNotaFiscal(role) && (
                <button
                  className="text-button barcode-scan-trigger"
                  type="button"
                  onClick={() => setScannerOpen(true)}
                >
                  Escanear código de barras
                </button>
              )}
            </div>
            <input
              id="nota-fiscal-chave-acesso"
              value={form.chaveAcesso}
              onChange={(event) => change('chaveAcesso', event.target.value)}
              required
              maxLength="80"
              inputMode="numeric"
              aria-invalid={Boolean(accessKeyCheckDigitError)}
              aria-describedby={
                accessKeyCheckDigitError
                  ? 'nota-fiscal-chave-ajuda nota-fiscal-chave-erro'
                  : 'nota-fiscal-chave-ajuda'
              }
              placeholder="44 digitos da NF-e"
            />
            <small id="nota-fiscal-chave-ajuda">
              Use a chave com 44 digitos, com ou sem formatacao.
            </small>
            {accessKeyCheckDigitError && (
              <small
                id="nota-fiscal-chave-erro"
                className="field-error"
                role="alert"
              >
                {accessKeyCheckDigitError}
              </small>
            )}
          </div>

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
              <p>Associe cada item a um material e informe a quantidade e o valor unitário.</p>
            </div>
            <button
              className="button button-secondary"
              type="button"
              onClick={addItem}
            >
              + Adicionar item
            </button>
          </div>

          {unmappedImportedItems && (
            <div className="alert alert-warning" role="status">
              Associe todos os produtos importados a materiais internos para
              salvar a nota fiscal.
            </div>
          )}

          {materials.length === 0 && (
            <div className="alert alert-warning">
              {canCreateMaterial
                ? 'Nenhum material cadastrado. Use “+ Criar material” no item para começar.'
                : 'Nenhum material cadastrado. Solicite o cadastro a um administrador.'}
            </div>
          )}

          {form.itens.length === 0 ? (
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
                  <div
                    className={`invoice-item-row${
                      item.origemXml && !item.materialId
                        ? ' invoice-item-row-unmapped'
                        : ''
                    }`}
                    key={item.localId}
                  >
                    {item.origemXml && (
                      <div className="invoice-imported-product">
                        <div className="invoice-imported-product-heading">
                          <span className="eyebrow">
                            Item {item.origemXml.numeroItem} do XML
                          </span>
                          <span
                            className={`badge ${
                              item.materialId
                                ? 'badge-active'
                                : 'badge-pending'
                            }`}
                          >
                            {item.materialId
                              ? 'Material associado'
                              : 'Aguardando associação'}
                          </span>
                        </div>
                        <strong>{item.origemXml.descricaoProduto}</strong>
                        <dl className="invoice-imported-product-details">
                          <div>
                            <dt>Código do fornecedor</dt>
                            <dd>{item.origemXml.codigoProduto || '-'}</dd>
                          </div>
                          <div>
                            <dt>Quantidade no XML</dt>
                            <dd>
                              {item.origemXml.quantidadeComercial}{' '}
                              {item.origemXml.unidadeComercial}
                            </dd>
                          </div>
                          <div>
                            <dt>Valor unitário</dt>
                            <dd>
                              {item.origemXml.valorUnitarioComercial || '-'}
                            </dd>
                          </div>
                          <div>
                            <dt>Valor total</dt>
                            <dd>{item.origemXml.valorTotal || '-'}</dd>
                          </div>
                          <div>
                            <dt>EAN/GTIN</dt>
                            <dd>{item.origemXml.eanGtin || 'Não informado'}</dd>
                          </div>
                        </dl>
                      </div>
                    )}
                    <div className="field invoice-material-field">
                      <label htmlFor={`material-${item.localId}`}>
                        {item.origemXml
                          ? 'Material correspondente'
                          : 'Material'}
                      </label>
                      <select
                        id={`material-${item.localId}`}
                        value={item.materialId}
                        onChange={(event) =>
                          associateMaterial(index, event.target.value)
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
                      {canCreateMaterial && (
                        <button
                          className="button button-secondary invoice-create-material"
                          type="button"
                          disabled={importingXml || saving}
                          onClick={() => openMaterialCreation(item)}
                        >
                          + Criar material
                        </button>
                      )}
                      {selectedMaterial && (
                        <small>
                          {selectedMaterial.descricao} | Estoque atual:{' '}
                          <strong>{selectedMaterial.quantidadeEstoque} un.</strong>
                        </small>
                      )}
                      {item.origemXml && !selectedMaterial && (
                        <small className="field-error">
                          Selecione o material interno deste produto.
                        </small>
                      )}
                    </div>

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
          <button
            className="button button-primary"
            type="submit"
            disabled={
              saving ||
              importingXml ||
              unmappedImportedItems ||
              Boolean(accessKeyCheckDigitError)
            }
          >
            {saving
              ? 'Salvando...'
              : editing
                ? 'Salvar rascunho'
                : 'Criar rascunho'}
          </button>
        </div>
      </form>

      {materialCreationItem && canCreateMaterial && (
        <NotaFiscalMaterialDialog
          key={materialCreationItem.localId}
          item={materialCreationItem}
          onCreated={handleMaterialCreated}
          onCancel={() => setMaterialCreationItem(null)}
        />
      )}

      {scannerOpen && (
        <NotaFiscalBarcodeScanner
          onDetected={fillScannedAccessKey}
          onCancel={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
