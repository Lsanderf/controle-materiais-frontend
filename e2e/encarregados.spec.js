import { test, expect } from '@playwright/test';

function storedAuth() {
  return JSON.stringify({ token: 'gerente-token', role: 'GERENTE', username: 'gerente', expiresAt: Date.now() + 3600000 });
}

test('GERENTE cria encarregado pelo fluxo específico e ele fica disponível para requisições', async ({ page }) => {
  const encarregados = [{ id: 1, nome: 'João', username: 'joao', celular: '11988887777', ativo: true }];

  await page.addInitScript((auth) => localStorage.setItem('controle-materiais-auth', auth), storedAuth());
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    if (path === '/usuarios/encarregados' && request.method() === 'GET') return route.fulfill({ json: encarregados });
    if (path === '/usuarios/encarregados' && request.method() === 'POST') {
      const payload = JSON.parse(request.postData());
      encarregados.push({ id: 2, ...payload, ativo: true });
      return route.fulfill({ status: 201, json: encarregados[1] });
    }
    if (path === '/requisicoes' && request.method() === 'GET') return route.fulfill({ json: [] });
    if (path === '/contratos') return route.fulfill({ json: [] });
    return route.fulfill({ status: 403, json: { erro: 'Usuário autenticado sem permissão' } });
  });

  await page.goto('/encarregados');
  await expect(page.getByRole('button', { name: '+ Novo encarregado', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Usuários', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '+ Novo encarregado', exact: true }).click();
  await page.getByLabel('Nome').fill('Maria Silva');
  await page.getByLabel('CPF').fill('529.982.247-25');
  await page.getByLabel('Celular').fill('(11) 98765-4321');
  await page.getByLabel('Usuário').fill('maria.silva');
  await page.getByLabel('Senha').fill('senhaForte123');
  await page.getByRole('button', { name: 'Cadastrar encarregado', exact: true }).click();
  await expect(page.getByText('Encarregado cadastrado com sucesso.', { exact: true })).toBeVisible();
  await expect(page.getByText('Maria Silva', { exact: true })).toBeVisible();

  await page.goto('/requisicoes');
  await page.getByRole('button', { name: '+ Nova requisição', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Encarregado destinatário' }).locator('option', { hasText: 'Maria Silva' })).toHaveCount(1);
});
