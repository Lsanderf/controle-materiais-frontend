import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';

const ENCARREGADOS = [
  { id: 8, nome: 'Encarregada Ana', username: 'ana', ativo: true },
  { id: 9, nome: 'Encarregado Bruno', username: 'bruno', ativo: true },
];
const CONTRATO = { id: 3, nome: 'Contrato Central', descricao: 'Obra central', ativo: true };
const MATERIAIS = [
  { id: 1, nome: 'Capacete M', descricao: 'EPI', quantidadeEstoque: 10 },
  { id: 2, nome: 'Luva isolante', descricao: 'EPI', quantidadeEstoque: 7 },
];
const RECORDED_AT = '2026-10-01T10:30:00';

function roleFrom(request) {
  return request.headers().authorization?.replace('Bearer ', '').split(':')[0];
}

function usernameFrom(request) {
  return request.headers().authorization?.replace('Bearer ', '').split(':')[1];
}

function forbidden(route) {
  return route.fulfill({ status: 403, json: { erro: 'Usuário autenticado sem permissão' } });
}

function stockError(route, material, solicitado) {
  const disponivel = material.quantidadeEstoque;
  return route.fulfill({
    status: 409,
    json: {
      status: 409,
      erro: 'Estoque insuficiente para concluir a retirada',
      codigo: 'ESTOQUE_INSUFICIENTE',
      itens: [{
        materialId: material.id,
        material: material.nome,
        disponivel,
        solicitado,
        faltante: solicitado - disponivel,
      }],
    },
  });
}

function requestRecord(api, body, id = api.nextRequestId++) {
  const encarregado = ENCARREGADOS.find((item) => item.id === body.encarregadoAssinanteId);
  return {
    id,
    operadorResponsavel: { id: 7, nome: 'Operador Carlos', username: 'operador' },
    encarregadoAssinante: { id: encarregado.id, nome: encarregado.nome },
    contrato: { id: CONTRATO.id, nome: CONTRATO.nome },
    status: 'AGUARDANDO_ASSINATURA',
    observacao: body.observacao ?? null,
    criadaEm: RECORDED_AT,
    confirmadaEm: null,
    itens: body.itens.map((item, index) => ({
      id: index + 1,
      materialId: item.materialId,
      material: MATERIAIS.find((material) => material.id === item.materialId).nome,
      quantidade: item.quantidade,
    })),
  };
}

