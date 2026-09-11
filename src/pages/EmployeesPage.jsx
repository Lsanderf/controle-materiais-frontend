import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  InactivationTableValue,
  MobileInactivationDetails,
} from '../components/InactivationDetails';
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
import { funcionarioService } from '../services/funcionarioService';
import { filterBySearchAndStatus } from '../utils/listFilters';

export default function EmployeesPage() {
  const { role } = useAuth();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState(location.state?.success ?? '');
  const loader = useCallback(() => funcionarioService.list(), []);
  const {
    data: employees,
    setData: setEmployees,
    loading,
    error,
    reload,
  } = useResource(loader, [loader]);

  const filteredEmployees = useMemo(() => {
    return filterBySearchAndStatus(
      employees ?? [],
      search,
      statusFilter,
      (employee) => [employee.nome, employee.cargo],
    );
  }, [employees, search, statusFilter]);

  async function toggleEmployee() {
    setUpdating(true);
    setActionError(null);
    try {
      if (selected.ativo) {
        const updated = await funcionarioService.deactivate(selected.id);
        setEmployees((current) =>
          (current ?? []).map((employee) =>
            employee.id === updated.id ? updated : employee,
          ),
        );
      } else {
        const updated = await funcionarioService.activate(selected.id);
        setEmployees((current) =>
          (current ?? []).map((employee) =>
            employee.id === updated.id ? updated : employee,
          ),
        );
      }
      setSuccess(
        `Funcionário ${selected.ativo ? 'desativado' : 'ativado'} com sucesso.`,
      );
      setSelected(null);
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
          <h1>Funcionários</h1>
          <p>Consulte as pessoas habilitadas para retirar materiais.</p>
        </div>
        {role === 'ADMIN' && (
          <Link className="button button-primary" to="/funcionarios/novo">
            + Novo funcionário
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
            placeholder="Buscar por nome ou cargo"
            aria-label="Buscar funcionários"
          />
        </label>
        <StatusFilter
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Filtrar funcionários por status"
        />
      </div>

      {loading ? (
        <Loading label="Carregando funcionários..." />
      ) : error ? (
        <div>
          <ErrorMessage error={error} />
          <button className="button button-secondary" onClick={reload}>
            Tentar novamente
          </button>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <EmptyState
          title={
            search || statusFilter !== 'TODOS'
              ? 'Nenhum funcionário encontrado.'
              : 'Nenhum funcionário cadastrado.'
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
            {filteredEmployees.map((employee) => (
              <article className="resource-card" key={employee.id}>
                <div className="resource-card-heading">
                  <div>
                    <small>Funcionário #{employee.id}</small>
                    <h2>{employee.nome}</h2>
                  </div>
                  <StatusBadge active={employee.ativo} />
                </div>
                <p>{employee.cargo}</p>
                <MobileInactivationDetails record={employee} />
                {role === 'ADMIN' && (
                  <div className="resource-actions">
                    <Link
                      className="button button-secondary"
                      to={`/funcionarios/${employee.id}/editar`}
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      className={`text-button ${employee.ativo ? 'danger' : ''}`}
                      onClick={() => setSelected(employee)}
                    >
                      {employee.ativo ? 'Desativar' : 'Ativar'}
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
                  <th>Nome</th>
                  <th>Cargo</th>
                  <th>Status</th>
                  <th>Inativado em</th>
                  {role === 'ADMIN' && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <strong>{employee.nome}</strong>
                      <small>#{employee.id}</small>
                    </td>
                    <td>{employee.cargo}</td>
                    <td>
                      <StatusBadge active={employee.ativo} />
                    </td>
                    <td>
                      <InactivationTableValue record={employee} />
                    </td>
                    {role === 'ADMIN' && (
                      <td>
                        <div className="table-actions">
                          <Link
                            className="text-link"
                            to={`/funcionarios/${employee.id}/editar`}
                          >
                            Editar
                          </Link>
                          <button
                            className={`text-button ${
                              employee.ativo ? 'danger' : ''
                            }`}
                            type="button"
                            onClick={() => setSelected(employee)}
                          >
                            {employee.ativo ? 'Desativar' : 'Ativar'}
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
        title={`${selected?.ativo ? 'Desativar' : 'Ativar'} funcionário?`}
        confirmLabel={selected?.ativo ? 'Desativar' : 'Ativar'}
        loading={updating}
        onCancel={() => setSelected(null)}
        onConfirm={toggleEmployee}
      >
        <p>
          {selected?.ativo
            ? `${selected?.nome} não aparecerá em novas movimentações.`
            : `${selected?.nome} voltará a aparecer em novas movimentações.`}
        </p>
      </ConfirmDialog>
    </div>
  );
}
