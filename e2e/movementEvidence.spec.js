import { test, expect } from '@playwright/test';

const PHOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN2kAAAAASUVORK5CYII=', 'base64');
const EMPLOYEE = { id: 1, nome: 'João Silva', cargo: 'Técnico', ativo: true };
const MATERIAL = { id: 1, nome: 'Cabo óptico', descricao: 'Cabo', quantidadeEstoque: 10 };
const CONTRACT = { id: 1, nome: 'Contrato A', descricao: 'Obra', ativo: true };
const signatureDialog = (page) => page.getByRole('dialog', { name: 'Assinatura do responsável' });

async function setup(page, role = 'OPERADOR') {
  const api = { posts: [], writes: [], files: new Map(), error: null, gate: null, receipt: null, stock: 10 };
  await page.addInitScript((role) => {
    localStorage.setItem('controle-materiais-auth', JSON.stringify({ token: 'test-token', username: 'teste', role }));
  }, role);
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    if (request.method() !== 'GET') api.writes.push(path);
    if (path === '/materiais') return route.fulfill({ json: [{ ...MATERIAL, quantidadeEstoque: api.stock }] });
    if (path === '/funcionarios') return route.fulfill({ json: [EMPLOYEE] });
    if (path === '/contratos') return route.fulfill({ json: [CONTRACT] });
    if (path === '/movimentacoes/funcionario/1') return route.fulfill({ json: [
      { tipo: 'RETIRADA', material: MATERIAL.nome, contrato: CONTRACT.nome, quantidade: 6 },
    ] });
    if (path === '/movimentacoes' && request.method() === 'POST') {
      const parts = await new Response(request.postDataBuffer(), {
        headers: { 'Content-Type': request.headers()['content-type'] },
      }).formData();
      const movement = JSON.parse(await parts.get('movimentacao').text());
      const signature = parts.get('assinatura');
      const photo = parts.get('foto');
      api.posts.push({ movement, signature, photo, authorization: request.headers().authorization });
      if (api.gate) await api.gate;
      if (api.error) return route.fulfill({ status: 409, json: { erro: api.error } });
      api.stock += movement.tipo === 'RETIRADA' ? -movement.quantidade : movement.quantidade;
      const evidencias = [{ id: 11, tipo: 'ASSINATURA', urlArquivo: '/movimentacoes/42/evidencias/11/arquivo' }];
      api.files.set(evidencias[0].urlArquivo, signature);
      if (photo) {
        evidencias.push({ id: 12, tipo: 'FOTO_DEVOLUCAO', urlArquivo: '/movimentacoes/42/evidencias/12/arquivo' });
        api.files.set(evidencias[1].urlArquivo, photo);
      }
      api.receipt = {
        ...movement, id: 42, material: MATERIAL, funcionario: EMPLOYEE, contrato: CONTRACT,
        registradoPor: { username: 'teste' }, versao: 1, evidencias,
      };
      return route.fulfill({ status: 201, json: {
        ...movement, id: 42, funcionario: EMPLOYEE.nome, contrato: CONTRACT.nome, material: MATERIAL.nome,
      } });
    }
    if (path.endsWith('/comprovante')) return route.fulfill({ json: api.receipt });
    if (api.files.has(path)) {
      const file = api.files.get(path);
      return route.fulfill({ body: Buffer.from(await file.arrayBuffer()), contentType: file.type });
    }
    if (path === '/movimentacoes') return route.fulfill({ json: api.receipt ? [
      { ...api.receipt, funcionario: EMPLOYEE.nome, contrato: CONTRACT.nome, material: MATERIAL.nome },
    ] : [] });
    return route.fulfill({ json: [] });
  });
  return api;
}

async function fill(page, type = 'RETIRADA') {
  await page.goto(`/movimentacoes/${type === 'RETIRADA' ? 'retirada' : 'devolucao'}`);
  await page.getByRole('combobox', { name: 'Funcionario', exact: true }).selectOption('1');
  await page.getByRole('combobox', { name: 'Contrato', exact: true }).selectOption('1');
  await page.getByRole('combobox', { name: /^Material/ }).selectOption('1');
  await page.getByLabel(/^Quantidade/).fill('3');
  await page.getByLabel(/^Observacao/).fill('Entrega revisada');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(signatureDialog(page)).toBeVisible();
}

