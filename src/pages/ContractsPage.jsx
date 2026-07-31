import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusFilter from '../components/StatusFilter';
import {
  EmptyState,
  ErrorMessage,
  Loading,
  StatusBadge,
  SuccessMessage,
} from '../components/Feedback';
import { useAuth } from '../context/useAuth';
import { useResource } from '../hooks/useResource';
import { contratoService } from '../services/contratoService';
import { filterBySearchAndStatus } from '../utils/listFilters';

export default function ContractsPage() {
  const { role } = useAuth();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState(location.state?.success ?? '');
  const loader = useCallback(() => contratoService.list(), []);
  const {
    data: contracts,
    loading,
    error,
    reload,
  } = useResource(loader, [loader]);

  const filteredContracts = useMemo(() => {
    return filterBySearchAndStatus(
      contracts ?? [],
      search,
      statusFilter,
      (contract) => [contract.nome, contract.descricao],
    );
  }, [contracts, search, statusFilter]);

  async function toggleContract() {
    setUpdating(true);
    setActionError(null);
    try {
      await contratoService.update(selected.id, {
        nome: selected.nome,
        descricao: selected.descricao,
        ativo: !selected.ativo,
      });
      setSuccess(
        `Contrato ${selected.ativo ? 'desativado' : 'ativado'} com sucesso.`,
      );
      setSelected(null);
      await reload();
    } catch (requestError) {
      setActionError(requestError);
      setSelected(null);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Cadastros</span>
          <h1>Contratos</h1>
          <p>Gerencie os contratos usados nas movimentações.</p>
        </div>
        {role === 'ADMIN' && (
          <Link className="button button-primary" to="/contratos/novo">
            + Novo contrato
          </Link>
        )}
      </header>

      <SuccessMessage>{success}</SuccessMessage>
      <ErrorMessage error={actionError} />

      <div className="list-controls">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou descrição"
            aria-label="Buscar contratos"
          />
        </label>
        <StatusFilter
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Filtrar contratos por status"
        />
      </div>

      {loading ? (
        <Loading label="Carregando contratos..." />
      ) : error ? (
        <div>
          <ErrorMessage error={error} />
          <button className="button button-secondary" onClick={reload}>
            Tentar novamente
          </button>
        </div>
      ) : filteredContracts.length === 0 ? (
        <EmptyState
          title={
            search || statusFilter !== 'TODOS'
              ? 'Nenhum contrato encontrado.'
              : 'Nenhum contrato cadastrado.'
          }
          description={
            search || statusFilter !== 'TODOS'
              ? 'Ajuste a busca ou o filtro de status.'
              : undefined
          }
        />
      ) : (
        <>
          <div className="mobile-card-list">
            {filteredContracts.map((contract) => (
              <article className="resource-card" key={contract.id}>
                <div className="resource-card-heading">
                  <div>
                    <small>Contrato #{contract.id}</small>
                    <h2>{contract.nome}</h2>
                  </div>
                  <StatusBadge active={contract.ativo} />
                </div>
                <p>{contract.descricao}</p>
                {role === 'ADMIN' && (
                  <div className="resource-actions">
                    <Link
                      className="button button-secondary"
                      to={`/contratos/${contract.id}/editar`}
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      className={`text-button ${contract.ativo ? 'danger' : ''}`}
                      onClick={() => setSelected(contract)}
                    >
                      {contract.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="table-wrap desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Contrato</th>
                  <th>Descrição</th>
                  <th>Status</th>
                  {role === 'ADMIN' && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filteredContracts.map((contract) => (
                  <tr key={contract.id}>
                    <td>
                      <strong>{contract.nome}</strong>
                      <small>#{contract.id}</small>
                    </td>
                    <td>{contract.descricao}</td>
                    <td>
                      <StatusBadge active={contract.ativo} />
                    </td>
                    {role === 'ADMIN' && (
                      <td>
                        <div className="table-actions">
                          <Link
                            className="text-link"
                            to={`/contratos/${contract.id}/editar`}
                          >
                            Editar
                          </Link>
                          <button
                            className={`text-button ${
                              contract.ativo ? 'danger' : ''
                            }`}
                            type="button"
                            onClick={() => setSelected(contract)}
                          >
                            {contract.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(selected)}
        title={`${selected?.ativo ? 'Desativar' : 'Ativar'} contrato?`}
        confirmLabel={selected?.ativo ? 'Desativar' : 'Ativar'}
        loading={updating}
        onCancel={() => setSelected(null)}
        onConfirm={toggleContract}
      >
        <p>
          {selected?.ativo
            ? `${selected?.nome} continuará no histórico, mas não poderá receber novas movimentações.`
            : `${selected?.nome} voltará a receber novas movimentações.`}
        </p>
      </ConfirmDialog>
    </div>
  );
}
