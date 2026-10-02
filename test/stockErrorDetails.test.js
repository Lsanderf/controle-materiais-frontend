import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/services/apiErrors.js';

test('erro de estoque preserva somente os detalhes publicos necessarios para orientar a retirada', () => {
  const error = new ApiError('Estoque insuficiente para preparar a retirada', 409, {
    status: 409,
    erro: 'Estoque insuficiente para preparar a retirada',
    codigo: 'ESTOQUE_INSUFICIENTE',
    itens: [{
      materialId: 7,
      material: 'Capacete M',
      disponivel: 2,
      solicitado: 5,
      faltante: 3,
      caminhoFisico: 'C:\\privado\\assinatura.png',
    }],
    trace: 'java.lang.IllegalStateException\n at private.Service:42',
  });

  assert.equal(error.details.codigo, 'ESTOQUE_INSUFICIENTE');
  assert.deepEqual(error.details.itens, [{
    materialId: 7,
    material: 'Capacete M',
    disponivel: 2,
    solicitado: 5,
    faltante: 3,
  }]);
  assert.equal(error.details.trace, undefined);
  assert.doesNotMatch(JSON.stringify(error.details), /caminhoFisico|privado|IllegalStateException/);
});
