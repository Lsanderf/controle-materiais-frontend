import { test, expect } from '@playwright/test';

function storedAuth(role, username) {
  return JSON.stringify({ token: `${role}-token`, role, username, expiresAt: Date.now() + 3600000 });
}

test('GERENTE envia requisição própria sem opção de registrar movimentação', async ({ page }) => {
  const posts = [];
  await page.addInitScript((auth) => localStorage.setItem('controle-materiais-auth', auth), storedAuth('GERENTE', 'gerente'));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    if (path === '/requisicoes' && request.method() === 'GET') return route.fulfill({ json: [] });
    if (path === '/usuarios/encarregados') return route.fulfill({ json: [{ id: 8, nome: 'João', ativo: true }] });
    if (path === '/contratos') return route.fulfill({ json: [{ id: 9, nome: 'Obra A', ativo: true }] });
    if (path === '/materiais') throw new Error('O fluxo de requisição não deve consultar materiais');
    if (path === '/requisicoes' && request.method() === 'POST') {
      posts.push(JSON.parse(request.postData()));
      return route.fulfill({ status: 201, json: { id: 1 } });
    }
    return route.fulfill({ status: 403, json: { erro: 'Usuário autenticado sem permissão' } });
  });

  await page.goto('/requisicoes');
  await expect(page.getByRole('button', { name: '+ Nova requisição', exact: true })).toBeVisible();
  await expect(page.getByText('Registrar retirada', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '+ Nova requisição', exact: true }).click();
  await page.getByRole('combobox', { name: 'Encarregado destinatário' }).selectOption('8');
  await page.getByRole('combobox', { name: 'Contrato' }).selectOption('9');
  await expect(page.getByRole('combobox', { name: 'Material' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '+ Criar contrato', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nome/descrição do material' }).fill('Parafuso');
  await page.getByRole('spinbutton', { name: 'Quantidade' }).fill('3');
  await page.getByRole('button', { name: '+ Criar material', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nome/descrição do material' }).nth(1).fill('Capacete');
  await page.getByRole('spinbutton', { name: 'Quantidade' }).nth(1).fill('2');
  await page.getByRole('button', { name: 'Enviar requisição', exact: true }).click();
  await expect(page.getByText('Requisição enviada ao encarregado com sucesso.', { exact: true })).toBeVisible();
  expect(posts).toEqual([expect.objectContaining({
    encarregadoDestinatarioId: 8, contratoId: 9, tipo: 'RETIRADA',
    itens: [{ descricao: 'Parafuso', quantidade: 3 }, { descricao: 'Capacete', quantidade: 2 }],
  })]);
});

test('GERENTE acessa o formulário para criar contratos', async ({ page }) => {
  await page.addInitScript((auth) => localStorage.setItem('controle-materiais-auth', auth), storedAuth('GERENTE', 'gerente'));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api', '');
    if (path === '/requisicoes') return route.fulfill({ json: [] });
    if (path === '/usuarios/encarregados') return route.fulfill({ json: [] });
    if (path === '/contratos') return route.fulfill({ json: [] });
    return route.fulfill({ status: 403, json: { erro: 'Usuário autenticado sem permissão' } });
  });

  await page.goto('/requisicoes');
  await page.getByRole('button', { name: '+ Nova requisição', exact: true }).click();
  await page.getByRole('link', { name: '+ Criar contrato', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Novo contrato', exact: true })).toBeVisible();
});

test('ENCARREGADO vê requisições recebidas, contador pendente e conclui uma solicitação', async ({ page }) => {
  let status = 'PENDENTE';
  const requisicao = () => ({
    id: 42, tipo: 'RETIRADA', status, criadaEm: '2026-09-24T10:30:00',
    gerenteSolicitante: { id: 1, nome: 'Gerente Ana' }, encarregadoDestinatario: { id: 2, nome: 'Encarregado João' },
    contrato: { id: 3, nome: 'Obra Central' }, itens: [
      { id: 4, descricao: 'Parafuso', quantidade: 10 },
      { id: 5, descricao: 'Capacete', quantidade: 5 },
      { id: 6, descricao: 'Luvas M', quantidade: 5 },
    ],
  });
  await page.addInitScript((auth) => localStorage.setItem('controle-materiais-auth', auth), storedAuth('ENCARREGADO', 'joao'));
  await page.route('**/api/**', async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname.replace('/api', '');
    if (path === '/requisicoes' && request.method() === 'GET') return route.fulfill({ json: [requisicao()] });
    if (path === '/requisicoes/42' && request.method() === 'GET') return route.fulfill({ json: requisicao() });
    if (path === '/requisicoes/42/visualizar') { status = 'VISUALIZADA'; return route.fulfill({ json: requisicao() }); }
    if (path === '/requisicoes/42/concluir') { status = 'CONCLUIDA'; return route.fulfill({ json: requisicao() }); }
    return route.fulfill({ status: 403, json: { erro: 'Usuário autenticado sem permissão' } });
  });

  await page.goto('/dashboard');
  await expect(page.getByText('Requisições recebidas', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('1 pendentes', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Requisições recebidas/ }).first().click();
  await page.getByRole('link', { name: /Ver detalhes/ }).click();
  await expect(page.getByText('Parafuso x10', { exact: true })).toBeVisible();
  await expect(page.getByText('Capacete x5', { exact: true })).toBeVisible();
  await expect(page.getByText('Luvas M x5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Marcar como concluída', exact: true }).click();
  await expect(page.getByText('Requisição marcada como concluída.', { exact: true })).toBeVisible();
});