async function draw(page) {
  const canvas = signatureDialog(page).locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 35, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 110, { steps: 8 });
  await page.mouse.move(box.x + 155, box.y + 45, { steps: 8 });
  await page.mouse.up();
}

async function selectPhoto(page, camera = false) {
  await signatureDialog(page).getByLabel(camera ? 'Tirar foto do material' : 'Escolher foto da galeria').setInputFiles({
    name: 'material.png', mimeType: 'image/png', buffer: PHOTO,
  });
}

for (const type of ['RETIRADA', 'DEVOLUCAO']) {
  const label = type === 'RETIRADA' ? 'retirada' : 'devolução';

  test(`${type}: assinatura obrigatória, resumo e cancelamento sem criar movimentação`, async ({ page }) => {
    const api = await setup(page);
    await fill(page, type);
    const dialog = signatureDialog(page);
    await expect(dialog.getByRole('button', { name: `Confirmar ${label}`, exact: true })).toBeDisabled();
    for (const text of [EMPLOYEE.nome, CONTRACT.nome, MATERIAL.nome, '3 un.']) await expect(dialog).toContainText(text);
    expect(api.posts).toEqual([]);
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(api.writes).toEqual([]);
    await expect(page.getByLabel(/^Quantidade/)).toHaveValue('3');
    await expect(page.getByLabel(/^Observacao/)).toHaveValue('Entrega revisada');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(api.posts).toEqual([]);
  });

  test(`${type}: assinatura permite confirmar sem foto e sucesso limpa o formulário`, async ({ page }) => {
    const api = await setup(page);
    await fill(page, type);
    if (type === 'RETIRADA') await expect(signatureDialog(page).getByText('Foto do material (opcional)', { exact: true })).toHaveCount(0);
    await draw(page);
    await signatureDialog(page).getByRole('button', { name: `Confirmar ${label}`, exact: true }).click();
    await expect(signatureDialog(page)).toHaveCount(0);
    const receipt = page.getByRole('dialog', { name: 'Comprovante de movimentação' });
    await expect(receipt.getByRole('img', { name: /^Assinatura/ })).toBeVisible();
    await expect(receipt.getByRole('button', { name: 'Adicionar assinatura', exact: true })).toHaveCount(0);
    expect(api.writes).toEqual(['/movimentacoes']);
    expect(api.posts[0].authorization).toBe('Bearer test-token');
    expect(api.posts[0].signature.type).toBe('image/png');
    expect(api.posts[0].signature.size).toBeGreaterThan(0);
    expect(api.posts[0].photo).toBe(null);
    expect(api.posts[0].movement).toMatchObject({ tipo: type, quantidade: 3, observacao: 'Entrega revisada' });
    await receipt.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(page.getByLabel(/^Quantidade/)).toHaveValue('');
    await expect(page.getByLabel(/^Observacao/)).toHaveValue('');
    for (const field of ['Funcionario', 'Contrato', /^Material/]) await expect(page.getByRole('combobox', { name: field })).toHaveValue('');
  });
}

