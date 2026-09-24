import { test, expect } from '@playwright/test';

async function setupGerente(page) {
  const calls = [];

  await page.addInitScript(() => {
    localStorage.setItem('controle-materiais-auth', JSON.stringify({
      token: 'gerente-token',
      role: 'GERENTE',
      username: 'gerente',
      expiresAt: Date.now() + 3600000,
    }));
  });

  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api', '');
    calls.push(path);

    if (path === '/usuarios/encarregados') return route.fulfill({ json: [] });
    if (path === '/contratos') return route.fulfill({ json: [{
      id: 1,
      nome: 'Contrato gerenciado',
      descricao: 'Disponível ao gerente',
      ativo: true,
    }] });

    return route.fulfill({
      status: 403,
      json: { erro: 'Usuário autenticado sem permissão' },
    });
  });

  return calls;
}

test('GERENTE carrega somente dados autorizados no dashboard e gerencia contratos', async ({ page }) => {
  const calls = await setupGerente(page);

  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: 'Olá, gerente' })).toBeVisible();
  await expect(page.getByText('Encarregados ativos', { exact: true })).toBeVisible();
  await expect(page.getByText('Contratos ativos', { exact: true })).toBeVisible();
  await expect(page.getByText('Materiais', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Movimentações recentes', { exact: true })).toHaveCount(0);
  await expect.poll(() => [...new Set(calls)].sort()).toEqual([
    '/contratos',
    '/usuarios/encarregados',
  ]);

  await page.goto('/contratos');
  await expect(page.getByRole('link', { name: '+ Novo contrato', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Editar', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Desativar', exact: true })).toBeVisible();
});
