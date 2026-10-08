import { test, expect } from '@playwright/test';

async function preparar(page, overrides = {}, role = 'GERENTE', conflict = false) {
  let requisicao = {
    id: 42, origem: 'MANUAL', tipo: 'RETIRADA', status: 'PENDENTE', versao: 0,
    criadaEm: '2026-10-07T10:00:00', observacao: 'Levar materiais para obra A',
    gerenteSolicitante: { id: 1, nome: 'Gerente Ana' },
    encarregadoDestinatario: { id: 2, nome: 'Encarregado João' },
    contrato: { id: 3, nome: 'Obra A' }, podeAlterar: true, podeMarcarVisualizada: false,
    itens: [{ id: 4, descricao: 'Capacete M', quantidade: 5 }, { id: 5, descricao: 'Luva M', quantidade: 10 }],
    ...overrides,
  };
  const requests = [];
  await page.addInitScript((auth) => localStorage.setItem('controle-materiais-auth', JSON.stringify(auth)), {
    token: `${role}-token`, role, username: 'ana', expiresAt: Date.now() + 3600000,
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    if (request.method() !== 'GET') requests.push({ path, method: request.method(), body: request.postDataJSON() });
    if (path === '/requisicoes' && request.method() === 'GET') return route.fulfill({ json: [requisicao] });
    if (path === '/requisicoes/42' && request.method() === 'GET') return route.fulfill({ json: requisicao });
    if (path === '/requisicoes/42/visualizar') {
      requisicao = { ...requisicao, status: 'VISUALIZADA', versao: 1, podeAlterar: false,
        podeMarcarVisualizada: false, visualizadaEm: '2026-10-07T11:00:00' };
      return route.fulfill({ json: requisicao });
    }
    if (path === '/requisicoes/42' && request.method() === 'PATCH') {
      if (conflict) {
        requisicao = { ...requisicao, status: 'VISUALIZADA', versao: 1, podeAlterar: false };
        return route.fulfill({ status: 409, json: { erro: 'A requisição não pode mais ser alterada porque já foi visualizada pelo destinatário.' } });
      }
      const body = request.postDataJSON();
      requisicao = { ...requisicao, versao: 1, observacao: body.observacao,
        itens: requisicao.itens.filter((item) => !body.itensRemovidos.includes(item.id))
          .map((item) => ({ ...item, ...(body.itensAlterados[item.id] ?? {}) }))
          .concat(body.novosItens.map((item, index) => ({ ...item, id: 6 + index }))),
      };
      return route.fulfill({ json: requisicao });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/requisicoes/42');
  return requests;
}

test('Alterar abre formulário preenchido e adicionar item preserva os anteriores', async ({ page }) => {
  const requests = await preparar(page);
  await page.getByRole('button', { name: 'Alterar', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Observação' })).toHaveValue('Levar materiais para obra A');
  await expect(page.getByRole('textbox', { name: 'Descrição do item 1' })).toHaveValue('Capacete M');
  await expect(page.getByRole('spinbutton', { name: 'Quantidade do item 1' })).toHaveValue('5');
  await expect(page.getByRole('textbox', { name: 'Descrição do item 2' })).toHaveValue('Luva M');
  await expect(page.getByRole('spinbutton', { name: 'Quantidade do item 2' })).toHaveValue('10');
  await page.getByRole('button', { name: '+ Adicionar item', exact: true }).click();
  await page.getByRole('textbox', { name: 'Descrição do item 3' }).fill('Bota 42');
  await page.getByRole('spinbutton', { name: 'Quantidade do item 3' }).fill('2');
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(page.getByText('Requisição atualizada com sucesso.', { exact: true })).toBeVisible();
  await expect(page.getByText('Capacete M x5', { exact: true })).toBeVisible();
  await expect(page.getByText('Luva M x10', { exact: true })).toBeVisible();
  await expect(page.getByText('Bota 42 x2', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/requisicoes\/42$/);
  expect(requests).toEqual([{ path: '/requisicoes/42', method: 'PATCH', body: {
    versao: 0, observacao: 'Levar materiais para obra A', itensAlterados: {}, itensRemovidos: [],
    novosItens: [{ descricao: 'Bota 42', quantidade: 2 }],
  } }]);
});

test('alterar e remover itens envia somente as mudanças explícitas', async ({ page }) => {
  const requests = await preparar(page);
  await page.getByRole('button', { name: 'Alterar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Descrição do item 1' }).fill('Capacete G');
  await page.getByRole('spinbutton', { name: 'Quantidade do item 1' }).fill('8');
  await page.getByRole('button', { name: 'Remover item 2', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(page.getByText('Capacete G x8', { exact: true })).toBeVisible();
  await expect(page.getByText('Luva M x10', { exact: true })).toHaveCount(0);
  expect(requests[0].body).toEqual({ versao: 0, observacao: 'Levar materiais para obra A',
    itensAlterados: { 4: { descricao: 'Capacete G', quantidade: 8 } }, itensRemovidos: [5], novosItens: [] });
});

test('cancelar edição descarta rascunho sem cancelar requisição nem chamar API', async ({ page }) => {
  const requests = await preparar(page);
  await page.getByRole('button', { name: 'Alterar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Observação' }).fill('Rascunho');
  await page.getByRole('button', { name: 'Cancelar edição', exact: true }).click();
  await expect(page.getByText('Levar materiais para obra A', { exact: true })).toBeVisible();
  await expect(page.getByText('Pendente', { exact: true })).toBeVisible();
  expect(requests).toEqual([]);
  await page.getByRole('button', { name: 'Alterar', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Observação' })).toHaveValue('Levar materiais para obra A');
});

test('não permite salvar sem itens', async ({ page }) => {
  const requests = await preparar(page);
  await page.getByRole('button', { name: 'Alterar', exact: true }).click();
  await page.getByRole('button', { name: 'Remover item 2', exact: true }).click();
  await page.getByRole('button', { name: 'Remover item 1', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ao menos um item');
  expect(requests).toEqual([]);
});

test('409 durante edição mantém motivo visível, atualiza estado e fecha formulário', async ({ page }) => {
  await preparar(page, {}, 'GERENTE', true);
  await page.getByRole('button', { name: 'Alterar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Observação' }).fill('Não salvar');
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('já foi visualizada pelo destinatário');
  await expect(page.getByText('Visualizada', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar alterações', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Alterar', exact: true })).toHaveCount(0);
  await expect(page.getByText('Levar materiais para obra A', { exact: true })).toBeVisible();
  await expect(page.getByText('Requisição atualizada com sucesso.', { exact: true })).toHaveCount(0);
});

for (const status of ['VISUALIZADA', 'CONCLUIDA', 'CANCELADA']) {
  test(`${status} não apresenta Alterar nem envia visualizar`, async ({ page }) => {
    const requests = await preparar(page, { status, podeAlterar: false });
    await expect(page.getByRole('heading', { name: 'Retirada', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alterar', exact: true })).toHaveCount(0);
    expect(requests).toEqual([]);
  });
}

for (const role of ['ADMIN', 'OPERADOR', 'ENCARREGADO']) {
  test(`${role} não apresenta Alterar`, async ({ page }) => {
    await preparar(page, { podeAlterar: false }, role);
    await expect(page.getByRole('heading', { name: 'Retirada', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alterar', exact: true })).toHaveCount(0);
  });
}

for (const caso of [{ podeAlterar: false }, { origem: 'FALTA_ESTOQUE' }, { tipo: 'DEVOLUCAO' }]) {
  test(`contexto ${JSON.stringify(caso)} não permite edição`, async ({ page }) => {
    await preparar(page, caso);
    await expect(page.locator('.requisicao-detail')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alterar', exact: true })).toHaveCount(0);
  });
}

test('destinatário abre pendente e a tela reflete VISUALIZADA imediatamente', async ({ page }) => {
  const requests = await preparar(page, { podeAlterar: false, podeMarcarVisualizada: true }, 'ENCARREGADO');
  await expect(page.getByText('Visualizada', { exact: true })).toBeVisible();
  expect(requests.filter((request) => request.path.endsWith('/visualizar'))).toHaveLength(1);
  await page.reload();
  await expect(page.getByText('Visualizada', { exact: true })).toBeVisible();
  expect(requests.filter((request) => request.path.endsWith('/visualizar'))).toHaveLength(1);
});

test('gerente destinatário de falta de estoque mantém regra de visualização', async ({ page }) => {
  const requests = await preparar(page, { origem: 'FALTA_ESTOQUE', podeAlterar: false, podeMarcarVisualizada: true,
    gerenteDestinatario: { id: 1, nome: 'Gerente Ana' }, operadorRegistrador: { id: 7, nome: 'Operador' },
    encarregadoNecessidade: { id: 2, nome: 'João' } });
  await expect(page.getByText('Visualizada', { exact: true })).toBeVisible();
  expect(requests.filter((request) => request.path.endsWith('/visualizar'))).toHaveLength(1);
});
