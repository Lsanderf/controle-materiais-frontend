import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  EmptyState,
  ErrorMessage,
  Loading,
  SuccessMessage,
} from '../components/Feedback';
import { useAuth } from '../context/useAuth';
import { useResource } from '../hooks/useResource';
import { materialService } from '../services/materialService';

export default function MaterialsPage() {
  const { role, hasAnyRole } = useAuth();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const loader = useCallback(() => materialService.list(), []);
  const { data: materials, loading, error, reload } = useResource(loader, [loader]);

  const filteredMaterials = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return materials ?? [];
    return (materials ?? []).filter(
      (material) =>
        material.nome.toLocaleLowerCase('pt-BR').includes(term) ||
        material.descricao.toLocaleLowerCase('pt-BR').includes(term),
    );
  }, [materials, search]);

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Estoque</span>
          <h1>Materiais</h1>
          <p>Consulte o saldo atual e mantenha os itens organizados.</p>
        </div>
        {hasAnyRole('ADMIN', 'OPERADOR') && (
          <Link className="button button-primary" to="/materiais/novo">
            + Novo material
          </Link>
        )}
      </header>

      <SuccessMessage>{location.state?.success}</SuccessMessage>

      <label className="search-field">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome ou descrição"
          aria-label="Buscar materiais"
        />
      </label>

      {loading ? (
        <Loading label="Carregando materiais..." />
      ) : error ? (
        <div>
          <ErrorMessage error={error} />
          <button className="button button-secondary" onClick={reload}>
            Tentar novamente
          </button>
        </div>
      ) : filteredMaterials.length === 0 ? (
        <EmptyState
          title={search ? 'Nenhum material encontrado.' : 'Nenhum material cadastrado.'}
          description={
            search
              ? 'Tente buscar usando outro termo.'
              : 'Cadastre o primeiro material para começar.'
          }
        />
      ) : (
        <>
          <div className="mobile-card-list">
            {filteredMaterials.map((material) => (
              <article className="resource-card" key={material.id}>
                <div className="resource-card-heading">
                  <div>
                    <small>Material #{material.id}</small>
                    <h2>{material.nome}</h2>
                  </div>
                  <span
                    className={`stock-pill ${
                      material.quantidadeEstoque === 0 ? 'empty' : ''
                    }`}
                  >
                    {material.quantidadeEstoque} un.
                  </span>
                </div>
                <p>{material.descricao}</p>
                {role === 'ADMIN' && (
                  <div className="resource-actions">
                    <Link
                      className="button button-secondary"
                      to={`/materiais/${material.id}/editar`}
                    >
                      Editar
                    </Link>
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="table-wrap desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Descrição</th>
                  <th className="number-cell">Estoque</th>
                  {role === 'ADMIN' && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map((material) => (
                  <tr key={material.id}>
                    <td>
                      <strong>{material.nome}</strong>
                      <small>#{material.id}</small>
                    </td>
                    <td>{material.descricao}</td>
                    <td className="number-cell">
                      <span
                        className={`stock-pill ${
                          material.quantidadeEstoque === 0 ? 'empty' : ''
                        }`}
                      >
                        {material.quantidadeEstoque} un.
                      </span>
                    </td>
                    {role === 'ADMIN' && (
                      <td>
                        <Link
                          className="text-link"
                          to={`/materiais/${material.id}/editar`}
                        >
                          Editar
                        </Link>
                      </td>
                    )}
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
