import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import SignaturePad from '../components/SignaturePad';
import {
  EmptyState,
  ErrorMessage,
  Loading,
  SuccessMessage,
} from '../components/Feedback';
import { useResource } from '../hooks/useResource';
import { contratoService } from '../services/contratoService';
import { funcionarioService } from '../services/funcionarioService';
import { materialService } from '../services/materialService';
import { movimentacaoService } from '../services/movimentacaoService';
import { movementLabel } from '../utils/formatters';
import { isSignatureConflict } from '../utils/signature';

const descriptions = {
  RETIRADA: 'Registre a entrega de materiais para uso em um contrato.',
  DEVOLUCAO: 'Registre materiais que retornaram ao estoque.',
};

export default function MovementFormPage({ type }) {
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
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [signatureSaving, setSignatureSaving] = useState(false);
  const [signatureError, setSignatureError] = useState(null);
  const [signatureRegistered, setSignatureRegistered] = useState(false);
  const [employeeMovements, setEmployeeMovements] = useState([]);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const loader = useCallback(
    () =>
      Promise.all([
        materialService.list(),
        funcionarioService.list(),
        contratoService.list(),
      ]),
    [],
  );
  const {
    data,
    loading,
    error: loadError,
    reload,
  } = useResource(loader, [loader]);

  const [materials = [], allEmployees = [], allContracts = []] = data ?? [];
  const employees = allEmployees.filter((employee) => employee.ativo);
  const contracts = allContracts.filter((contract) => contract.ativo);
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
      return;
    }

    let active = true;
    setBalanceLoading(true);
    movimentacaoService
      .byFuncionario(form.funcionarioId)
      .then((movements) => {
        if (active) setEmployeeMovements(movements);
      })
      .catch(() => {
        if (active) setEmployeeMovements([]);
      })
      .finally(() => {
        if (active) setBalanceLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form.funcionarioId, type]);

  const returnBalance = useMemo(() => {
    if (type !== 'DEVOLUCAO' || !selectedMaterial || !selectedContract) return null;
    return employeeMovements
      .filter(
        (movement) =>
          movement.material === selectedMaterial.nome &&
          movement.contrato === selectedContract.nome,
      )
      .reduce((balance, movement) => {
        if (movement.tipo === 'RETIRADA') return balance + movement.quantidade;
        if (movement.tipo === 'DEVOLUCAO') return balance - movement.quantidade;
        return balance;
      }, 0);
  }, [employeeMovements, selectedContract, selectedMaterial, type]);

  const clientError = useMemo(() => {
    if (!form.funcionarioId) return 'Selecione um funcionario ativo.';
    if (!form.contratoId) return 'Selecione um contrato ativo.';
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
    setError(null);
    if (clientError) {
      setError(new Error(clientError));
      return;
    }
    setConfirming(true);
  }

  async function confirmMovement() {
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
      });
      setConfirming(false);
      setSuccess(`${movementLabel(type)} registrada com sucesso.`);
      setCreatedMovement({
        ...movement,
        funcionarioNome: movement.funcionario ?? selectedEmployee?.nome,
      });
      setSignatureRegistered(false);
      setSignatureError(null);
      setForm({
        materialId: '',
        funcionarioId: '',
        contratoId: '',
        quantidade: '',
        observacao: '',
      });
      await reload();
    } catch (requestError) {
      setConfirming(false);
      setError(requestError);
    } finally {
      setSaving(false);
    }
  }

  async function saveSignature(blob) {
    if (!createdMovement) return;

    setSignatureSaving(true);
    setSignatureError(null);
    try {
      await movimentacaoService.uploadSignature(createdMovement.id, blob);
      setSignatureRegistered(true);
      setSignatureOpen(false);
      setSuccess('Assinatura registrada com sucesso.');
    } catch (requestError) {
      if (isSignatureConflict(requestError)) {
        setSignatureRegistered(true);
        setSignatureOpen(false);
        setSuccess('A assinatura desta movimentação já estava registrada.');
      } else {
        setSignatureError(requestError);
      }
    } finally {
      setSignatureSaving(false);
    }
  }

  const projectedStock = selectedMaterial
    ? selectedMaterial.quantidadeEstoque +
      (type === 'RETIRADA' ? -quantity : quantity)
    : null;

  if (loading) return <Loading label="Carregando dados da movimentacao..." />;

  if (loadError) {
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
      <ErrorMessage error={error} />

      {createdMovement &&
        ['RETIRADA', 'DEVOLUCAO'].includes(createdMovement.tipo ?? type) &&
        !signatureRegistered && (
          <section className="content-card signature-offer">
            <div>
              <span className="eyebrow">Movimentação concluída</span>
              <h2>Coletar assinatura do funcionário</h2>
              <p>
                A assinatura é opcional e pode ser adicionada agora como evidência do
                comprovante #{createdMovement.id}.
              </p>
            </div>
            <button
              className="button button-primary"
              type="button"
              onClick={() => {
                setSignatureError(null);
                setSignatureOpen(true);
              }}
            >
              Coletar assinatura
            </button>
          </section>
        )}

      {employees.length === 0 || contracts.length === 0 ? (
        <div className="alert alert-warning">
          Nao ha {employees.length === 0 ? 'funcionarios' : 'contratos'} ativos
          disponiveis. Ative ou cadastre o recurso antes de continuar.
        </div>
      ) : (
        <form className="content-card form-card" onSubmit={prepareConfirmation}>
          <div className="form-grid">
            <label className="field">
              <span>Funcionario</span>
              <select
                value={form.funcionarioId}
                onChange={(event) => change('funcionarioId', event.target.value)}
                required
              >
                <option value="">Selecione</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.nome} - {employee.cargo}
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
                    {contract.nome}
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
                  {balanceLoading ? 'Calculando...' : `${Math.max(returnBalance, 0)} un.`}
                </strong>
              </div>
            )}

          <div className="form-actions">
            <Link className="button button-secondary" to="/movimentacoes">
              Cancelar
            </Link>
            <button
              className="button button-primary"
              type="submit"
              disabled={Boolean(clientError) || balanceLoading}
            >
              Revisar movimentacao
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirming}
        title={`Confirmar ${movementLabel(type).toLocaleLowerCase('pt-BR')}?`}
        loading={saving}
        confirmLabel="Confirmar e registrar"
        onCancel={() => setConfirming(false)}
        onConfirm={confirmMovement}
      >
        <dl className="summary-list">
          <div>
            <dt>Material</dt>
            <dd>{selectedMaterial?.nome}</dd>
          </div>
          <div>
            <dt>Funcionario</dt>
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
        <p className="dialog-note">
          O servidor fara a validacao definitiva no momento do registro.
        </p>
      </ConfirmDialog>

      {signatureOpen && createdMovement && (
        <SignaturePad
          employeeName={createdMovement.funcionarioNome}
          saving={signatureSaving}
          error={signatureError}
          onConfirm={saveSignature}
          onCancel={() => {
            setSignatureOpen(false);
            setSignatureError(null);
          }}
        />
      )}
    </div>
  );
}
