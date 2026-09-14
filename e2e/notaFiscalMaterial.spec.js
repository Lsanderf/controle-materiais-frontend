import { test, expect } from '@playwright/test';

const ACCESS_KEY = '52060433009911002506550120000007800267301615';
const EXISTING_MATERIAL = {
  id: 7, nome: 'Material existente', descricao: 'Descrição existente', quantidadeEstoque: 8,
};
const INVOICE = {
  numero: '12345', serie: '1', chaveAcesso: ACCESS_KEY,
  fornecedor: 'Fornecedor da NF', cnpjFornecedor: '11222333000181', dataEmissao: '2026-09-10',
};
const XML_RESULT = {
  ...INVOICE,
  itens: [
    {
      numeroItem: 1, codigoProduto: 'CAB-01', descricaoProduto: 'CABO OPTICO DROP 1FO',
      quantidadeComercial: '120', unidadeComercial: 'M', valorUnitarioComercial: '2.5', valorTotal: '300',
    },
    {
      numeroItem: 2, codigoProduto: 'CONEC-02', descricaoProduto: 'CONECTOR OPTICO',
      quantidadeComercial: '15', unidadeComercial: 'UN', valorUnitarioComercial: '3', valorTotal: '45',
    },
  ],
};

async function setup(page, options = {}) {
  const api = {
    calls: [],
    materials: structuredClone(options.materials ?? [EXISTING_MATERIAL]),
    draft: options.draft,
    materialError: null,
    materialGate: null,
  };
  await page.addInitScript((role) => {
    localStorage.setItem('controle-materiais-auth', JSON.stringify({
      token: 'test-token', role, username: 'teste', expiresAt: Date.now() + 3600000,
    }));
  }, options.role ?? 'ADMIN');
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    const method = request.method();
    const body = request.headers()['content-type']?.includes('application/json')
      ? request.postDataJSON() : request.postData();
    api.calls.push({ path, method, body, authorization: request.headers().authorization });
    const respond = (json, status = 200) => route.fulfill({ json, status });

    if (path === '/materiais' && method === 'GET') return respond(api.materials);
    if (path === '/materiais' && method === 'POST') {
      if (api.materialGate) await api.materialGate;
      if (api.materialError) return respond(api.materialError, 409);
      const material = { ...body, id: 100 + api.materials.length, quantidadeEstoque: 0 };
      api.materials.push(material);
      return respond(material, 201);
    }
    if (path.startsWith('/materiais/') && method === 'GET') {
      return respond(api.materials.find((material) => String(material.id) === path.split('/').at(-1)));
    }
    if (path.startsWith('/materiais/') && method === 'PUT') {
      const material = api.materials.find((entry) => String(entry.id) === path.split('/').at(-1));
      Object.assign(material, body);
      return respond(material);
    }
    if (path === '/notas-fiscais/importar-xml') return respond(XML_RESULT);
    if ((path === '/notas-fiscais' && method === 'POST') || (path === '/notas-fiscais/900' && method === 'PUT')) {
      api.draft = { ...body, id: 900, status: 'RASCUNHO', movimentacoes: [] };
      return respond(api.draft, method === 'POST' ? 201 : 200);
    }
    if (path === '/notas-fiscais/900') return respond({
      ...api.draft,
      itens: api.draft.itens.map((item, index) => ({ ...item, id: index + 1 })),
    });
    return respond([]);
  });
  return api;
}

const rows = (page) => page.locator('.invoice-item-row');
const createButton = (page, index = 0) => rows(page).nth(index).getByRole('button', { name: '+ Criar material', exact: true });
const dialog = (page) => page.getByRole('dialog', { name: 'Novo material' });
const writes = (api) => api.calls.filter((call) => call.method !== 'GET');
const materialPosts = (api) => api.calls.filter((call) => call.path === '/materiais' && call.method === 'POST');

async function fillInvoice(page) {
  await page.getByLabel('Numero', { exact: true }).fill(INVOICE.numero);
  await page.getByLabel('Serie', { exact: true }).fill(INVOICE.serie);
  await page.getByLabel('Chave de acesso', { exact: true }).fill(ACCESS_KEY);
  await page.getByLabel('Fornecedor', { exact: true }).fill(INVOICE.fornecedor);
  await page.getByLabel('CNPJ do fornecedor').fill(INVOICE.cnpjFornecedor);
  await page.getByLabel('Data de emissao').fill(INVOICE.dataEmissao);
  await rows(page).first().getByLabel('Quantidade', { exact: true }).fill('12');
  await rows(page).first().getByLabel('Valor unitario').fill('9.50');
}

