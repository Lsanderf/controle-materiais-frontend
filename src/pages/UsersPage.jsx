import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  InactivationTableValue,
  MobileInactivationDetails,
} from '../components/InactivationDetails';
import {
  EmptyState,
  ErrorMessage,
  Loading,
  StatusBadge,
  SuccessMessage,
} from '../components/Feedback';
import StatusFilter from '../components/StatusFilter';
import { useAuth } from '../context/useAuth';
import { useResource } from '../hooks/useResource';
import { usuarioService } from '../services/usuarioService';
import { formatCelular, roleLabel } from '../utils/formatters';
import { filterBySearchAndStatus } from '../utils/listFilters';

export default function UsersPage() {
  const { auth } = useAuth();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState(location.state?.success ?? '');
  const loader = useCallback(() => usuarioService.list(), []);
  const {
    data: users,
    setData: setUsers,
    loading,
    error,
    reload,
  } = useResource(loader, [loader]);

  const filteredUsers = useMemo(() => {
    return filterBySearchAndStatus(
      users ?? [],
      search,
      statusFilter,
      (user) => [user.nome, user.cpf, user.celular, user.username, roleLabel(user.role)],
    );
  }, [search, statusFilter, users]);

  async function toggleUser() {
    if (
      selected.ativo &&
      selected.username.toLocaleLowerCase('pt-BR') ===
        auth.username.toLocaleLowerCase('pt-BR')
    ) {
      setActionError({
        message:
          'Você não pode desativar seu próprio usuário enquanto está conectado.',
      });
      setSelected(null);
      return;
    }

    setUpdating(true);
    setActionError(null);
    try {
      if (selected.ativo) {
        const updated = await usuarioService.deactivate(selected.id);
        setUsers((current) =>
          (current ?? []).map((user) =>
            user.id === updated.id ? updated : user,
          ),
        );
      } else {
        const updated = await usuarioService.activate(selected.id);
        setUsers((current) =>
          (current ?? []).map((user) =>
            user.id === updated.id ? updated : user,
          ),
        );
      }
      setSuccess(
        `Usuário ${selected.ativo ? 'desativado' : 'ativado'} com sucesso.`,
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
          <span className="eyebrow">Administração</span>
          <h1>Usuários</h1>
          <p>Gerencie acessos, perfis e a disponibilidade de cada conta.</p>
        </div>
        <Link className="button button-primary" to="/usuarios/novo">
          + Novo usuário
        </Link>
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
            placeholder="Buscar por nome, CPF, usuário ou perfil"
            aria-label="Buscar usuários"
          />
        </label>
        <StatusFilter
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Filtrar usuários por status"
        />
      </div>

      {loading ? (
        <Loading label="Carregando usuários..." />
      ) : error ? (
        <div>
          <ErrorMessage error={error} />
          <button className="button button-secondary" onClick={reload}>
            Tentar novamente
          </button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          title={
            search || statusFilter !== 'TODOS'
              ? 'Nenhum usuário encontrado.'
              : 'Nenhum usuário cadastrado.'
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
            {filteredUsers.map((user) => (
              <article className="resource-card" key={user.id}>
                <div className="resource-card-heading">
                  <div>
                    <small>Usuário #{user.id}</small>
                    <h2>{user.nome}</h2>
                  </div>
                  <StatusBadge active={user.ativo} />
                </div>
                <p>@{user.username} · {roleLabel(user.role)}</p>
                <p>CPF: {user.cpf} · Celular: {formatCelular(user.celular)}</p>
                <MobileInactivationDetails record={user} />
                <div className="resource-actions">
                  <Link
                    className="button button-secondary"
                    to={`/usuarios/${user.id}/editar`}
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    className={`text-button ${user.ativo ? 'danger' : ''}`}
                    onClick={() => setSelected(user)}
                  >
                    {user.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="table-wrap desktop-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome / usuário</th>
                  <th>CPF / celular</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th>Inativado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>#{user.id}</td>
                    <td>
                      <strong>{user.nome}</strong>
                      <small className="table-secondary">@{user.username}</small>
                    </td>
                    <td>{user.cpf}<small className="table-secondary">{formatCelular(user.celular)}</small></td>
                    <td>{roleLabel(user.role)}</td>
                    <td>
                      <StatusBadge active={user.ativo} />
                    </td>
                    <td>
                      <InactivationTableValue record={user} />
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link
                          className="text-link"
                          to={`/usuarios/${user.id}/editar`}
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          className={`text-button ${user.ativo ? 'danger' : ''}`}
                          onClick={() => setSelected(user)}
                        >
                          {user.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(selected)}
        title={`${selected?.ativo ? 'Desativar' : 'Ativar'} usuário?`}
        confirmLabel={selected?.ativo ? 'Desativar' : 'Ativar'}
        loading={updating}
        onCancel={() => setSelected(null)}
        onConfirm={toggleUser}
      >
        <p>
          {selected?.ativo
            ? `${selected?.username} perderá o acesso imediatamente, inclusive com tokens já emitidos.`
            : `${selected?.username} poderá voltar a entrar no sistema.`}
        </p>
      </ConfirmDialog>
    </div>
  );
}
