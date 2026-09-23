import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';

const IMAGE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN2kAAAAASUVORK5CYII=', 'base64');
const SIGNATURE_HASH = createHash('sha256').update(IMAGE).digest('hex');
const PHOTO_HASH = 'a'.repeat(64);
const PRIVATE_KEY = 'evidencias/arquivo-interno-123.png';
const PRIVATE_PATH = 'C:\\armazenamento-privado\\arquivo.png';
const RECORDED_AT = '2026-09-12T10:30:00';

async function setup(page, role = 'OPERADOR') {
  const api = { signatureStatus: 200, signatureGate: null, writes: [] };
  const evidence = (id, tipo, sha256) => ({
    id, tipo, sha256, dataEvidencia: RECORDED_AT, tamanhoBytes: IMAGE.length,
    encarregado: { id: 1, nome: 'João Silva' }, assinante: { id: 1, nome: 'João Silva' },
    registradaPor: { id: 1, username: 'operador' },
    contentType: 'image/png', urlArquivo: `/movimentacoes/42/evidencias/${id}/arquivo`,
    // Mesmo que dados internos sejam incluídos indevidamente, a UI não os apresenta.
    storageKey: PRIVATE_KEY, caminhoFisico: PRIVATE_PATH, nomeArquivo: PRIVATE_PATH,
  });
  api.receipt = {
    id: 42, tipo: 'DEVOLUCAO', quantidade: 1, versao: 1, dataMovimentacao: RECORDED_AT,
    material: { id: 1, nome: 'Cabo óptico' }, encarregado: { id: 1, nome: 'João Silva' },
    contrato: { id: 1, nome: 'Contrato A' },
    evidencias: [evidence(11, 'ASSINATURA', SIGNATURE_HASH), evidence(12, 'FOTO_DEVOLUCAO', PHOTO_HASH)],
  };
  await page.addInitScript((role) => {
    localStorage.setItem('controle-materiais-auth', JSON.stringify({ token: 'test-token', username: 'teste', role }));
    window.copiedHashes = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (value) => { window.copiedHashes.push(value); },
    } });
  }, role);
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    if (request.method() !== 'GET') api.writes.push(path);
    if (path === '/movimentacoes/42/comprovante') return route.fulfill({ json: api.receipt });
    if (path.endsWith('/arquivo')) {
      if (path.includes('/11/')) {
        if (api.signatureGate) await api.signatureGate;
        if (api.signatureStatus !== 200) return route.fulfill({
          status: api.signatureStatus, json: { erro: `Falha ao ler ${PRIVATE_PATH}` },
        });
      }
      return route.fulfill({ contentType: 'image/png', body: IMAGE, headers: { 'Cache-Control': 'no-store' } });
    }
    if (path === '/movimentacoes') return route.fulfill({ json: [{
      ...api.receipt, material: 'Cabo óptico', encarregado: 'João Silva', contrato: 'Contrato A',
    }] });
    return route.fulfill({ json: [] });
  });
  return api;
}

