import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SIGNATURE_CONTENT_TYPE,
  SIGNATURE_FILE_NAME,
  canvasToPngBlob,
  canAddSignature,
  canSubmitSignature,
  createSignatureFormData,
  isSignatureConflict,
} from '../src/utils/signature.js';

function receipt(tipo, evidencias = []) {
  return { id: 42, tipo, evidencias };
}

test('canvas vazio não pode ser confirmado ou enviado', () => {
  assert.equal(canSubmitSignature(false, false), false);
  assert.equal(canSubmitSignature(true, true), false);
  assert.equal(canSubmitSignature(true, false), true);
});

test('assinatura válida é exportada como Blob PNG', async () => {
  let requestedType;
  const canvas = {
    toBlob(callback, type) {
      requestedType = type;
      callback(new Blob(['png'], { type }));
    },
  };

  const blob = await canvasToPngBlob(canvas);

  assert.equal(requestedType, SIGNATURE_CONTENT_TYPE);
  assert.equal(blob.type, 'image/png');
  assert.ok(blob.size > 0);
});

test('FormData envia o PNG no campo arquivo', () => {
  const formData = createSignatureFormData(
    new Blob(['png'], { type: SIGNATURE_CONTENT_TYPE }),
  );
  const uploadedFile = formData.get('arquivo');

  assert.ok(uploadedFile);
  assert.equal(uploadedFile.name, SIGNATURE_FILE_NAME);
  assert.equal(uploadedFile.type, SIGNATURE_CONTENT_TYPE);
});

test('RETIRADA e DEVOLUCAO permitem assinatura para ADMIN e OPERADOR', () => {
  assert.equal(canAddSignature(receipt('RETIRADA'), 'ADMIN'), true);
  assert.equal(canAddSignature(receipt('RETIRADA'), 'OPERADOR'), true);
  assert.equal(canAddSignature(receipt('DEVOLUCAO'), 'ADMIN'), true);
  assert.equal(canAddSignature(receipt('DEVOLUCAO'), 'OPERADOR'), true);
});

test('ENTRADA não oferece assinatura', () => {
  assert.equal(canAddSignature(receipt('ENTRADA'), 'ADMIN'), false);
});

test('assinatura existente não pode ser substituída pela interface', () => {
  const signedReceipt = receipt('RETIRADA', [{ tipo: 'ASSINATURA' }]);
  assert.equal(canAddSignature(signedReceipt, 'ADMIN'), false);
});

test('perfil GERENTE nunca recebe opção de adicionar assinatura', () => {
  assert.equal(canAddSignature(receipt('RETIRADA'), 'GERENTE'), false);
  assert.equal(canAddSignature(receipt('DEVOLUCAO'), 'GERENTE'), false);
});

test('conflito 409 é identificado para recarregar o comprovante', () => {
  assert.equal(isSignatureConflict({ status: 409 }), true);
  assert.equal(isSignatureConflict({ status: 403 }), false);
});

test('componente usa Pointer Events e serviço reutiliza apiRequest', () => {
  const component = readFileSync(
    new URL('../src/components/SignaturePad.jsx', import.meta.url),
    'utf8',
  );
  const service = readFileSync(
    new URL('../src/services/movimentacaoService.js', import.meta.url),
    'utf8',
  );
  const receiptModal = readFileSync(
    new URL('../src/components/MovementReceiptModal.jsx', import.meta.url),
    'utf8',
  );

  assert.match(component, /onPointerDown=\{startDrawing\}/);
  assert.match(component, /onPointerMove=\{continueDrawing\}/);
  assert.match(component, /window\.devicePixelRatio/);
  assert.match(service, /`\/movimentacoes\/\$\{id\}\/assinatura`/);
  assert.match(service, /body: createSignatureFormData\(signature\)/);
  assert.match(receiptModal, /setRefreshVersion\(\(current\) => current \+ 1\)/);
});