async function setup(page) {
  const api = {
    nextRequestId: 1,
    nextMovementId: 41,
    requests: [],
    movements: [],
    signatures: new Map(),
    downloads: [],
    writes: [],
    confirmAttempts: 0,
    confirmStockFailure: false,
    stock: new Map(MATERIAIS.map((material) => [material.id, material.quantidadeEstoque])),
  };
  api.seedRequest = (body = {
    encarregadoAssinanteId: 8,
    contratoId: CONTRATO.id,
    itens: [{ materialId: 1, quantidade: 3 }],
  }) => {
    const created = requestRecord(api, body);
    api.requests.push(created);
    return created;
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.replace('/api', '');
    const role = roleFrom(request);
    const username = usernameFrom(request);
    if (method !== 'GET') api.writes.push(`${method} ${path}`);

    if (path === '/materiais' && method === 'GET') {
      return route.fulfill({ json: MATERIAIS.map((material) => ({
        ...material,
        quantidadeEstoque: api.stock.get(material.id),
      })) });
    }
    if (path === '/usuarios/encarregados' && method === 'GET') {
      return route.fulfill({ json: ENCARREGADOS });
    }
    if (path === '/usuarios/gerentes' && method === 'GET') {
      return route.fulfill({ json: [{ id: 10, nome: 'Gerente Gabi', ativo: true }] });
    }
    if (path === '/contratos' && method === 'GET') return route.fulfill({ json: [CONTRATO] });

    if (path === '/solicitacoes-retirada' && method === 'POST') {
      if (!['ADMIN', 'OPERADOR'].includes(role)) return forbidden(route);
      const body = JSON.parse(request.postData());
      for (const item of body.itens) {
        const material = {
          ...MATERIAIS.find((record) => record.id === item.materialId),
          quantidadeEstoque: api.stock.get(item.materialId),
        };
        if (item.quantidade > material.quantidadeEstoque) {
          return stockError(route, material, item.quantidade);
        }
      }
      const created = requestRecord(api, body);
      api.requests.push(created);
      return route.fulfill({ status: 201, json: created });
    }

    if (path === '/solicitacoes-retirada' && method === 'GET') {
      if (!['ADMIN', 'OPERADOR', 'ENCARREGADO'].includes(role)) return forbidden(route);
      const visible = api.requests.filter((item) => role === 'ADMIN'
        || (role === 'OPERADOR' && username === item.operadorResponsavel.username)
        || (role === 'ENCARREGADO'
          && ENCARREGADOS.find((record) => record.id === item.encarregadoAssinante.id)?.username === username));
      return route.fulfill({ json: visible });
    }

    const detailMatch = path.match(/^\/solicitacoes-retirada\/(\d+)$/);
    if (detailMatch && method === 'GET') {
      const item = api.requests.find((record) => record.id === Number(detailMatch[1]));
      if (!item) return route.fulfill({ status: 404, json: { erro: 'Solicitação não encontrada' } });
      const assignedUsername = ENCARREGADOS.find((record) => record.id === item.encarregadoAssinante.id)?.username;
      const canRead = role === 'ADMIN'
        || (role === 'OPERADOR' && username === item.operadorResponsavel.username)
        || (role === 'ENCARREGADO' && username === assignedUsername);
      return canRead ? route.fulfill({ json: item }) : forbidden(route);
    }

    const cancelMatch = path.match(/^\/solicitacoes-retirada\/(\d+)\/cancelar$/);
    if (cancelMatch && method === 'PATCH') {
      const item = api.requests.find((record) => record.id === Number(cancelMatch[1]));
      if (!item || (role !== 'ADMIN' && !(role === 'OPERADOR' && username === item.operadorResponsavel.username))) {
        return forbidden(route);
      }
      item.status = 'CANCELADA';
      item.canceladaEm = RECORDED_AT;
      return route.fulfill({ json: item });
    }

    const confirmMatch = path.match(/^\/solicitacoes-retirada\/(\d+)\/confirmar$/);
    if (confirmMatch && method === 'POST') {
      api.confirmAttempts += 1;
      const item = api.requests.find((record) => record.id === Number(confirmMatch[1]));
      const assignedUsername = ENCARREGADOS.find((record) => record.id === item?.encarregadoAssinante.id)?.username;
      if (!item || role !== 'ENCARREGADO' || username !== assignedUsername) return forbidden(route);
      if (item.status === 'CONFIRMADA') return route.fulfill({ json: item });
      if (api.confirmStockFailure) {
        const first = item.itens[0];
        return stockError(route, {
          id: first.materialId,
          nome: first.material,
          quantidadeEstoque: api.stock.get(first.materialId),
        }, first.quantidade);
      }

      const parts = await new Response(request.postDataBuffer(), {
        headers: { 'Content-Type': request.headers()['content-type'] },
      }).formData();
      const signature = parts.get('assinatura');
      const signatureBytes = Buffer.from(await signature.arrayBuffer());
      item.status = 'CONFIRMADA';
      item.confirmadaEm = RECORDED_AT;
      for (const requestItem of item.itens) {
        api.stock.set(requestItem.materialId, api.stock.get(requestItem.materialId) - requestItem.quantidade);
        const movementId = api.nextMovementId++;
        const signatureUrl = `/movimentacoes/${movementId}/assinatura-retirada/arquivo`;
        const movement = {
          id: movementId,
          tipo: 'RETIRADA',
          quantidade: requestItem.quantidade,
          dataMovimentacao: RECORDED_AT,
          material: requestItem.material,
          contrato: item.contrato.nome,
          encarregado: item.encarregadoAssinante.nome,
          usuarioUsername: 'operador',
          solicitacaoRetiradaId: item.id,
          receipt: {
            id: movementId,
            tipo: 'RETIRADA',
            quantidade: requestItem.quantidade,
            dataMovimentacao: RECORDED_AT,
            material: { id: requestItem.materialId, nome: requestItem.material },
            contrato: item.contrato,
            registradoPor: { id: 7, username: 'operador' },
            solicitacaoRetiradaId: item.id,
            operadorResponsavel: item.operadorResponsavel,
            encarregadoAssinante: item.encarregadoAssinante,
            assinaturaRetirada: {
              encarregadoAssinante: item.encarregadoAssinante,
              dataAssinatura: RECORDED_AT,
              contentType: signature.type,
              tamanhoBytes: signatureBytes.length,
              sha256: createHash('sha256').update(signatureBytes).digest('hex'),
              urlArquivo: signatureUrl,
            },
            evidencias: [],
            geradoEm: RECORDED_AT,
            versao: 1,
          },
        };
        api.movements.push(movement);
        api.signatures.set(signatureUrl, { body: signatureBytes, contentType: signature.type });
      }
      api.sentSignature = signatureBytes;
      return route.fulfill({ json: item });
    }

    const receiptMatch = path.match(/^\/movimentacoes\/(\d+)\/comprovante$/);
    if (receiptMatch && method === 'GET') {
      const movement = api.movements.find((item) => item.id === Number(receiptMatch[1]));
      return movement ? route.fulfill({ json: movement.receipt }) : route.fulfill({ status: 404, json: { erro: 'Comprovante não encontrado' } });
    }
    if (api.signatures.has(path) && method === 'GET') {
      const stored = api.signatures.get(path);
      api.downloads.push(Buffer.from(stored.body));
      return route.fulfill({ body: stored.body, contentType: stored.contentType, headers: { 'Cache-Control': 'no-store' } });
    }
    if (path === '/movimentacoes' && method === 'GET') {
      return route.fulfill({ json: api.movements.map(({ receipt: _receipt, ...movement }) => movement) });
    }
    if (path.startsWith('/movimentacoes/encarregado/') && method === 'GET') {
      return route.fulfill({ json: api.movements });
    }
    return route.fulfill({ json: [] });
  });
  return api;
}

