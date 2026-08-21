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
import { notaFiscalService } from '../services/notaFiscalService';
import {
  canManageNotaFiscal,
  filterNotasFiscais,
  formatChaveAcesso,
  formatCnpj,
  formatNotaFiscalDate,
  formatNotaFiscalDateTime,
  notaFiscalStatusLabel,
} from '../utils/notaFiscal';

const filters = [
  { value: 'TODOS', label: 'Todas' },
  { value: 'RASCUNHO', label: 'Rascunho' },
  { value: 'CONFIRMADA', label: 'Confirmada' },
];

function NotaFiscalStatusBadge({ status }) {
  return (
    <span className={`badge badge-${status?.toLowerCase()}`}>
      {notaFiscalStatusLabel(status)}
    </span>
  );
}

export default function NotasFiscaisPage() {
  const { role } = useAuth();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const loader = useCallback(() => notaFiscalService.list(), []);
  const {
    data: notasFiscais,
    loading,
    error,
    reload,
  } = useResource(loader, [loader]);

  const filteredNotas = useMemo(
    () => filterNotasFiscais(notasFiscais ?? [], search, statusFilter),
    [notasFiscais, search, statusFilter],
  );

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Recebimento</span>
          <h1>Notas fiscais</h1>
          <p>Receba materiais por Nota Fiscal de Entrada e acompanhe os rascunhos.</p>
        </div>
        {canManageNotaFiscal(role) && (
          <Link className="button button-primary" to="/notas-fiscais/nova">
            + Nova nota fiscal
          </Link>
        )}
      </header>

      <SuccessMessage>{location.state?.success}</SuccessMessage>

      <div className="list-controls">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por numero, chave ou fornecedor"
            aria-label="Buscar notas fiscais"
          />
        </label>

        <div
          className="filter-tabs"
          role="group"
          aria-label="Filtrar notas fiscais por status"
        >
          {filters.map((item) => (
            <button
              type="button"
              key={item.value}
              className={statusFilter === item.value ? 'active' : ''}
              onClick={() => setStatusFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Loading label="Carregando notas fiscais..." />
      ) : error ? (
        <div>
          <ErrorMessage error={error} />
          <button className="button button-secondary" onClick={reload}>
            Tentar novamente
          </button>
        </div>
      ) : filteredNotas.length === 0 ? (
        <EmptyState
          title={
            search || statusFilter !== 'TODOS'
              ? 'Nenhuma nota fiscal encontrada.'
              : 'Nenhuma nota fiscal cadastrada.'
          }
          description={
            search || statusFilter !== 'TODOS'
              ? 'Ajuste a busca ou o filtro de status.'
              : 'As notas fiscais em rascunho e confirmadas aparecerao aqui.'
          }
        />
      ) : (
        <>
          <div className="mobile-card-list">
            {filteredNotas.map((notaFiscal) => (
              <article className="resource-card invoice-card" key={notaFiscal.id}>
                <div className="resource-card-heading">
                  <div>
                    <small>NF #{notaFiscal.id}</small>
                    <h2>
                      {notaFiscal.numero} / {notaFiscal.serie}
                    </h2>
                  </div>
                  <NotaFiscalStatusBadge status={notaFiscal.status} />
                </div>
                <dl className="history-details">
                  <div>
                    <dt>Fornecedor</dt>
                    <dd>{notaFiscal.fornecedor}</dd>
                  </div>
                  <div>
                    <dt>CNPJ</dt>
                    <dd>{formatCnpj(notaFiscal.cnpjFornecedor)}</dd>
                  </div>
                  <div>
                    <dt>Emissao</dt>
                    <dd>{formatNotaFiscalDate(notaFiscal.dataEmissao)}</dd>
                  </div>
                  <div>
                    <dt>Entrada</dt>
                    <dd>{formatNotaFiscalDateTime(notaFiscal.dataEntrada)}</dd>
                  </div>
                </dl>
                <div className="resource-actions">
                  <Link
                    className="button button-secondary"
                    to={`/notas-fiscais/${notaFiscal.id}`}
                  >
                    Visualizar
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className="table-wrap desktop-table">
            <table>
              <thead>
                <tr>
                  <th>NF</th>
                  <th>Fornecedor</th>
                  <th>Chave de acesso</th>
                  <th>Status</th>
                  <th>Emissao</th>
                  <th>Entrada</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotas.map((notaFiscal) => (
                  <tr key={notaFiscal.id}>
                    <td>
                      <strong>
                        {notaFiscal.numero} / {notaFiscal.serie}
                      </strong>
                      <small>#{notaFiscal.id}</small>
                    </td>
                    <td>
                      <strong>{notaFiscal.fornecedor}</strong>
                      <small>{formatCnpj(notaFiscal.cnpjFornecedor)}</small>
                    </td>
                    <td className="monospace-cell">
                      {formatChaveAcesso(notaFiscal.chaveAcesso)}
                    </td>
                    <td>
                      <NotaFiscalStatusBadge status={notaFiscal.status} />
                    </td>
                    <td>{formatNotaFiscalDate(notaFiscal.dataEmissao)}</td>
                    <td>{formatNotaFiscalDateTime(notaFiscal.dataEntrada)}</td>
                    <td>
                      <Link
                        className="text-link"
                        to={`/notas-fiscais/${notaFiscal.id}`}
                      >
                        Visualizar
                      </Link>
                    </td>
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