async function snapshot(page) {
  return page.locator('.page-stack > form').evaluate((form) => ({
    values: [...form.querySelectorAll('input, select, textarea')].map((input) => input.value),
    imported: [...form.querySelectorAll('.invoice-imported-product')].map((product) => product.textContent),
  }));
}

async function importXml(page) {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'nota.xml', mimeType: 'application/xml', buffer: Buffer.from('<NFe/>'),
  });
  await expect(rows(page)).toHaveCount(2);
  await expect(page.getByText('XML lido com sucesso.', { exact: false })).toBeVisible();
}

async function createMaterial(page, index, nome, descricao = 'Material cadastrado pela NF') {
  await createButton(page, index).click();
  await dialog(page).getByLabel('Nome', { exact: true }).fill(nome);
  await dialog(page).getByLabel('Descrição', { exact: true }).fill(descricao);
  await dialog(page).getByRole('button', { name: 'Cadastrar material' }).click();
  await expect(dialog(page)).toHaveCount(0);
}

test('abrir, cancelar e usar Escape preserva dados, associações, DOM e rota da NF', async ({ page }) => {
  const api = await setup(page);
  await page.goto('/notas-fiscais/nova');
  await fillInvoice(page);
  await rows(page).first().getByRole('combobox').selectOption('7');
  await page.getByRole('button', { name: '+ Adicionar item' }).click();
  const before = await snapshot(page);
  await page.locator('.page-stack > form').evaluate((form) => { window.invoiceFormBefore = form; });
  await createButton(page, 1).click();
  await expect(dialog(page)).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
  await dialog(page).getByLabel('Nome', { exact: true }).fill('Rascunho cancelado');
  await dialog(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(createButton(page, 1)).toBeFocused();
  await createButton(page, 1).click();
  await expect(dialog(page).getByLabel('Nome', { exact: true })).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  expect(await snapshot(page)).toEqual(before);
  expect(await page.locator('.page-stack > form').evaluate((form) => form === window.invoiceFormBefore)).toBe(true);
  await expect(page).toHaveURL(/\/notas-fiscais\/nova$/);
  expect(writes(api)).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['controle-materiais-auth']);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
});

test('primeiro material pode ser criado com lista vazia e NF manual continua salvando', async ({ page }) => {
  const api = await setup(page, { materials: [] });
  await page.goto('/notas-fiscais/nova');
  await fillInvoice(page);
  await createMaterial(page, 0, '  Cabo manual  ', '  Descrição do cabo  ');
  await expect(rows(page).first().getByRole('combobox')).toHaveValue('100');
  await expect(rows(page).first()).toContainText('Estoque atual: 0 un.');
  await expect(page.getByText('Material criado e associado ao item.', { exact: true })).toBeVisible();
  expect(materialPosts(api)[0]).toMatchObject({
    authorization: 'Bearer test-token', body: { nome: 'Cabo manual', descricao: 'Descrição do cabo' },
  });
  expect(Object.keys(materialPosts(api)[0].body).sort()).toEqual(['descricao', 'nome']);
  expect(writes(api)).toHaveLength(1);
  await page.getByRole('button', { name: 'Criar rascunho', exact: true }).click();
  await expect(page).toHaveURL(/\/notas-fiscais\/900$/);
  expect(api.draft.itens).toEqual([{ materialId: 100, quantidade: 12, valorUnitario: '9.50' }]);
  expect(api.draft.status).toBe('RASCUNHO');
  expect(api.materials[0].quantidadeEstoque).toBe(0);
  expect(writes(api).some((call) => call.path.includes('confirmar') || call.path.includes('movimentacoes'))).toBe(false);
});