async function authenticate(page, role, username) {
  await page.goto('/login');
  await page.evaluate((auth) => {
    localStorage.setItem('controle-materiais-auth', JSON.stringify(auth));
  }, {
    token: `${role}:${username}`,
    role,
    username,
    expiresAt: Date.now() + 3_600_000,
  });
}

async function prepareWithdrawal(page, { twoItems = false, quantity = '3' } = {}) {
  await page.goto('/movimentacoes/retirada');
  await page.getByRole('combobox', { name: 'Encarregado assinante' }).selectOption('8');
  await page.getByRole('combobox', { name: 'Contrato', exact: true }).selectOption('3');
  await page.getByRole('combobox', { name: 'Material', exact: true }).first().selectOption('1');
  await page.getByLabel(/^Quantidade/).first().fill(quantity);
  if (twoItems) {
    await page.getByRole('button', { name: '+ Adicionar material', exact: true }).click();
    await page.locator('.requisicao-item-row').nth(1).getByRole('combobox').selectOption('2');
    await page.getByLabel(/^Quantidade/).nth(1).fill('2');
  }
  await page.getByRole('button', { name: 'Enviar para assinatura', exact: true }).click();
}

async function drawSignature(page) {
  const dialog = page.getByRole('dialog', { name: 'Assinatura do responsável' });
  const canvas = dialog.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 25, box.y + 55);
  await page.mouse.down();
  await page.mouse.move(box.x + 95, box.y + 20, { steps: 6 });
  await page.mouse.move(box.x + 155, box.y + 65, { steps: 6 });
  await page.mouse.up();
  return dialog;
}