test('devolução oferece galeria/câmera, prévia, substituição e remoção antes de confirmar', async ({ page }) => {
  const api = await setup(page);
  await fill(page, 'DEVOLUCAO');
  const dialog = signatureDialog(page);
  await expect(dialog.getByLabel('Escolher foto da galeria')).not.toHaveAttribute('capture');
  await expect(dialog.getByLabel('Tirar foto do material')).toHaveAttribute('capture', 'environment');
  await selectPhoto(page);
  await expect(dialog.getByRole('img', { name: 'Prévia da foto do material devolvido' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Confirmar devolução', exact: true })).toBeDisabled();
  await selectPhoto(page, true);
  await dialog.getByRole('button', { name: 'Remover foto', exact: true }).click();
  await expect(dialog.getByRole('img')).toHaveCount(0);
  await draw(page);
  await dialog.getByRole('button', { name: 'Confirmar devolução', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(api.posts[0].photo).toBe(null);
});

test('foto enviada aparece no comprovante e é limpa para a próxima devolução', async ({ page }) => {
  const api = await setup(page);
  await fill(page, 'DEVOLUCAO');
  await selectPhoto(page);
  await draw(page);
  await signatureDialog(page).getByRole('button', { name: 'Confirmar devolução', exact: true }).click();
  const receipt = page.getByRole('dialog', { name: 'Comprovante de movimentação' });
  await expect(receipt.getByRole('img', { name: 'Material devolvido', exact: true })).toBeVisible();
  await expect(receipt.getByRole('img', { name: /^Assinatura/ })).toBeVisible();
  expect(api.posts[0].photo.type).toBe('image/png');
  expect(Buffer.from(await api.posts[0].photo.arrayBuffer())).toEqual(PHOTO);
  await receipt.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('combobox', { name: 'Funcionario', exact: true }).selectOption('1');
  await page.getByRole('combobox', { name: 'Contrato', exact: true }).selectOption('1');
  await page.getByRole('combobox', { name: /^Material/ }).selectOption('1');
  await page.getByLabel(/^Quantidade/).fill('1');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(signatureDialog(page).getByRole('img')).toHaveCount(0);
  await expect(signatureDialog(page).getByRole('button', { name: 'Confirmar devolução', exact: true })).toBeDisabled();
});

test('erro do backend preserva assinatura, foto e dados e permite nova tentativa', async ({ page }) => {
  const api = await setup(page);
  api.error = 'Não foi possível processar a evidência';
  await fill(page, 'DEVOLUCAO');
  await selectPhoto(page);
  await draw(page);
  const dialog = signatureDialog(page);
  await dialog.getByRole('button', { name: 'Confirmar devolução', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText(api.error);
  await expect(dialog.getByRole('img')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Confirmar devolução', exact: true })).toBeEnabled();
  expect(api.stock).toBe(10);
  api.error = null;
  await dialog.getByRole('button', { name: 'Confirmar devolução', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(api.posts[1].movement).toEqual(api.posts[0].movement);
  expect(Buffer.from(await api.posts[1].signature.arrayBuffer())).toEqual(Buffer.from(await api.posts[0].signature.arrayBuffer()));
});

test('limpar assinatura bloqueia a conclusão novamente', async ({ page }) => {
  const api = await setup(page);
  await fill(page);
  await draw(page);
  await signatureDialog(page).getByRole('button', { name: 'Limpar', exact: true }).click();
  await expect(signatureDialog(page).getByRole('button', { name: 'Confirmar retirada', exact: true })).toBeDisabled();
  expect(api.posts).toEqual([]);
});

test('falha ao gerar assinatura não envia movimentação', async ({ page }) => {
  const api = await setup(page);
  await fill(page);
  await draw(page);
  await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = (callback) => callback(null); });
  await signatureDialog(page).getByRole('button', { name: 'Confirmar retirada', exact: true }).click();
  await expect(signatureDialog(page).getByRole('alert')).toContainText('Não foi possível gerar a imagem');
  expect(api.posts).toEqual([]);
});

test('envio pendente bloqueia reenvio e cancelamento', async ({ page }) => {
  const api = await setup(page);
  let finish;
  api.gate = new Promise((resolve) => { finish = resolve; });
  await fill(page);
  await draw(page);
  try {
    await signatureDialog(page).getByRole('button', { name: 'Confirmar retirada', exact: true }).click();
    await expect.poll(() => api.posts.length).toBe(1);
    await expect(signatureDialog(page).getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(signatureDialog(page)).toBeVisible();
    await page.keyboard.press('Enter');
    expect(api.posts).toHaveLength(1);
  } finally { finish(); }
  await expect(signatureDialog(page)).toHaveCount(0);
});

test('CONSULTA só visualiza comprovantes históricos e ENTRADA continua com NF', async ({ page }) => {
  const api = await setup(page, 'CONSULTA');
  api.receipt = { id: 42, tipo: 'RETIRADA', quantidade: 1, material: MATERIAL,
    funcionario: EMPLOYEE, contrato: CONTRACT, evidencias: [], versao: 1 };
  await page.goto('/movimentacoes/retirada');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/movimentacoes/devolucao');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/movimentacoes/historico');
  await page.getByRole('button', { name: 'Ver comprovante', exact: true }).first().click();
  await expect(page.getByText('Registro histórico sem assinatura', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar assinatura', exact: true })).toHaveCount(0);
  api.receipt = { ...api.receipt, tipo: 'ENTRADA', notaFiscal: { id: 1, numero: '123', serie: '1' } };
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Ver comprovante', exact: true }).first().click();
  await expect(page.getByRole('link', { name: 'Abrir Nota Fiscal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar assinatura', exact: true })).toHaveCount(0);
  expect(api.writes).toEqual([]);
});
