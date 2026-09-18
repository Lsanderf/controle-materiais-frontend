import { test, expect } from '@playwright/test';
import { failureModes, prepareFailure } from './support/apiFailures.js';

const ACCESS_KEY = '52060433009911002506550120000007800267301615';
const INVOICE = {
  id: 900, numero: '12345', serie: '1', chaveAcesso: ACCESS_KEY,
  fornecedor: 'Fornecedor preservado', cnpjFornecedor: '11222333000181', dataEmissao: '2026-09-10',
  status: 'RASCUNHO', valorTotal: 24, movimentacoes: [],
  itens: [{ id: 1, materialId: 1, material: 'Cabo', quantidade: 12, valorUnitario: 2, valorTotal: 24 }],
};
const XML = { name: 'nota.xml', mimeType: 'application/xml', buffer: Buffer.from('<NFe>nota de teste</NFe>') };

async function setup(page, { login = false } = {}) {
  const api = { writes: [], failure: null, invoice: structuredClone(INVOICE) };
  if (!login) await page.addInitScript(() => {
    localStorage.setItem('controle-materiais-auth', JSON.stringify({ token: 'test-token', username: 'operador', role: 'OPERADOR' }));
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    if (request.method() !== 'GET') {
      api.writes.push({ path, body: request.postDataBuffer(), headers: request.headers() });
      if (api.failure) return api.failure(route);
    }
    if (path === '/auth/login') return route.fulfill({ json: { token: 'new-token', role: 'OPERADOR', tipo: 'Bearer', expiraEm: 3600 } });
    if (path === '/notas-fiscais/900/confirmar') api.invoice.status = 'CONFIRMADA';
    if (path.startsWith('/notas-fiscais/900')) return route.fulfill({ json: api.invoice });
    if (path === '/materiais') return route.fulfill({ json: [{ id: 1, nome: 'Cabo', descricao: 'Cabo', quantidadeEstoque: 10 }] });
    if (path === '/notas-fiscais/importar-xml') return route.fulfill({ json: {
      ...INVOICE,
      itens: [{ numeroItem: 1, codigoProduto: 'CAB-01', descricaoProduto: 'Cabo XML', quantidadeComercial: '12', unidadeComercial: 'UN', valorUnitarioComercial: '2', valorTotal: '24' }],
    } });
    return route.fulfill({ json: [] });
  });
  return api;
}

for (const mode of failureModes) {
  test(`login: ${mode} libera botão, preserva credenciais e permite tentar novamente`, async ({ page }) => {
    const failure = await prepareFailure(page, mode);
    const api = await setup(page, { login: true });
    api.failure = failure.respond;
    try {
      await page.goto('/login');
      await page.getByLabel('Usuário', { exact: true }).fill('operador');
      await page.getByPlaceholder('Sua senha', { exact: true }).fill('senha-teste');
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect.poll(() => api.writes.length).toBe(1);
      await failure.expectError(page.getByRole('alert'));
      await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
      await expect(page.getByText('Entrando...', { exact: true })).toHaveCount(0);
      await expect(page.getByLabel('Usuário', { exact: true })).toHaveValue('operador');
      await expect(page.getByPlaceholder('Sua senha', { exact: true })).toHaveValue('senha-teste');
      await expect(page).toHaveURL(/\/login$/);
      failure.release();
      api.failure = null;
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      expect(api.writes).toHaveLength(2);
      expect(api.writes[1].body).toEqual(api.writes[0].body);
    } finally { failure.release(); }
  });

  test(`confirmação de NF: ${mode} preserva rascunho e permite confirmar novamente`, async ({ page }) => {
    const failure = await prepareFailure(page, mode);
    const api = await setup(page);
    api.failure = failure.respond;
    try {
      await page.goto('/notas-fiscais/900');
      await page.getByRole('button', { name: 'Confirmar NF', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmar e lancar estoque', exact: true }).click();
      await expect.poll(() => api.writes.length).toBe(1);
      await failure.expectError(page.getByRole('alert'));
      await expect(page.getByRole('button', { name: 'Confirmar NF', exact: true })).toBeEnabled();
      await expect(page.getByText('Registrando...', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Rascunho', { exact: true })).toBeVisible();
      await expect(page.getByText('12 un.', { exact: true })).toBeVisible();
      expect(api.invoice).toEqual(INVOICE);
      expect(api.writes).toHaveLength(1);
      failure.release();
      api.failure = null;
      await page.getByRole('button', { name: 'Confirmar NF', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmar e lancar estoque', exact: true }).click();
      await expect(page.getByText('Confirmada', { exact: true })).toBeVisible();
      expect(api.writes).toHaveLength(2);
      expect(api.writes.map((call) => call.path)).toEqual(['/notas-fiscais/900/confirmar', '/notas-fiscais/900/confirmar']);
    } finally { failure.release(); }
  });

  test(`upload XML: ${mode} mantém formulário e permite reenviar o mesmo arquivo`, async ({ page }) => {
    const failure = await prepareFailure(page, mode);
    const api = await setup(page);
    api.failure = failure.respond;
    try {
      await page.goto('/notas-fiscais/900/editar');
      await page.getByLabel('Numero', { exact: true }).fill('12345 editada');
      const values = () => page.locator('.page-stack > form').evaluate((form) =>
        [...form.querySelectorAll('input:not([type=file]), textarea, select')].map((field) => field.value));
      const before = await values();
      await page.locator('input[type=file]').setInputFiles(XML);
      await expect.poll(() => api.writes.length).toBe(1);
      await failure.expectError(page.getByRole('alert'));
      await expect(page.getByRole('button', { name: 'Importar XML da NF-e', exact: true })).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Salvar rascunho', exact: true })).toBeEnabled();
      await expect(page.getByText('Lendo Nota Fiscal...', { exact: true })).toHaveCount(0);
      expect(await values()).toEqual(before);
      expect(api.invoice).toEqual(INVOICE);
      failure.release();
      api.failure = null;
      await page.locator('input[type=file]').setInputFiles(XML);
      await expect(page.getByText('XML lido com sucesso.', { exact: false })).toBeVisible();
      expect(api.writes).toHaveLength(2);
      for (const call of api.writes) {
        const parts = await new Response(call.body, { headers: { 'Content-Type': call.headers['content-type'] } }).formData();
        expect(await parts.get('arquivo').text()).toBe(XML.buffer.toString());
        expect(parts.get('notaFiscalId')).toBe('900');
      }
    } finally { failure.release(); }
  });
}

test('JSON 500 da API mantém a mensagem pública e oculta trace nos fluxos de formulário', async ({ page }) => {
  const api = await setup(page, { login: true });
  api.failure = (route) => route.fulfill({ status: 500, json: {
    erro: 'Ocorreu um erro interno inesperado', requestId: 'req-login-123',
    campos: { username: 'Verifique o usuário.', debug: '<html>Cloudflare 1033</html>' },
    trace: 'java.lang.IllegalStateException\n at private.Service:42',
  } });
  await page.goto('/login');
  await page.getByLabel('Usuário', { exact: true }).fill('operador');
  await page.getByPlaceholder('Sua senha', { exact: true }).fill('senha-teste');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Ocorreu um erro interno inesperado');
  await expect(page.getByRole('alert')).toContainText('Verifique o usuário.');
  await expect(page.getByRole('alert')).not.toContainText(/html|Cloudflare|1033|IllegalStateException|private/);
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
});