test('OPERADOR prepara retirada com vários materiais sem apresentar baixa antes da assinatura', async ({ page }) => {
  const api = await setup(page);
  await authenticate(page, 'OPERADOR', 'operador');
  await prepareWithdrawal(page, { twoItems: true });

  await expect(page.getByText(/Solicitação enviada ao encarregado para assinatura/)).toBeVisible();
  expect(api.requests).toHaveLength(1);
  expect(api.requests[0].itens).toEqual([
    expect.objectContaining({ materialId: 1, quantidade: 3 }),
    expect.objectContaining({ materialId: 2, quantidade: 2 }),
  ]);
  expect(api.stock.get(1)).toBe(10);
  expect(api.stock.get(2)).toBe(7);
  expect(api.movements).toEqual([]);
  await expect(page.getByText(/estoque será baixado somente na confirmação/i)).toBeVisible();
});

test('ENCARREGADO destinatário confirma uma vez e o comprovante devolve exatamente a assinatura enviada', async ({ page }) => {
  const api = await setup(page);
  await authenticate(page, 'OPERADOR', 'operador');
  await prepareWithdrawal(page);
  expect(api.stock.get(1)).toBe(10);

  await authenticate(page, 'ENCARREGADO', 'ana');
  await page.goto('/solicitacoes-retirada');
  await page.getByRole('link', { name: /Retirada #1/ }).click();
  for (const text of ['Operador Carlos', 'Encarregada Ana', CONTRATO.nome, 'Capacete M', '3 un.']) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Assinar e confirmar', exact: true }).click();
  const dialog = await drawSignature(page);
  await dialog.getByRole('button', { name: 'Confirmar retirada', exact: true }).evaluate((button) => {
    button.click();
    button.click();
  });
  await expect(page.getByText('Retirada confirmada com sucesso.', { exact: true })).toBeVisible();
  expect(api.confirmAttempts).toBe(1);
  expect(api.movements).toHaveLength(1);
  expect(api.stock.get(1)).toBe(7);

  await authenticate(page, 'OPERADOR', 'operador');
  await page.goto('/movimentacoes/historico');
  await page.getByRole('button', { name: 'Ver comprovante', exact: true }).click();
  const receipt = page.getByRole('dialog', { name: 'Comprovante de movimentação' });
  await expect(receipt.getByText('Operador Carlos', { exact: true })).toBeVisible();
  await expect(receipt.getByText('Encarregada Ana', { exact: true })).toHaveCount(2);
  await expect(receipt.getByRole('img', { name: 'Assinatura de Encarregada Ana', exact: true })).toBeVisible();
  expect(api.downloads.length).toBeGreaterThan(0);
  for (const downloadedSignature of api.downloads) expect(downloadedSignature).toEqual(api.sentSignature);
  expect(api.signatures.values().next().value.body).toEqual(api.sentSignature);
});

test('ENCARREGADO não consegue confirmar solicitação pendente sem desenhar assinatura', async ({ page }) => {
  const api = await setup(page);
  api.seedRequest();
  await authenticate(page, 'ENCARREGADO', 'ana');
  await page.goto('/solicitacoes-retirada/1');
  await page.getByRole('button', { name: 'Assinar e confirmar', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Assinatura do responsável' });
  await expect(dialog.getByRole('button', { name: 'Confirmar retirada', exact: true })).toBeDisabled();
  expect(api.confirmAttempts).toBe(0);
  expect(api.requests[0].status).toBe('AGUARDANDO_ASSINATURA');
  expect(api.movements).toEqual([]);
});

test('outro ENCARREGADO não lista nem confirma solicitação alheia', async ({ page }) => {
  const api = await setup(page);
  api.seedRequest();
  await authenticate(page, 'ENCARREGADO', 'bruno');
  await page.goto('/solicitacoes-retirada');
  await expect(page.getByText('Nenhuma solicitação de retirada encontrada.', { exact: true })).toBeVisible();
  await page.goto('/solicitacoes-retirada/1');
  await expect(page.getByRole('alert')).toContainText('Usuário autenticado sem permissão');
  await expect(page.getByRole('button', { name: 'Assinar e confirmar', exact: true })).toHaveCount(0);
  expect(api.confirmAttempts).toBe(0);
});

test('roles atuais bloqueiam criação e confirmação indevidas', async ({ page }) => {
  const api = await setup(page);
  api.seedRequest();

  await authenticate(page, 'GERENTE', 'gerente');
  for (const path of ['/movimentacoes/retirada', '/movimentacoes/devolucao', '/solicitacoes-retirada/1']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard$/);
  }

  await authenticate(page, 'ENCARREGADO', 'ana');
  for (const path of ['/movimentacoes/retirada', '/movimentacoes/devolucao']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard$/);
  }

  await authenticate(page, 'OPERADOR', 'operador');
  await page.goto('/movimentacoes/retirada');
  await expect(page.getByRole('heading', { name: 'Preparar retirada', exact: true })).toBeVisible();
  await page.goto('/movimentacoes/devolucao');
  await expect(page.getByRole('heading', { name: 'Registrar devolução', exact: true })).toBeVisible();
  await page.goto('/solicitacoes-retirada/1');
  await expect(page.getByRole('button', { name: 'Assinar e confirmar', exact: true })).toHaveCount(0);
  expect(api.confirmAttempts).toBe(0);
  expect(api.writes).toEqual([]);
});

test('estoque insuficiente na preparação orienta o OPERADOR e não cria solicitação', async ({ page }) => {
  const api = await setup(page);
  api.stock.set(1, 1);
  await authenticate(page, 'OPERADOR', 'operador');
  await prepareWithdrawal(page, { quantity: '3' });

  await expect(page.getByText('Estoque insuficiente.', { exact: true })).toBeVisible();
  await expect(page.getByText('Capacete M: disponível 1, solicitado 3, faltante 2.', { exact: true })).toBeVisible();
  expect(api.requests).toEqual([]);
  expect(api.movements).toEqual([]);
  expect(api.stock.get(1)).toBe(1);
});

test('estoque insuficiente na confirmação mantém a solicitação pendente e não cria retirada', async ({ page }) => {
  const api = await setup(page);
  await authenticate(page, 'OPERADOR', 'operador');
  await prepareWithdrawal(page);
  api.stock.set(1, 0);
  api.confirmStockFailure = true;

  await authenticate(page, 'ENCARREGADO', 'ana');
  await page.goto('/solicitacoes-retirada/1');
  await page.getByRole('button', { name: 'Assinar e confirmar', exact: true }).click();
  const dialog = await drawSignature(page);
  await dialog.getByRole('button', { name: 'Confirmar retirada', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Estoque insuficiente para concluir a retirada');
  await expect(page.getByText('Retirada confirmada com sucesso.', { exact: true })).toHaveCount(0);
  expect(api.requests[0].status).toBe('AGUARDANDO_ASSINATURA');
  expect(api.movements).toEqual([]);
  expect(api.stock.get(1)).toBe(0);
});

test('cancelamento de solicitação pendente não cria movimentação nem estorno', async ({ page }) => {
  const api = await setup(page);
  await authenticate(page, 'OPERADOR', 'operador');
  await prepareWithdrawal(page);
  await page.goto('/solicitacoes-retirada/1');
  await page.getByRole('button', { name: 'Cancelar solicitação', exact: true }).click();

  await expect(page.getByText('Solicitação cancelada.', { exact: true })).toBeVisible();
  expect(api.requests[0].status).toBe('CANCELADA');
  expect(api.movements).toEqual([]);
  expect(api.stock.get(1)).toBe(10);
  expect(api.writes).toContain('PATCH /solicitacoes-retirada/1/cancelar');
  expect(api.writes.some((path) => path.includes('/estorno'))).toBe(false);
});
