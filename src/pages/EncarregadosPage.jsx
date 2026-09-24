import { useCallback, useMemo, useState } from 'react';
import EncarregadoForm from '../components/EncarregadoForm';
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
import {
  canCreateEncarregado,
  filterEncarregados,
} from '../utils/encarregados';
import { formatCelular } from '../utils/formatters';

export default function EncarregadosPage() {
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [showForm, setShowForm] = useState(false);
  const [editingEncarregado, setEditingEncarregado] = useState(null);
  const [success, setSuccess] = useState('');
  const [actionError, setActionError] = useState(null);
  const loader = useCallback(() => usuarioService.listEncarregados(), []);
  const {
    data: encarregados,
    loading,
    error,
    reload,
  } = useResource(loader, [loader]);

  const hasStatus = (encarregados ?? []).some(
    (encarregado) => typeof encarregado.ativo === 'boolean',
  );
  const filteredEncarregados = useMemo(
    () =>
      filterEncarregados(
        encarregados ?? [],
        search,
        hasStatus ? statusFilter : 'TODOS',
      ),
    [encarregados, hasStatus, search, statusFilter],
  );
  const canCreate = canCreateEncarregado(role);

  async function handleCreated() {
    setShowForm(false);
    setEditingEncarregado(null);
    setSuccess('Encarregado cadastrado com sucesso.');
    await reload().catch(() => {});
  }

  async function toggleEncarregado(encarregado) {
    setActionError(null);
    try {
      if (encarregado.ativo) await usuarioService.deactivateEncarregado(encarregado.id);
      else await usuarioService.activateEncarregado(encarregado.id);
      setSuccess(`Encarregado ${encarregado.ativo ? 'desativado' : 'ativado'} com sucesso.`);
      await reload();
    } catch (requestError) { setActionError(requestError); }
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Cadastros</span>
          <h1>Encarregados</h1>
          <p>Consulte as pessoas responsáveis pelo recebimento de materiais.</p>
        </div>
        {canCreate && !showForm && (
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              setSuccess('');
              setEditingEncarregado(null);
              setShowForm(true);
            }}
          >
            + Novo encarregado
          </button>
        )}
      </header>

      <SuccessMessage>{success}</SuccessMessage>

      {showForm && canCreate && (
        <EncarregadoForm
          encarregado={editingEncarregado}
          onCancel={() => { setShowForm(false); setEditingEncarregado(null); }}
          onCreated={handleCreated}
          onUpdated={async () => { setShowForm(false); setEditingEncarregado(null); setSuccess('Encarregado atualizado com sucesso.'); await reload().catch(() => {}); }}
        />
      )}

      <ErrorMessage error={actionError} />

      <div className="list-controls">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, usuário ou celular"
            aria-label="Buscar encarregados"
          />
        </label>
        {hasStatus && (
          <StatusFilter
            value={statusFilter}
            onChange={setStatusFilter}
            ariaLabel="Filtrar encarregados por status"
          />
        )}
      </div>

      {loading ? (
        <Loading label="Carregando encarregados..." />
      ) : error ? (
        <div>
          <ErrorMessage error={error} />
          <button className="button button-secondary" onClick={reload}>
            Tentar novamente
          </button>
        </div>
      ) : filteredEncarregados.length === 0 ? (
        <EmptyState
          title={
            search || (hasStatus && statusFilter !== 'TODOS')
              ? 'Nenhum encarregado encontrado.'
              : 'Nenhum encarregado cadastrado.'
          }
          description={
            search || (hasStatus && statusFilter !== 'TODOS')
              ? 'Ajuste a busca ou o filtro de status.'
              : undefined
          }
        />
      ) : (
        <>
          <div className="mobile-card-list">
            {filteredEncarregados.map((encarregado) => (
              <article
                className="resource-card"
                key={encarregado.id ?? encarregado.username}
              >
                <div className="resource-card-heading">
                  <div>
                    <small>
                      {encarregado.id
                        ? `Encarregado #${encarregado.id}`
                        : 'Encarregado'}
                    </small>
                    <h2>{encarregado.nome}</h2>
                  </div>
                  {typeof encarregado.ativo === 'boolean' && (
                    <StatusBadge active={encarregado.ativo} />
                  )}
                </div>
                <p>
                  {encarregado.username}
                  {encarregado.celular
                    ? ` · ${formatCelular(encarregado.celular)}`
                    : ''}
                </p>
                {canCreate && <div className="resource-actions"><button className="button button-secondary" type="button" onClick={() => { setEditingEncarregado(encarregado); setShowForm(true); }}>Editar</button><button className={`text-button ${encarregado.ativo ? 'danger' : ''}`} type="button" onClick={() => toggleEncarregado(encarregado)}>{encarregado.ativo ? 'Desativar' : 'Ativar'}</button></div>}
              </article>
            ))}
          </div>

          <div className="table-wrap desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Usuário</th>
                  <th>Celular</th>
                  {hasStatus && <th>Status</th>}
                  {canCreate && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filteredEncarregados.map((encarregado) => (
                  <tr key={encarregado.id ?? encarregado.username}>
                    <td>
                      <strong>{encarregado.nome}</strong>
                      {encarregado.id && <small>#{encarregado.id}</small>}
                    </td>
                    <td>{encarregado.username}</td>
                    <td>{formatCelular(encarregado.celular) || '—'}</td>
                    {hasStatus && (
                      <td>
                        {typeof encarregado.ativo === 'boolean' ? (
                          <StatusBadge active={encarregado.ativo} />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {canCreate && <td><div className="table-actions"><button className="text-link" type="button" onClick={() => { setEditingEncarregado(encarregado); setShowForm(true); }}>Editar</button><button className={`text-button ${encarregado.ativo ? 'danger' : ''}`} type="button" onClick={() => toggleEncarregado(encarregado)}>{encarregado.ativo ? 'Desativar' : 'Ativar'}</button></div></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
