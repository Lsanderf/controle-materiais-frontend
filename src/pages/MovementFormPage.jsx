import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SignaturePad from '../components/SignaturePad';
import ReturnPhotoPicker from '../components/ReturnPhotoPicker';
import MovementReceiptModal from '../components/MovementReceiptModal';
import { useAuth } from '../context/useAuth';
import {
  EmptyState,
  ErrorMessage,
  Loading,
  SuccessMessage,
} from '../components/Feedback';
import { useResource } from '../hooks/useResource';
import { contratoService } from '../services/contratoService';
import { usuarioService } from '../services/usuarioService';
import { materialService } from '../services/materialService';
import { movimentacaoService } from '../services/movimentacaoService';
import { movementLabel } from '../utils/formatters';
import {
  calculateReturnBalance,
  selectableMovementLinks,
} from '../utils/movementForm';

const descriptions = {
  RETIRADA: 'Registre a entrega de materiais para uso em um contrato.',
  DEVOLUCAO: 'Registre materiais que retornaram ao estoque.',
};

export default function MovementFormPage({ type }) {
  const { role } = useAuth();
  const canRegister = ['ADMIN', 'OPERADOR'].includes(role) && ['RETIRADA', 'DEVOLUCAO'].includes(type);
  const [searchParams] = useSearchParams();
  const initialMaterial = searchParams.get('material') ?? '';
  const [form, setForm] = useState({
    materialId: initialMaterial,
    funcionarioId: '',
    contratoId: '',
    quantidade: '',
    observacao: '',
  });
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [createdMovement, setCreatedMovement] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const submittingRef = useRef(false);
  const [employeeMovements, setEmployeeMovements] = useState([]);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState(null);
  const [balanceReload, setBalanceReload] = useState(0);

  const loader = useCallback(
    () =>
      Promise.all([
        materialService.list(),
        // Migração pendente: a origem já é de encarregados, mas o contrato de
        // movimentações ainda exige funcionarioId e byFuncionario. Esses nomes
        // devem mudar juntos com o serviço e os consumidores dos responses.
        usuarioService.listEncarregados(),
        contratoService.list(),
      ]),
    [],
  );
  const {
    data,
    setData,
    loading,
    error: loadError,
    reload,
  } = useResource(loader, [loader]);

  const [materials = [], allEmployees = [], allContracts = []] = data ?? [];
  const employees = selectableMovementLinks(allEmployees, type);
  const contracts = selectableMovementLinks(allContracts, type);
  const selectedMaterial = materials.find(
    (material) => String(material.id) === form.materialId,
  );
  const selectedEmployee = employees.find(
    (employee) => String(employee.id) === form.funcionarioId,
  );
  const selectedContract = contracts.find(
    (contract) => String(contract.id) === form.contratoId,
  );
  const quantity = Number(form.quantidade);

  useEffect(() => {
    if (type !== 'DEVOLUCAO' || !form.funcionarioId) {
      setEmployeeMovements([]);
      setBalanceLoading(false);
      setBalanceError(null);
      return;
    }

    let active = true;
    setBalanceLoading(true);
    setBalanceError(null);
    movimentacaoService
      .byFuncionario(form.funcionarioId)
      .then((movements) => {
        if (active) setEmployeeMovements(movements);
      })
      .catch((requestError) => {
        if (active) {
          setEmployeeMovements([]);
          setBalanceError(requestError);
        }
      })
      .finally(() => {
        if (active) setBalanceLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form.funcionarioId, type, balanceReload]);

  const returnBalance = useMemo(() => {
    if (type !== 'DEVOLUCAO' || !selectedMaterial || !selectedContract || balanceLoading || balanceError) return null;
    return calculateReturnBalance(
      employeeMovements,
      selectedMaterial.nome,
      selectedContract.nome,
    );
  }, [employeeMovements, selectedContract, selectedMaterial, type, balanceLoading, balanceError]);

  const clientError = useMemo(() => {
    if (!form.funcionarioId)
      return type === 'RETIRADA'
        ? 'Selecione um encarregado ativo.'
        : 'Selecione um encarregado existente.';
    if (!form.contratoId)
      return type === 'RETIRADA'
        ? 'Selecione um contrato ativo.'
        : 'Selecione um contrato existente.';
    if (!form.materialId) return 'Selecione um material.';
    if (!Number.isInteger(quantity) || quantity <= 0)
      return 'A quantidade deve ser um numero inteiro maior que zero.';
    if (quantity > 10000)
      return 'A quantidade maxima por operacao e 10.000.';
    if (form.observacao.length > 1000)
      return 'A observacao deve possuir no maximo 1.000 caracteres.';
    if (
      type === 'RETIRADA' &&
      selectedMaterial &&
      quantity > selectedMaterial.quantidadeEstoque
    )
      return 'A quantidade informada ultrapassa o estoque disponivel.';
    if (
      type === 'DEVOLUCAO' &&
      returnBalance !== null &&
      quantity > returnBalance
    )
      return 'A devolucao ultrapassa a quantidade ainda retirada.';
    return '';
  }, [
    form.contratoId,
    form.funcionarioId,
    form.materialId,
    form.observacao,
    quantity,
    returnBalance,
    selectedMaterial,
    type,
  ]);

  function change(field, value) {
    setError(null);
    setSuccess('');
    setForm((current) => ({ ...current, [field]: value }));
  }

  function prepareConfirmation(event) {
    event.preventDefault();
    if (!canRegister || submittingRef.current || balanceLoading || balanceError) return;
    setError(null);
    if (clientError) {
      setError(new Error(clientError));
      return;
    }
    setConfirming(true);
  }

  async function confirmMovement(signature) {
    if (!canRegister || submittingRef.current || balanceLoading || balanceError) return;
    if (clientError) {
      setError(new Error(clientError));
      return;
    }
    submittingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const movement = await movimentacaoService.create({
        funcionarioId: Number(form.funcionarioId),
        contratoId: Number(form.contratoId),
        materialId: Number(form.materialId),
        quantidade: quantity,
        tipo: type,
        ...(form.observacao.trim() && {
          observacao: form.observacao.trim(),
        }),
      }, signature, type === 'DEVOLUCAO' ? photo : null);
      setConfirming(false);
      setSuccess(`${movementLabel(type)} registrada com sucesso.`);
      setCreatedMovement(movement);
      setReceiptOpen(true);
      setPhoto(null);
      setData(([currentMaterials, currentEmployees, currentContracts]) => [
        currentMaterials.map((material) => String(material.id) === form.materialId
          ? { ...material, quantidadeEstoque: material.quantidadeEstoque + (type === 'RETIRADA' ? -quantity : quantity) }
          : material),
        currentEmployees,
        currentContracts,
      ]);
      setForm({
        materialId: '',
        funcionarioId: '',
        contratoId: '',
        quantidade: '',
        observacao: '',
      });
      reload().catch(() => setError(new Error(
        'Movimentação registrada. Não foi possível atualizar a lista; consulte o estoque antes da próxima operação.',
      )));
    } catch (requestError) {
      setError(requestError);
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  const projectedStock = selectedMaterial
    ? selectedMaterial.quantidadeEstoque +
      (type === 'RETIRADA' ? -quantity : quantity)
    : null;

  if (!canRegister) return <EmptyState title="Registro de movimentação indisponível para este perfil ou tipo." />;

  if (loading && !data) return <Loading label="Carregando dados da movimentacao..." />;

  if (loadError && !data) {
    return (
      <div>
        <ErrorMessage error={loadError} />
        <button className="button button-secondary" onClick={reload}>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <EmptyState
        title="Nenhum material disponivel."
        description="Cadastre um material antes de registrar movimentacoes."
      />
    );
  }

  return (
    <div className="page-stack narrow-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Movimentacoes</span>
          <h1>Registrar {movementLabel(type).toLocaleLowerCase('pt-BR')}</h1>
          <p>{descriptions[type]}</p>
        </div>
      </header>

      <SuccessMessage>{success}</SuccessMessage>
      <ErrorMessage error={confirming ? null : error} />

      {createdMovement && (
        <button className="button button-secondary" type="button" onClick={() => setReceiptOpen(true)}>
          Ver comprovante #{createdMovement.id}
        </button>
      )}

      {employees.length === 0 || contracts.length === 0 ? (
        <div className="alert alert-warning">
          Nao ha {employees.length === 0 ? 'encarregados' : 'contratos'}{' '}
          {type === 'RETIRADA' ? 'ativos disponiveis' : 'cadastrados'}.
          {' '}{type === 'RETIRADA' ? 'Ative ou cadastre' : 'Cadastre'} o recurso antes de continuar.
        </div>
      ) : (
        <form className="content-card form-card" onSubmit={prepareConfirmation}>
          <div className="form-grid">
            <label className="field">
              <span>Encarregado</span>
              <select
                value={form.funcionarioId}
                onChange={(event) => change('funcionarioId', event.target.value)}
                required
              >
                <option value="">Selecione</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.nome}
                    {!employee.ativo ? ' (inativo)' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Contrato</span>
              <select
                value={form.contratoId}
                onChange={(event) => change('contratoId', event.target.value)}
                required
              >
                <option value="">Selecione</option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.nome}{!contract.ativo ? ' (inativo)' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Material</span>
              <select
                value={form.materialId}
                onChange={(event) => change('materialId', event.target.value)}
                required
              >
                <option value="">Selecione</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.nome}
                  </option>
                ))}
              </select>
              {selectedMaterial && (
                <small>
                  Estoque atual: <strong>{selectedMaterial.quantidadeEstoque} un.</strong>
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
                value={form.quantidade}
                onChange={(event) => change('quantidade', event.target.value)}
                required
                placeholder="0"
              />
              <small>Maximo de 10.000 unidades por operacao.</small>
            </label>

            <label className="field field-wide">
              <span>Observacao (opcional)</span>
              <textarea
                maxLength="1000"
                value={form.observacao}
                onChange={(event) => change('observacao', event.target.value)}
                placeholder="Registre uma informacao relevante para o comprovante."
              />
              <small>{form.observacao.length}/1.000 caracteres.</small>
            </label>
          </div>

          {type === 'DEVOLUCAO' &&
            selectedEmployee &&
            selectedContract &&
            selectedMaterial && (
              <div className="balance-info">
                <span>Quantidade ainda retirada neste vinculo</span>
                <strong>
                  {balanceLoading ? 'Calculando...' : balanceError ? 'Saldo indisponível' : `${Math.max(returnBalance, 0)} un.`}
                </strong>
              </div>
            )}

          {balanceError && (
            <div>
              <ErrorMessage error={balanceError} />
              <button className="button button-secondary" type="button"
                disabled={balanceLoading} onClick={() => setBalanceReload((version) => version + 1)}>
                Tentar carregar saldo novamente
              </button>
            </div>
          )}

          <div className="form-actions">
            <Link className="button button-secondary" to="/movimentacoes">
              Cancelar
            </Link>
            <button
              className="button button-primary"
              type="submit"
              disabled={Boolean(clientError) || balanceLoading || Boolean(balanceError)}
            >
              Continuar
            </button>
          </div>
        </form>
      )}

      {confirming && (
      <SignaturePad
        employeeName={selectedEmployee?.nome}
        saving={saving}
        error={error}
        confirmLabel={`Confirmar ${movementLabel(type).toLocaleLowerCase('pt-BR')}`}
        savingLabel="Registrando movimentação..."
        onCancel={() => { if (!saving) { setConfirming(false); setError(null); } }}
        onConfirm={confirmMovement}
        summary={
        <dl className="summary-list">
          <div><dt>Tipo</dt><dd>{movementLabel(type)}</dd></div>
          <div>
            <dt>Material</dt>
            <dd>{selectedMaterial?.nome}</dd>
          </div>
          <div>
            <dt>Encarregado</dt>
            <dd>{selectedEmployee?.nome}</dd>
          </div>
          <div>
            <dt>Contrato</dt>
            <dd>{selectedContract?.nome}</dd>
          </div>
          <div>
            <dt>Estoque atual</dt>
            <dd>{selectedMaterial?.quantidadeEstoque} un.</dd>
          </div>
          <div>
            <dt>Quantidade</dt>
            <dd>{quantity} un.</dd>
          </div>
          {form.observacao.trim() && (
            <div>
              <dt>Observacao</dt>
              <dd>{form.observacao.trim()}</dd>
            </div>
          )}
          <div className="summary-total">
            <dt>Estoque apos a operacao</dt>
            <dd>{projectedStock} un.</dd>
          </div>
        </dl>
        }
      >
        {type === 'DEVOLUCAO' && <ReturnPhotoPicker file={photo} onChange={setPhoto} disabled={saving} />}
      </SignaturePad>
      )}

      {receiptOpen && createdMovement && (
        <MovementReceiptModal movementId={createdMovement.id} onClose={() => setReceiptOpen(false)} />
      )}
    </div>
  );
}
