import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorMessage, Loading, MovementBadge, SuccessMessage } from './Feedback';
import SignaturePad from './SignaturePad';
import { useAuth } from '../context/useAuth';
import { movimentacaoService } from '../services/movimentacaoService';
import { formatDateTime } from '../utils/formatters';
import { canAddSignature, isSignatureConflict } from '../utils/signature';
import {
  formatChaveAcesso,
  formatCnpj,
  formatNotaFiscalDate,
} from '../utils/notaFiscal';

function EvidencePreview({ evidence }) {
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    setImageUrl('');
    setError(null);
    movimentacaoService
      .getEvidenceFile(evidence.urlArquivo)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch((requestError) => {
        if (active) setError(requestError);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [evidence.urlArquivo]);

  return (
    <div className="receipt-evidence">
      <div className="receipt-evidence-heading">
        <div>
          <strong>Assinatura do funcionário</strong>
          <small>{formatDateTime(evidence.dataEvidencia) ?? 'Data não informada'}</small>
        </div>
        <span className="receipt-evidence-status">Registrada</span>
      </div>

      {imageUrl ? (
        <img
          className="receipt-signature"
          src={imageUrl}
          alt={`Assinatura de ${evidence.funcionario?.nome ?? 'funcionário'}`}
        />
      ) : error ? (
        <p className="muted">Não foi possível carregar a imagem da assinatura.</p>
      ) : (
        <div className="receipt-image-loading" role="status">
          Carregando assinatura...
        </div>
      )}

      <dl className="receipt-meta-list">
        <div>
          <dt>Funcionário</dt>
          <dd>{evidence.funcionario?.nome ?? 'Não informado'}</dd>
        </div>
        <div>
          <dt>Anexada por</dt>
          <dd>{evidence.registradaPor?.username ?? 'Não informado'}</dd>
        </div>
        <div>
          <dt>Integridade</dt>
          <dd className="monospace-cell" title={evidence.sha256}>
            SHA-256 {evidence.sha256?.slice(0, 12)}…
          </dd>
        </div>
      </dl>
    </div>
  );
}

function NotaFiscalEvidence({ notaFiscal, onNavigate }) {
  return (
    <div className="receipt-evidence receipt-invoice-evidence">
      <div className="receipt-evidence-heading">
        <div>
          <strong>Nota Fiscal {notaFiscal.numero}</strong>
          <small>Série {notaFiscal.serie}</small>
        </div>
        <span className="receipt-evidence-status">Evidência principal</span>
      </div>

      <dl className="receipt-meta-list">
        <div>
          <dt>Fornecedor</dt>
          <dd>{notaFiscal.fornecedor}</dd>
        </div>
        <div>
          <dt>CNPJ</dt>
          <dd>{formatCnpj(notaFiscal.cnpjFornecedor)}</dd>
        </div>
        <div>
          <dt>Emissão</dt>
          <dd>{formatNotaFiscalDate(notaFiscal.dataEmissao)}</dd>
        </div>
        <div className="receipt-meta-wide">
          <dt>Chave de acesso</dt>
          <dd className="monospace-cell">
            {formatChaveAcesso(notaFiscal.chaveAcesso)}
          </dd>
        </div>
      </dl>

      <Link
        className="button button-secondary receipt-evidence-link"
        to={`/notas-fiscais/${notaFiscal.id}`}
        onClick={onNavigate}
      >
        Abrir Nota Fiscal
      </Link>
    </div>
  );
}

function ReceiptContent({ receipt, onNavigate, role, onAddSignature }) {
  const signature = receipt.evidencias?.find(
    (evidence) => evidence.tipo === 'ASSINATURA',
  );
  const mayAddSignature = canAddSignature(receipt, role);

  return (
    <>
      <section className="receipt-section">
        <h3>Movimentação</h3>
        <dl className="receipt-grid">
          <div>
            <dt>Identificador</dt>
            <dd>#{receipt.id}</dd>
          </div>
          <div>
            <dt>Quantidade</dt>
            <dd>{receipt.quantidade} un.</dd>
          </div>
          <div>
            <dt>Data e hora</dt>
            <dd>{formatDateTime(receipt.dataMovimentacao) ?? 'Não informada'}</dd>
          </div>
          <div>
            <dt>Finalizada em</dt>
            <dd>{formatDateTime(receipt.dataFinalizacao) ?? 'Não informada'}</dd>
          </div>
          <div className="receipt-grid-wide">
            <dt>Material</dt>
            <dd>
              {receipt.material?.nome ?? 'Não informado'}
              {receipt.material?.descricao && <small>{receipt.material.descricao}</small>}
            </dd>
          </div>
          {receipt.observacao && (
            <div className="receipt-grid-wide">
              <dt>Observação</dt>
              <dd>{receipt.observacao}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="receipt-section">
        <h3>Responsáveis e vínculo</h3>
        <dl className="receipt-grid">
          <div>
            <dt>Funcionário</dt>
            <dd>
              {receipt.funcionario?.nome ?? 'Não aplicável'}
              {receipt.funcionario?.cargo && <small>{receipt.funcionario.cargo}</small>}
            </dd>
          </div>
          <div>
            <dt>Contrato</dt>
            <dd>
              {receipt.contrato?.nome ?? 'Não aplicável'}
              {receipt.contrato?.descricao && <small>{receipt.contrato.descricao}</small>}
            </dd>
          </div>
          <div>
            <dt>Registrado por</dt>
            <dd>
              {receipt.registradoPor?.username ?? 'Não informado'}
              {receipt.registradoPor?.id && <small>ID {receipt.registradoPor.id}</small>}
            </dd>
          </div>
          <div>
            <dt>Versão do comprovante</dt>
            <dd>
              {receipt.versao}
              <small>Gerado em {formatDateTime(receipt.geradoEm) ?? '—'}</small>
            </dd>
          </div>
        </dl>
      </section>

      <section className="receipt-section">
        <h3>Evidências</h3>
        {receipt.notaFiscal && (
          <NotaFiscalEvidence notaFiscal={receipt.notaFiscal} onNavigate={onNavigate} />
        )}
        {signature ? (
          <EvidencePreview evidence={signature} />
        ) : !receipt.notaFiscal ? (
          <div className="receipt-evidence-empty">
            <strong>Assinatura ainda não registrada</strong>
            <span>
              A movimentação permanece comprovada pelos dados imutáveis acima.
            </span>
            {mayAddSignature && (
              <button
                className="button button-primary receipt-add-signature"
                type="button"
                onClick={onAddSignature}
              >
                Adicionar assinatura
              </button>
            )}
          </div>
        ) : null}
      </section>
    </>
  );
}

export default function MovementReceiptModal({ movementId, onClose }) {
  const { role } = useAuth();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [signatureSaving, setSignatureSaving] = useState(false);
  const [signatureError, setSignatureError] = useState(null);
  const [signatureFeedback, setSignatureFeedback] = useState('');
  const closeButtonRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setReceipt(null);

    movimentacaoService
      .getReceipt(movementId)
      .then((data) => {
        if (active) setReceipt(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [movementId, refreshVersion]);

  useEffect(() => {
    setSignatureOpen(false);
    setSignatureError(null);
    setSignatureFeedback('');
  }, [movementId]);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, [movementId]);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !signatureOpen) onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, signatureOpen]);

  async function saveSignature(blob) {
    setSignatureSaving(true);
    setSignatureError(null);
    try {
      const evidence = await movimentacaoService.uploadSignature(movementId, blob);
      setReceipt((current) => ({
        ...current,
        evidencias: [...(current?.evidencias ?? []), evidence],
      }));
      setSignatureOpen(false);
      setSignatureFeedback('Assinatura registrada com sucesso.');
    } catch (requestError) {
      if (isSignatureConflict(requestError)) {
        setSignatureOpen(false);
        setSignatureFeedback(
          'A assinatura já estava registrada. O comprovante foi atualizado.',
        );
        setRefreshVersion((current) => current + 1);
      } else {
        setSignatureError(requestError);
      }
    } finally {
      setSignatureSaving(false);
    }
  }

  return (
    <>
      <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog receipt-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="receipt-dialog-header">
          <div>
            <span className="eyebrow">Registro imutável</span>
            <h2 id="receipt-dialog-title">Comprovante de movimentação</h2>
            {receipt && <MovementBadge type={receipt.tipo} />}
          </div>
          <button
            ref={closeButtonRef}
            className="receipt-close"
            type="button"
            aria-label="Fechar comprovante"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="receipt-dialog-body">
          <SuccessMessage>{signatureFeedback}</SuccessMessage>
          {loading ? (
            <Loading label="Carregando comprovante..." />
          ) : error ? (
            <ErrorMessage error={error} />
          ) : (
            receipt && (
              <ReceiptContent
                receipt={receipt}
                role={role}
                onNavigate={onClose}
                onAddSignature={() => {
                  setSignatureError(null);
                  setSignatureFeedback('');
                  setSignatureOpen(true);
                }}
              />
            )
          )}
        </div>

        <footer className="receipt-dialog-footer">
          <button className="button button-primary" type="button" onClick={onClose}>
            Fechar
          </button>
        </footer>
        </section>
      </div>

      {signatureOpen && receipt && (
        <SignaturePad
          employeeName={receipt.funcionario?.nome}
          saving={signatureSaving}
          error={signatureError}
          onConfirm={saveSignature}
          onCancel={() => {
            setSignatureOpen(false);
            setSignatureError(null);
          }}
        />
      )}
    </>
  );
}