test('dois produtos XML criam materiais distintos, sem levar quantidade ao cadastro', async ({ page }) => {
  const api = await setup(page);
  await page.goto('/notas-fiscais/nova');
  await importXml(page);
  const initialMaterialLoads = api.calls.filter((call) => call.path === '/materiais' && call.method === 'GET').length;
  await expect(page.getByRole('button', { name: 'Criar rascunho' })).toBeDisabled();
  const before = await snapshot(page);
  await createButton(page, 1).click();
  await expect(dialog(page).getByLabel('Nome', { exact: true })).toHaveValue('CONECTOR OPTICO');
  await expect(dialog(page).getByLabel('Descrição', { exact: true })).toHaveValue('CONECTOR OPTICO');
  await dialog(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(await snapshot(page)).toEqual(before);
  await createMaterial(page, 1, 'Conector revisado');
  await expect(rows(page).nth(1).getByRole('combobox')).toHaveValue('101');
  await expect(rows(page).nth(0).getByRole('combobox')).toHaveValue('');
  await expect(rows(page).nth(1).locator('.badge')).toHaveText('Material associado');
  await expect(rows(page).nth(0).locator('.badge')).toHaveText('Aguardando associação');
  await createButton(page, 0).click();
  await expect(dialog(page).getByLabel('Nome', { exact: true })).toHaveValue('CABO OPTICO DROP 1FO');
  await expect(dialog(page).getByLabel('Descrição', { exact: true })).toHaveValue('CABO OPTICO DROP 1FO');
  await expect(dialog(page).getByRole('spinbutton')).toHaveCount(0);
  await dialog(page).getByRole('button', { name: 'Cadastrar material' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(rows(page).nth(0).getByRole('combobox')).toHaveValue('102');
  await expect(rows(page).nth(1).getByRole('combobox')).toHaveValue('101');
  for (const row of await rows(page).all()) {
    await expect(row.locator('option[value="101"]')).toHaveCount(1);
    await expect(row.locator('option[value="102"]')).toHaveCount(1);
  }
  expect((await snapshot(page)).values.slice(0, 7)).toEqual(before.values.slice(0, 7));
  expect(materialPosts(api).map((call) => call.body)).toEqual([
    { nome: 'Conector revisado', descricao: 'Material cadastrado pela NF' },
    { nome: 'CABO OPTICO DROP 1FO', descricao: 'CABO OPTICO DROP 1FO' },
  ]);
  expect(api.calls.filter((call) => call.path === '/materiais' && call.method === 'GET')).toHaveLength(initialMaterialLoads);
  await page.getByRole('button', { name: 'Criar rascunho', exact: true }).click();
  await expect(page).toHaveURL(/\/notas-fiscais\/900$/);
  expect(api.draft.itens).toEqual([
    { materialId: 102, quantidade: 120, valorUnitario: '2.5' },
    { materialId: 101, quantidade: 15, valorUnitario: '3' },
  ]);
});

test('erro de duplicidade mantém modal e NF e permite selecionar material existente', async ({ page }) => {
  const api = await setup(page);
  api.materialError = { erro: 'Já existe um material com esse nome', campos: { nome: 'Escolha outro nome.' } };
  await page.goto('/notas-fiscais/nova');
  await importXml(page);
  const before = await snapshot(page);
  await createButton(page, 0).click();
  await dialog(page).getByRole('button', { name: 'Cadastrar material' }).click();
  await expect(dialog(page).getByRole('alert')).toContainText(api.materialError.erro);
  await expect(dialog(page).getByRole('alert')).toContainText('Escolha outro nome.');
  await expect(dialog(page).getByLabel('Nome', { exact: true })).toHaveValue('CABO OPTICO DROP 1FO');
  expect(await snapshot(page)).toEqual(before);
  await dialog(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
  await rows(page).first().getByRole('combobox').selectOption('7');
  await expect(rows(page).first().locator('.badge')).toHaveText('Material associado');
  expect(api.materials).toHaveLength(1);
});

test('erro pode ser corrigido e reenviado sem perder a associação de origem', async ({ page }) => {
  const api = await setup(page);
  api.materialError = { erro: 'Já existe um material com esse nome' };
  await page.goto('/notas-fiscais/nova');
  await importXml(page);
  await createButton(page, 1).click();
  await dialog(page).getByRole('button', { name: 'Cadastrar material' }).click();
  await expect(dialog(page).getByRole('alert')).toBeVisible();
  api.materialError = null;
  await dialog(page).getByLabel('Nome', { exact: true }).fill('Conector novo');
  await dialog(page).getByRole('button', { name: 'Cadastrar material' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(rows(page).nth(1).getByRole('combobox')).toHaveValue('101');
  await expect(rows(page).nth(0).getByRole('combobox')).toHaveValue('');
});

test('requisição em andamento bloqueia cancelamento, Escape e envio repetido', async ({ page }) => {
  const api = await setup(page);
  let finishCreation;
  api.materialGate = new Promise((resolve) => { finishCreation = resolve; });
  await page.goto('/notas-fiscais/nova');
  await importXml(page);
  await createButton(page, 1).click();
  try {
    await dialog(page).getByRole('button', { name: 'Cadastrar material' }).click();
    await expect.poll(() => materialPosts(api).length).toBe(1);
    await expect(dialog(page).getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
    await expect(dialog(page).getByRole('button', { name: 'Salvando...' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Enter');
    expect(materialPosts(api)).toHaveLength(1);
  } finally {
    finishCreation();
  }
  await expect(dialog(page)).toHaveCount(0);
  await expect(rows(page).nth(1).getByRole('combobox')).toHaveValue('101');
});

test('remover um item antes de criar mantém a associação no item restante correto', async ({ page }) => {
  await setup(page);
  await page.goto('/notas-fiscais/nova');
  await importXml(page);
  await rows(page).first().getByRole('button', { name: 'Remover' }).click();
  await createMaterial(page, 0, 'Conector após remoção');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('CONECTOR OPTICO');
  await expect(rows(page).first().getByRole('combobox')).toHaveValue('101');
  await expect(rows(page).first().getByLabel('Quantidade', { exact: true })).toHaveValue('15');
});

test('edição de rascunho preserva alterações ao criar material e salva com PUT', async ({ page }) => {
  const api = await setup(page, { draft: {
    ...INVOICE, id: 900, status: 'RASCUNHO',
    itens: [{ materialId: 7, quantidade: 3, valorUnitario: '2.00' }],
  } });
  await page.goto('/notas-fiscais/900/editar');
  await page.getByLabel('Numero', { exact: true }).fill('Alterado');
  await page.getByRole('button', { name: '+ Adicionar item' }).click();
  await rows(page).nth(1).getByLabel('Quantidade', { exact: true }).fill('2');
  await rows(page).nth(1).getByLabel('Valor unitario').fill('4');
  await createMaterial(page, 1, 'Material da edição');
  await expect(page.getByLabel('Numero', { exact: true })).toHaveValue('Alterado');
  await expect(rows(page).first().getByRole('combobox')).toHaveValue('7');
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await expect(page).toHaveURL(/\/notas-fiscais\/900$/);
  expect(api.calls.find((call) => call.method === 'PUT')?.body.itens).toEqual([
    { materialId: 7, quantidade: 3, valorUnitario: '2.00' },
    { materialId: 101, quantidade: 2, valorUnitario: '4' },
  ]);
});

for (const mode of ['manual', 'XML']) {
  test(`OPERADOR cria material na NF ${mode} e salva a associação`, async ({ page }) => {
    const api = await setup(page, { role: 'OPERADOR', materials: [] });
    await page.goto('/notas-fiscais/nova');
    await expect(page.getByText('Nenhum material cadastrado. Use', { exact: false })).toBeVisible();
    if (mode === 'XML') {
      await importXml(page);
    } else {
      await fillInvoice(page);
    }
    await createMaterial(page, 0, 'Material do operador');
    await expect(rows(page).first().getByRole('combobox')).toHaveValue('100');
    await expect(rows(page).first()).toContainText('Estoque atual: 0 un.');
    if (mode === 'XML') {
      await rows(page).nth(1).getByRole('combobox').selectOption('100');
    }
    await page.getByRole('button', { name: 'Criar rascunho', exact: true }).click();
    await expect(page).toHaveURL(/\/notas-fiscais\/900$/);
    expect(materialPosts(api)).toHaveLength(1);
    expect(materialPosts(api)[0].body).toEqual({
      nome: 'Material do operador', descricao: 'Material cadastrado pela NF',
    });
    expect(api.draft.itens[0]).toMatchObject({ materialId: 100, quantidade: mode === 'XML' ? 120 : 12 });
    expect(api.materials[0].quantidadeEstoque).toBe(0);
    expect(writes(api).map(({ path, method }) => ({ path, method }))).toEqual([
      ...(mode === 'XML' ? [{ path: '/notas-fiscais/importar-xml', method: 'POST' }] : []),
      { path: '/materiais', method: 'POST' },
      { path: '/notas-fiscais', method: 'POST' },
    ]);
  });
}

test('OPERADOR pode cadastrar pela lista de materiais, mas não editar nem o próprio cadastro', async ({ page }) => {
  const api = await setup(page, { role: 'OPERADOR' });
  await page.goto('/materiais');
  await expect(page.getByRole('link', { name: 'Editar', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: '+ Novo material', exact: true }).click();
  await expect(page).toHaveURL(/\/materiais\/novo$/);
  await page.getByLabel('Nome', { exact: true }).fill('Material novo do operador');
  await page.getByLabel('Descrição', { exact: true }).fill('Descrição do novo material');
  await page.getByRole('button', { name: 'Cadastrar material' }).click();
  await expect(page).toHaveURL(/\/materiais$/);
  await expect(page.getByText('Material cadastrado com sucesso.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Editar', exact: true })).toHaveCount(0);
  expect(materialPosts(api)).toHaveLength(1);
  expect(api.materials.at(-1)).toMatchObject({ nome: 'Material novo do operador', quantidadeEstoque: 0 });
  for (const id of [7, 101]) {
    await page.goto(`/materiais/${id}/editar`);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('button', { name: 'Salvar alterações' })).toHaveCount(0);
  }
  expect(writes(api)).toEqual(materialPosts(api));
  expect(api.materials[0]).toEqual(EXISTING_MATERIAL);
});

test('CONSULTA pode listar materiais, mas não cadastrar ou editar', async ({ page }) => {
  const api = await setup(page, { role: 'CONSULTA' });
  await page.goto('/materiais');
  await expect(page.getByRole('heading', { name: 'Materiais', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '+ Novo material', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Editar', exact: true })).toHaveCount(0);
  for (const path of ['/materiais/novo', '/materiais/7/editar']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('button', { name: 'Cadastrar material' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Salvar alterações' })).toHaveCount(0);
  }
  expect(writes(api)).toEqual([]);
});

test('CONSULTA continua sem acesso a cadastro ou edição de NF', async ({ page }) => {
  const api = await setup(page, { role: 'CONSULTA' });
  for (const path of ['/notas-fiscais/nova', '/notas-fiscais/900/editar']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('button', { name: '+ Criar material', exact: true })).toHaveCount(0);
  }
  expect(writes(api)).toEqual([]);
});

test('NF confirmada continua bloqueada para edição e criação de material', async ({ page }) => {
  await setup(page, { draft: { ...INVOICE, id: 900, status: 'CONFIRMADA', itens: [] } });
  await page.goto('/notas-fiscais/900/editar');
  await expect(page.getByText('Nota fiscal confirmada.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Criar material', exact: true })).toHaveCount(0);
});

test('formulário compartilhado mantém cadastro e edição normais de material', async ({ page }) => {
  const api = await setup(page);
  await page.goto('/materiais/novo');
  await page.getByLabel('Nome', { exact: true }).fill('  Material normal  ');
  await page.getByLabel('Descrição', { exact: true }).fill('  Descrição normal  ');
  await page.getByRole('button', { name: 'Cadastrar material' }).click();
  await expect(page).toHaveURL(/\/materiais$/);
  expect(materialPosts(api)[0].body).toEqual({ nome: 'Material normal', descricao: 'Descrição normal' });
  await page.goto('/materiais/101/editar');
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Material normal');
  await page.getByLabel('Nome', { exact: true }).fill('Material editado');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText('Material atualizado com sucesso.', { exact: true })).toBeVisible();
  expect(api.materials.at(-1)).toMatchObject({ nome: 'Material editado', quantidadeEstoque: 0 });
});

test('modal mantém foco e ações acessíveis em viewport estreito com altura reduzida', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto('/notas-fiscais/nova');
  await createButton(page).click();
  await expect(dialog(page).getByLabel('Nome', { exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog(page).getByRole('button', { name: 'Cadastrar material' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog(page).getByLabel('Nome', { exact: true })).toBeFocused();
  // Reduced visual area approximates the space left by an on-screen keyboard.
  await page.setViewportSize({ width: 390, height: 360 });
  for (const label of ['Cadastrar material', 'Cancelar']) {
    const button = dialog(page).getByRole('button', { name: label, exact: true });
    await expect(button).toBeInViewport({ ratio: 1 });
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  expect(await dialog(page).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(createButton(page)).toBeFocused();
});
