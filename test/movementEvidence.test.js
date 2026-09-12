import test from 'node:test';
import assert from 'node:assert/strict';
import { createMovementFormData } from '../src/utils/movementEvidence.js';

const signature = new Blob(['signature'], { type: 'image/png' });
const movement = { tipo: 'RETIRADA', funcionarioId: 1, contratoId: 2, materialId: 3, quantidade: 4 };

test('movimentação e assinatura são enviadas juntas como multipart', async () => {
  const data = createMovementFormData(movement, signature);
  assert.deepEqual([...data.keys()], ['movimentacao', 'assinatura']);
  assert.equal(data.get('movimentacao').type, 'application/json');
  assert.deepEqual(JSON.parse(await data.get('movimentacao').text()), movement);
  assert.equal(data.get('assinatura').type, 'image/png');
  assert.equal(data.get('assinatura').name, 'assinatura.png');
});

test('retirada e devolução sem assinatura não montam requisição', () => {
  for (const tipo of ['RETIRADA', 'DEVOLUCAO']) {
    assert.throws(() => createMovementFormData({ ...movement, tipo }), /assinatura/);
    assert.throws(() => createMovementFormData({ ...movement, tipo }, new Blob([])), /assinatura/);
  }
});

test('foto opcional só pode ser enviada na devolução e mantém arquivo original', () => {
  const photo = new File(['photo'], 'material.jpg', { type: 'image/jpeg' });
  const data = createMovementFormData({ ...movement, tipo: 'DEVOLUCAO' }, signature, photo);
  assert.equal(data.get('foto').name, 'material.jpg');
  assert.equal(data.get('foto').type, 'image/jpeg');
  assert.equal(createMovementFormData({ ...movement, tipo: 'DEVOLUCAO' }, signature).has('foto'), false);
  assert.throws(() => createMovementFormData(movement, signature, photo), /apenas na devolução/);
});

test('entrada continua exclusivamente pela nota fiscal', () => {
  assert.throws(() => createMovementFormData({ ...movement, tipo: 'ENTRADA' }, signature), /nota fiscal/);
});