async function openReceipt(page) {
  await page.goto('/movimentacoes/historico');
  await page.getByRole('button', { name: 'Ver comprovante', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Comprovante de movimentação' });
  await expect(dialog.locator('.receipt-evidence')).toHaveCount(2);
  return dialog;
}

for (const role of ['OPERADOR', 'ADMIN']) {
  test(`${role}: comprovante prioriza evidências e permite abrir detalhes e copiar cada hash completo`, async ({ page }) => {
    const api = await setup(page, role);
    const dialog = await openReceipt(page);
    await expect(dialog.getByRole('img', { name: 'Assinatura de João Silva', exact: true })).toBeVisible();
    await expect(dialog.getByRole('img', { name: 'Material devolvido', exact: true })).toBeVisible();
    await expect(dialog.getByRole('status').filter({ hasText: 'Integridade verificada' })).toHaveCount(2);
    expect(await dialog.innerText()).not.toContain('SHA-256');
    expect(await dialog.innerText()).not.toContain(SIGNATURE_HASH.slice(0, 12));
    expect(await dialog.innerText()).not.toContain(PHOTO_HASH.slice(0, 12));
    await expect(dialog.getByRole('button', { name: 'Copiar hash', exact: true })).toHaveCount(0);
    const cards = dialog.locator('.receipt-evidence');
    for (const [index, hash] of [SIGNATURE_HASH, PHOTO_HASH].entries()) {
      const card = cards.nth(index);
      await expect(card.locator('.receipt-evidence-heading')).toContainText('12/09/2026');
      const toggle = card.getByRole('button', { name: 'Detalhes técnicos', exact: true });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const controlledId = await toggle.getAttribute('aria-controls');
      expect(await page.evaluate((id) => !document.getElementById(id).hidden, controlledId)).toBe(true);
      await expect(card.getByText('SHA-256', { exact: true })).toBeVisible();
      await expect(card.locator('code')).toHaveText(hash);
      await expect(card.locator('code')).toBeVisible();
      await expect(card).toContainText(`${IMAGE.length} bytes`);
      await expect(card.getByText('Data e hora de registro', { exact: true })).toBeVisible();
      await expect(card.getByText('Tipo da evidência', { exact: true })).toBeVisible();
      await card.getByRole('button', { name: 'Copiar hash', exact: true }).click();
      await expect(card.getByRole('status').filter({ hasText: 'Hash copiado.' })).toBeVisible();
      expect(await page.evaluate(() => window.copiedHashes)).toEqual([SIGNATURE_HASH, PHOTO_HASH].slice(0, index + 1));
      await toggle.focus();
      await page.keyboard.press('Space');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(card.locator('code')).toBeHidden();
    }
    expect(await dialog.innerHTML()).not.toContain(PRIVATE_KEY);
    expect(await dialog.innerHTML()).not.toContain(PRIVATE_PATH);
    await expect(dialog.getByRole('button', { name: 'Adicionar assinatura', exact: true })).toHaveCount(0);
    expect(api.writes).toEqual([]);
  });
}

test('hash armazenado não confirma integridade enquanto o download está pendente', async ({ page }) => {
  const api = await setup(page);
  let finish;
  api.signatureGate = new Promise((resolve) => { finish = resolve; });
  try {
    const dialog = await openReceipt(page);
    const signature = dialog.locator('.receipt-evidence').first();
    await expect(signature.getByText('Verificando integridade...', { exact: true })).toBeVisible();
    await expect(signature.getByRole('status').filter({ hasText: 'Integridade verificada' })).toHaveCount(0);
    await signature.getByRole('button', { name: 'Detalhes técnicos', exact: true }).click();
    await expect(signature.locator('code')).toHaveText(SIGNATURE_HASH);
    await expect(signature.getByRole('status').filter({ hasText: 'Integridade verificada' })).toHaveCount(0);
    finish();
    await expect(signature.getByRole('status').filter({ hasText: 'Integridade verificada' })).toBeVisible();
    await expect(signature).toContainText('Nenhuma alteração detectada desde o armazenamento.');
  } finally { finish(); }
});

test('falha no download não afirma integridade verificada nem expõe detalhes internos do erro', async ({ page }) => {
  const api = await setup(page);
  api.signatureStatus = 500;
  const dialog = await openReceipt(page);
  const signature = dialog.locator('.receipt-evidence').first();
  await expect(signature.getByText('Não foi possível verificar a integridade.', { exact: true })).toBeVisible();
  await expect(signature.getByRole('status').filter({ hasText: 'Integridade verificada' })).toHaveCount(0);
  await expect(dialog.locator('.receipt-evidence').last().getByRole('status').filter({ hasText: 'Integridade verificada' })).toBeVisible();
  await signature.getByRole('button', { name: 'Detalhes técnicos', exact: true }).click();
  await expect(signature.locator('code')).toHaveText(SIGNATURE_HASH);
  expect(await dialog.innerHTML()).not.toContain(PRIVATE_PATH);
  expect(await dialog.innerHTML()).not.toContain(PRIVATE_KEY);
});

test('reabrir o comprovante não reutiliza uma verificação anterior após falha no download', async ({ page }) => {
  const api = await setup(page);
  const dialog = await openReceipt(page);
  const signature = dialog.locator('.receipt-evidence').first();
  await expect(signature.getByRole('status').filter({ hasText: 'Integridade verificada' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  api.signatureStatus = 500;
  await page.getByRole('button', { name: 'Ver comprovante', exact: true }).first().click();
  await expect(signature.getByText('Não foi possível verificar a integridade.', { exact: true })).toBeVisible();
  await expect(signature.getByRole('status').filter({ hasText: 'Integridade verificada' })).toHaveCount(0);
});

for (const clipboardState of ['indisponível', 'negada']) {
  test(`cópia ${clipboardState} mantém o hash selecionável e informa a falha`, async ({ page }) => {
    await setup(page);
    const dialog = await openReceipt(page);
    await page.evaluate((state) => {
      Object.defineProperty(navigator, 'clipboard', { value: state === 'indisponível' ? undefined : {
        writeText: async () => { throw new DOMException('Acesso negado', 'NotAllowedError'); },
      } });
    }, clipboardState);
    const signature = dialog.locator('.receipt-evidence').first();
    await signature.getByRole('button', { name: 'Detalhes técnicos', exact: true }).click();
    await signature.getByRole('button', { name: 'Copiar hash', exact: true }).click();
    await expect(signature.getByText('Não foi possível copiar. Selecione e copie o hash acima.', { exact: true })).toBeVisible();
    await expect(signature.getByText('Hash copiado.', { exact: true })).toHaveCount(0);
    await expect(signature.locator('code')).toHaveText(SIGNATURE_HASH);
    await expect(signature.locator('code')).toHaveCSS('user-select', 'text');
    expect(await page.evaluate(() => window.copiedHashes)).toEqual([]);
  });
}

test('hash de 64 caracteres fica recolhido e não provoca rolagem horizontal em 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await setup(page, 'ADMIN');
  const dialog = await openReceipt(page);
  for (const card of await dialog.locator('.receipt-evidence').all()) {
    await expect(card.locator('code')).toBeHidden();
    await card.getByRole('button', { name: 'Detalhes técnicos', exact: true }).click();
    await expect(card.locator('code')).toBeVisible();
    expect((await card.locator('code').innerText()).length).toBe(64);
    await card.locator('code').scrollIntoViewIfNeeded();
    const dimensions = await card.evaluate((element) => {
      const body = element.closest('.receipt-dialog-body');
      const hash = element.querySelector('code');
      const bounds = hash.getBoundingClientRect();
      return {
        cardOverflow: element.scrollWidth - element.clientWidth,
        bodyOverflow: body.scrollWidth - body.clientWidth,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        hashOverflow: hash.scrollWidth - hash.clientWidth,
        left: bounds.left, right: bounds.right, viewport: window.innerWidth,
      };
    });
    expect(dimensions.cardOverflow).toBeLessThanOrEqual(1);
    expect(dimensions.bodyOverflow).toBeLessThanOrEqual(1);
    expect(dimensions.pageOverflow).toBeLessThanOrEqual(1);
    expect(dimensions.hashOverflow).toBeLessThanOrEqual(1);
    expect(dimensions.left).toBeGreaterThanOrEqual(0);
    expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewport);
  }
});

test('metadados opcionais ausentes não geram valores inventados ou botão de cópia vazio', async ({ page }) => {
  const api = await setup(page);
  Object.assign(api.receipt.evidencias[0], { sha256: null, tamanhoBytes: null, dataEvidencia: null });
  const dialog = await openReceipt(page);
  const signature = dialog.locator('.receipt-evidence').first();
  await expect(signature.locator('.receipt-evidence-heading')).toContainText('Data não informada');
  await signature.getByRole('button', { name: 'Detalhes técnicos', exact: true }).click();
  await expect(signature.getByText('Tamanho do arquivo', { exact: true })).toHaveCount(0);
  await expect(signature.getByText('Data e hora de registro', { exact: true })).toHaveCount(0);
  await expect(signature.getByText('Não informado', { exact: true })).toBeVisible();
  await expect(signature.getByRole('button', { name: 'Copiar hash', exact: true })).toHaveCount(0);
});
