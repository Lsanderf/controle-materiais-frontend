import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  ErrorMessage,
  Loading,
  SuccessMessage,
} from '../components/Feedback';

import RequisicaoStatusBadge from '../components/RequisicaoStatusBadge';
import { useAuth } from '../context/useAuth';
import { useResource } from '../hooks/useResource';
import { requisicaoService } from '../services/requisicaoService';

import {
  formatRequisicaoDate,
  requisicaoTipoLabel,
} from '../utils/requisicoes';

export default function RequisicaoDetailPage() {
  const { id } = useParams();
  const { role } = useAuth();

  const loader = useCallback(
      () => requisicaoService.get(id),
      [id]
  );

  const {
    data: requisicao,
    setData: setRequisicao,
    loading,
    error,
    reload,
  } = useResource(loader, [loader]);

  const [actionError, setActionError] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  async function runAction(action, successMessage) {
    if (saving || !requisicao) {
      return;
    }

    setSaving(true);
    setActionError(null);
    setFeedback('');

    try {
      const requisicaoAtualizada = await action(requisicao.id);

      setRequisicao(requisicaoAtualizada);
      setFeedback(successMessage);
    } catch (requestError) {
      setActionError(requestError);
    } finally {
      setSaving(false);
    }
  }

  if (loading && !requisicao) {
    return <Loading label="Carregando requisição..." />;
  }

  if (error && !requisicao) {
    return (
        <div>
          <ErrorMessage error={error} />

          <button
              className="button button-secondary"
              onClick={reload}
          >
            Tentar novamente
          </button>
        </div>
    );
  }

  if (!requisicao) {
    return null;
  }

  /*
   * O encarregado somente confirma o recebimento depois
   * que o operador realizou/finalizou o atendimento.
   *
   * PENDENTE -> nenhum botão de confirmação
   * AGUARDANDO_CONFIRMACAO -> pode confirmar
   * CONCLUIDA -> somente consulta
   */
  const isFaltaEstoque = requisicao.origem === 'FALTA_ESTOQUE';
  const canConcluir =
      ((role === 'ENCARREGADO' && !isFaltaEstoque) ||
        (role === 'GERENTE' && isFaltaEstoque)) &&
      ['PENDENTE', 'VISUALIZADA'].includes(requisicao.status);

  /*
   * Mantido o comportamento atual de cancelamento do gerente.
   */
  const canCancelar =
      ((role === 'GERENTE' && !isFaltaEstoque) ||
        (role === 'OPERADOR' && isFaltaEstoque) || role === 'ADMIN') &&
      ['PENDENTE', 'VISUALIZADA'].includes(requisicao.status);

  return (
      <div className="page-stack narrow-page">
        <header className="page-heading">
          <div>
            <Link
                className="text-link"
                to="/requisicoes"
            >
              ← Voltar
            </Link>

            <span className="eyebrow">
            Requisição #{requisicao.id}
          </span>

            <h1>
              {requisicaoTipoLabel(requisicao.tipo)}
            </h1>

            <p>
              Enviada em{' '}
              {formatRequisicaoDate(requisicao.criadaEm)}
            </p>
          </div>

          <RequisicaoStatusBadge
              status={requisicao.status}
          />
        </header>

        <SuccessMessage>
          {feedback}
        </SuccessMessage>

        <ErrorMessage
            error={actionError}
        />

        <section className="content-card requisicao-detail">
          <dl>
            {isFaltaEstoque ? <>
              <div><dt>Operador que registrou</dt><dd>{requisicao.operadorRegistrador?.nome}</dd></div>
              <div><dt>Gerente responsável pela compra</dt><dd>{requisicao.gerenteDestinatario?.nome}</dd></div>
              <div><dt>Encarregado relacionado</dt><dd>{requisicao.encarregadoNecessidade?.nome}</dd></div>
            </> : <>
              <div><dt>Gerente solicitante</dt><dd>{requisicao.gerenteSolicitante?.nome}</dd></div>
              <div><dt>Encarregado destinatário</dt><dd>{requisicao.encarregadoDestinatario?.nome}</dd></div>
            </>}

            <div>
              <dt>Contrato</dt>
              <dd>
                {requisicao.contrato.nome}
              </dd>
            </div>

            {requisicao.visualizadaEm && (
                <div>
                  <dt>Visualizada em</dt>
                  <dd>
                    {formatRequisicaoDate(
                        requisicao.visualizadaEm
                    )}
                  </dd>
                </div>
            )}

            {requisicao.concluidaEm && (
                <div>
                  <dt>Concluída em</dt>
                  <dd>
                    {formatRequisicaoDate(
                        requisicao.concluidaEm
                    )}
                  </dd>
                </div>
            )}
          </dl>

          <h2>Materiais solicitados</h2>

          <ul className="requisicao-detail-items">
            {requisicao.itens.map((item) => (
                <li key={item.id}>
                  {item.descricao} x{item.quantidade}
                  {isFaltaEstoque && <small> (solicitado {item.quantidadeSolicitada}, disponível {item.quantidadeDisponivel}, faltante {item.quantidadeFaltante})</small>}
                </li>
            ))}
          </ul>

          {requisicao.observacao && (
              <>
                <h2>Observação</h2>
                <p>{requisicao.observacao}</p>
              </>
          )}
        </section>

        {(canConcluir || canCancelar) && (
            <div className="page-actions">
              {canCancelar && (
                  <button
                      className="button button-secondary"
                      disabled={saving}
                      onClick={() =>
                          runAction(
                              requisicaoService.cancelar,
                              'Requisição cancelada.'
                          )
                      }
                  >
                    {saving
                        ? 'Salvando...'
                        : 'Cancelar requisição'}
                  </button>
              )}

              {canConcluir && (
                  <button
                      className="button button-primary"
                      disabled={saving}
                      onClick={() =>
                          runAction(
                              requisicaoService.concluir,
                              'Recebimento confirmado.'
                          )
                      }
                  >
                    {saving
                        ? 'Confirmando...'
                        : 'Confirmar recebimento'}
                  </button>
              )}
            </div>
        )}
      </div>
  );
}
