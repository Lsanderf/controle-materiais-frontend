import { useCallback, useRef, useState } from 'react';
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
  const visualizacao = useRef(null);

  const loader = useCallback(
      async () => {
        const atual = await requisicaoService.get(id);
        if (atual.status === 'PENDENTE' && atual.podeMarcarVisualizada) {
          if (visualizacao.current?.id !== id) {
            const promise = requisicaoService.visualizar(id).catch((requestError) => {
              visualizacao.current = null;
              throw requestError;
            });
            visualizacao.current = { id, promise };
          }
          return visualizacao.current.promise;
        }
        return atual;
      },
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
  const [edicao, setEdicao] = useState(null);

  function iniciarEdicao() {
    setActionError(null);
    setFeedback('');
    setEdicao({ versao: requisicao.versao, observacao: requisicao.observacao ?? '',
      originais: requisicao.itens.map((item) => ({ ...item })),
      itens: requisicao.itens.map((item) => ({ id: item.id, descricao: item.descricao, quantidade: String(item.quantidade) })),
    });
  }

  function alterarItem(index, campo, valor) {
    setEdicao((atual) => ({ ...atual, itens: atual.itens.map((item, posicao) => (
      posicao === index ? { ...item, [campo]: valor } : item
    )) }));
  }

  async function salvarEdicao(event) {
    event.preventDefault();
    if (saving || !edicao) return;
    if (edicao.itens.length === 0) {
      setActionError(new Error('Informe ao menos um item.'));
      return;
    }
    if (edicao.itens.length > 100 || edicao.observacao.length > 1000 || edicao.itens.some((item) => (
      !item.descricao.trim() || item.descricao.length > 255 || !Number.isInteger(Number(item.quantidade))
      || Number(item.quantidade) < 1 || Number(item.quantidade) > 10000
    ))) {
      setActionError(new Error('Confira a descrição, a quantidade e os limites dos itens e da observação.'));
      return;
    }
    const itensAlterados = {};
    const novosItens = [];
    for (const item of edicao.itens) {
      const conteudo = { descricao: item.descricao.trim(), quantidade: Number(item.quantidade) };
      if (item.id == null) novosItens.push(conteudo);
      else {
        const original = edicao.originais.find((anterior) => anterior.id === item.id);
        if (conteudo.descricao !== original.descricao || conteudo.quantidade !== original.quantidade) {
          itensAlterados[item.id] = conteudo;
        }
      }
    }
    const itensRemovidos = edicao.originais.filter((item) => !edicao.itens.some((atual) => atual.id === item.id)).map((item) => item.id);
    setSaving(true);
    setActionError(null);
    setFeedback('');
    try {
      const atualizada = await requisicaoService.alterar(requisicao.id, {
        versao: edicao.versao, observacao: edicao.observacao.trim() || null, itensAlterados, novosItens, itensRemovidos,
      });
      setRequisicao(atualizada);
      setEdicao(null);
      setFeedback('Requisição atualizada com sucesso.');
    } catch (requestError) {
      setActionError(requestError);
      if (requestError.status === 409) {
        setEdicao(null);
        try {
          await reload();
        } catch {
          setActionError(new Error(`${requestError.message} Não foi possível carregar os dados atuais. Tente novamente.`));
        }
      }
    } finally {
      setSaving(false);
    }
  }

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

  const isFaltaEstoque = requisicao.origem === 'FALTA_ESTOQUE';
  const canAlterar = role === 'GERENTE' && requisicao.podeAlterar
      && requisicao.origem === 'MANUAL' && requisicao.tipo === 'RETIRADA' && requisicao.status === 'PENDENTE';
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

        {error && requisicao && <ErrorMessage error={error} />}

        {edicao && (
          <form className="content-card form-card" onSubmit={salvarEdicao}>
            <h2>Alterar requisição</h2>
            <fieldset disabled={saving} className="requisicao-items">
              <legend>Itens da requisição</legend>
              {edicao.itens.map((item, index) => (
                <div className="requisicao-item-row" key={item.id ?? `novo-${index}`}>
                  <label className="field">
                    <span>Descrição do item {index + 1}</span>
                    <input value={item.descricao} maxLength="255" required
                      onChange={(event) => alterarItem(index, 'descricao', event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Quantidade do item {index + 1}</span>
                    <input type="number" min="1" max="10000" step="1" value={item.quantidade} required
                      onChange={(event) => alterarItem(index, 'quantidade', event.target.value)} />
                  </label>
                  <button type="button" className="text-button danger requisicao-remove" aria-label={`Remover item ${index + 1}`}
                    onClick={() => setEdicao((atual) => ({ ...atual, itens: atual.itens.filter((_, posicao) => posicao !== index) }))}>
                    Remover
                  </button>
                </div>
              ))}
              <button type="button" className="text-button" disabled={edicao.itens.length >= 100}
                onClick={() => setEdicao((atual) => ({ ...atual, itens: [...atual.itens, { descricao: '', quantidade: '' }] }))}>
                + Adicionar item
              </button>
              <label className="field">
                <span>Observação</span>
                <textarea maxLength="1000" value={edicao.observacao}
                  onChange={(event) => setEdicao((atual) => ({ ...atual, observacao: event.target.value }))} />
              </label>
            </fieldset>
            <div className="form-actions">
              <button type="button" className="button button-secondary" disabled={saving}
                onClick={() => { setEdicao(null); setActionError(null); }}>
                Cancelar edição
              </button>
              <button className="button button-primary" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        )}

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

        {!edicao && (canAlterar || canConcluir || canCancelar) && (
            <div className="page-actions">
              {canAlterar && <button className="button button-primary" disabled={saving} onClick={iniciarEdicao}>Alterar</button>}
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
