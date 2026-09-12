import { test, expect } from '@playwright/test';
import library from '@zxing/library';

const KEY = '52060433009911002506550120000007800267301615';
const FIXTURE = '/test/fixtures/nfe-code128c.svg';

// Explicit sets A/B also exercise the same CODE_128 reader (the static fixture is C).
function barcodeUrl(text, set = 'B') {
  const start = set === 'A' ? 103 : 104;
  const values = [...text].map((char) => char.charCodeAt(0) - 32);
  const checksum = (start + values.reduce((sum, value, i) => sum + value * (i + 1), 0)) % 103;
  let x = 40;
  const bars = [];
  for (const symbol of [start, ...values, checksum, 106]) {
    library.Code128Reader.CODE_PATTERNS[symbol].forEach((width, index) => {
      if (index % 2 === 0) bars.push(`<rect x="${x}" y="16" width="${width * 3}" height="128"/>`);
      x += width * 3;
    });
  }
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${x + 40}" height="160"><rect width="100%" height="100%" fill="white"/><g fill="black">${bars.join('')}</g></svg>`)}`;
}

async function setup(page, options = {}) {
  await page.addInitScript((config) => {
    localStorage.setItem('controle-materiais-auth', JSON.stringify({
      token: 'test-token', role: 'ADMIN', username: 'teste', expiresAt: Date.now() + 3600000,
    }));
    const state = { calls: [], streams: [], focus: [], canvases: [], image: null, enumerations: 0,
      drawing: { angle: 0, contrast: 1, y: 0.5 } };
    window.scannerCamera = state;
    const devices = [
      { kind: 'videoinput', deviceId: 'front', label: 'Front Camera' },
      { kind: 'videoinput', deviceId: 'ultra', label: 'Back Ultra Wide Camera' },
      { kind: 'videoinput', deviceId: 'rear', label: 'Back Camera' },
    ];
    state.drawBarcode = async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      state.image = image;
    };
    state.rotate = () => {
      for (const canvas of state.canvases) {
        [canvas.width, canvas.height] = [canvas.height, canvas.width];
      }
    };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      async enumerateDevices() { state.enumerations += 1; return devices; },
      async getUserMedia(constraints) {
        state.calls.push(constraints);
        if (config.resolutionFailure && state.calls.length === 1) {
          throw new DOMException('Unsupported resolution', 'OverconstrainedError');
        }
        const id = constraints.video.deviceId?.ideal || config.initialDevice || 'rear';
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const context = canvas.getContext('2d');
        const draw = () => {
          context.fillStyle = 'white';
          context.fillRect(0, 0, canvas.width, canvas.height);
          if (state.image) {
            const width = canvas.width * 0.9;
            const height = state.drawing.height || width * state.image.height / state.image.width;
            context.save();
            context.translate(canvas.width / 2, canvas.height * state.drawing.y);
            context.rotate(state.drawing.angle * Math.PI / 180);
            context.globalAlpha = state.drawing.contrast;
            context.drawImage(state.image, -width / 2, -height / 2, width, height);
            context.restore();
          }
        };
        draw();
        const stream = canvas.captureStream(10);
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings.bind(track);
        const controlSettings = { torch: false, zoom: config.initialZoom?.[id] ?? 1 };
        track.getSettings = () => ({ ...settings(), ...(config.missingSettings ? {} : controlSettings),
          deviceId: id, facingMode: id === 'front' ? 'user' : 'environment' });
        track.getCapabilities = () => {
          if (config.capabilitiesAfterPlayback && !document.querySelector('.barcode-video')?.videoWidth) return {};
          return { ...(config.noFocus ? {} : { focusMode: ['continuous'] }),
            ...(config.deviceCapabilities?.[id] ?? (config.controls ? { torch: true, zoom: { min: 1, max: 10, step: 0.1 },
              exposureMode: ['continuous'], whiteBalanceMode: ['continuous'] } : {})) };
        };
        track.applyConstraints = async (value) => {
          state.focus.push(value);
          state.appliedTracks ??= [];
          state.appliedTracks.push(id);
          const changes = Object.assign({}, ...value.advanced ?? []);
          for (const key of ['torch', 'zoom']) {
            if (value[key]?.exact !== undefined) changes[key] = value[key].exact;
          }
          if (state.holdCommands && ('torch' in changes || 'zoom' in changes)) {
            await new Promise((resolve) => { state.releaseCommand = () => { state.holdCommands = false; resolve(); }; });
          }
          if (config.failTorch && changes.torch) throw new Error('torch unavailable');
          if (config.failTorchOff && changes.torch === false) throw new Error('torch off unavailable');
          if (config.failZoom && changes.zoom) throw new Error('zoom unavailable');
          for (const key of ['torch', 'zoom']) {
            if (config.ignoreControls || (config.exactOnly && value[key]?.exact === undefined)) delete changes[key];
          }
          if (config.roundZoom && Number.isFinite(changes.zoom)) changes.zoom = Math.round(changes.zoom * 2) / 2;
          Object.assign(controlSettings, changes);
        };
        Object.defineProperty(track, 'label', { value: devices.find((device) => device.deviceId === id).label });
        const timer = setInterval(() => {
          if (track.readyState === 'ended') clearInterval(timer);
          else draw();
        }, 100);
        state.canvases.push(canvas);
        state.streams.push(stream);
        if (config.delayPermission) await new Promise((resolve) => { state.releasePermission = resolve; });
        return stream;
      },
    } });
  }, options);
  await page.route('**/api/**', (route) => route.fulfill({ json: [] }));
  await page.goto('/notas-fiscais/nova');
}

const dialog = (page) => page.getByRole('dialog', { name: 'Escanear NF-e' });
const open = (page) => page.getByRole('button', { name: 'Escanear código de barras' }).click();
const searching = (page) => expect(dialog(page).getByText('Procurando código...', { exact: true })).toBeVisible();
const streamStates = (page) => page.evaluate(() => window.scannerCamera.streams.map((stream) => stream.getVideoTracks()[0].readyState));

test('imagem CODE-128C conhecida usa o mesmo decoder; conjuntos A e B também são reconhecidos', async ({ page }) => {
  await setup(page);
  for (const source of [FIXTURE, barcodeUrl(KEY, 'A'), barcodeUrl(KEY, 'B')]) {
    const result = await page.evaluate(async (url) => {
      const { diagnoseNfeBarcodeImage } = await import('/src/dev/nfeBarcodeDiagnostic.js');
      return diagnoseNfeBarcodeImage(url);
    }, source);
    expect(result).toMatchObject({ format: 'CODE_128', textLength: 44, digits: KEY, isValid: true });
  }
  expect(await page.evaluate(() => window.scannerCamera.calls)).toEqual([]);
  await expect(page.locator('.barcode-scanner-dialog input[type=file]')).toHaveCount(0);
});

test('frames vazios mantêm loop ativo até CODE-128C válido, que preenche chave e encerra stream', async ({ page }) => {
  const diagnostics = [];
  const unexpectedErrors = [];
  page.on('console', (message) => { if (message.text().includes('[NF-e scanner]')) diagnostics.push(message.text()); });
  page.on('console', (message) => { if (['warning', 'error'].includes(message.type())) unexpectedErrors.push(message.text()); });
  await setup(page);
  await open(page);
  await searching(page);
  // Wait across several real ZXing NotFoundException attempts, then supply bars.
  await expect.poll(() => page.evaluate(() => document.querySelector('.barcode-video')?.currentTime)).toBeGreaterThan(1);
  await searching(page);
  expect(await streamStates(page)).toEqual(['live']);
  const capture = await page.evaluate(() => ({
    requested: window.scannerCamera.calls[0],
    width: document.querySelector('.barcode-video').videoWidth,
    height: document.querySelector('.barcode-video').videoHeight,
  }));
  expect(capture.requested.video.width).toEqual({ ideal: 1920 });
  expect(capture).toMatchObject({ width: 1280, height: 720 });
  await page.evaluate((url) => window.scannerCamera.drawBarcode(url), FIXTURE);
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByLabel('Chave de acesso', { exact: true })).toHaveValue(KEY);
  expect(await streamStates(page)).toEqual(['ended']);
  expect(diagnostics.some((message) => message.includes('decoded barcode'))).toBe(true);
  expect(diagnostics.some((message) => message.includes('fatal'))).toBe(false);
  expect(unexpectedErrors).toEqual([]);
});

test('CODE-128 curto e DV inválido mostram feedback e permitem leitura válida posterior', async ({ page }) => {
  await setup(page);
  await open(page);
  await searching(page);
  await page.evaluate((url) => window.scannerCamera.drawBarcode(url), barcodeUrl('123456'));
  await expect(dialog(page).getByText('Código detectado, mas não corresponde a uma chave NF-e.', { exact: true })).toBeVisible();
  expect(await streamStates(page)).toEqual(['live']);
  await page.evaluate((url) => window.scannerCamera.drawBarcode(url), barcodeUrl(`${KEY.slice(0, -1)}4`));
  await expect(dialog(page).getByText('Chave NF-e detectada, mas o dígito verificador é inválido. Tente novamente.', { exact: true })).toBeVisible();
  await page.evaluate((url) => window.scannerCamera.drawBarcode(url), FIXTURE);
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByLabel('Chave de acesso', { exact: true })).toHaveValue(KEY);
});

test('prefere principal depois de permissão, aplica foco, permite trocar e cancelar', async ({ page }) => {
  await setup(page, { initialDevice: 'ultra' });
  await open(page);
  await searching(page);
  expect(await page.evaluate(() => window.scannerCamera.calls.map((call) => call.video.deviceId?.ideal))).toEqual([undefined, 'rear']);
  expect(await streamStates(page)).toEqual(['ended', 'live']);
  expect(await page.evaluate(() => window.scannerCamera.focus)).toEqual([{ advanced: [{ focusMode: 'continuous' }] }]);
  await dialog(page).getByRole('button', { name: 'Trocar câmera' }).click();
  await searching(page);
  expect(await page.evaluate(() => window.scannerCamera.calls.at(-1).video.deviceId)).toEqual({ ideal: 'front' });
  expect(await streamStates(page)).toEqual(['ended', 'ended', 'live']);
  await dialog(page).getByRole('button', { name: 'Cancelar' }).click();
  expect(await streamStates(page)).toEqual(['ended', 'ended', 'ended']);
});

test('fallback de resolução e ausência de foco não impedem leitura', async ({ page }) => {
  await setup(page, { resolutionFailure: true, noFocus: true });
  await open(page);
  await searching(page);
  expect(await page.evaluate(() => window.scannerCamera.calls[1])).toEqual({
    audio: false, video: { facingMode: { ideal: 'environment' } },
  });
  expect(await page.evaluate(() => window.scannerCamera.focus)).toEqual([]);
  await page.evaluate((url) => window.scannerCamera.drawBarcode(url), FIXTURE);
  await expect(dialog(page)).toHaveCount(0);
});

test('mudanças de viewport e orientação do vídeo não reabrem câmera nem cortam leitura', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await searching(page);
  const layout = await page.locator('.barcode-target').evaluate((target) => ({
    width: target.getBoundingClientRect().width,
    viewport: innerWidth,
    objectFit: getComputedStyle(document.querySelector('.barcode-video')).objectFit,
  }));
  expect(layout.width / layout.viewport).toBeGreaterThan(0.85);
  expect(layout.objectFit).toBe('contain');
  await page.setViewportSize({ width: 390, height: 790 });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => window.scannerCamera.rotate());
  await expect.poll(() => page.locator('.barcode-video').evaluate((video) => video.videoHeight)).toBe(1280);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => window.scannerCamera.calls.length)).toBe(1);
  await page.evaluate((url) => window.scannerCamera.drawBarcode(url), FIXTURE);
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByLabel('Chave de acesso', { exact: true })).toHaveValue(KEY);
});

test('cancelar antes de getUserMedia resolver encerra stream tardio', async ({ page }) => {
  await setup(page, { delayPermission: true });
  await open(page);
  await expect.poll(() => page.evaluate(() => Boolean(window.scannerCamera.releasePermission))).toBe(true);
  await dialog(page).getByRole('button', { name: 'Cancelar' }).click();
  await page.evaluate(() => window.scannerCamera.releasePermission());
  await expect.poll(() => streamStates(page)).toEqual(['ended']);
  await expect(dialog(page)).toHaveCount(0);
});

test('erro fatal do decoder fica visível e libera a câmera', async ({ page }) => {
  await setup(page);
  await page.evaluate(async () => {
    const { createNfeBarcodeReader } = await import('/src/utils/nfeBarcodeReader.js');
    const base = Object.getPrototypeOf(Object.getPrototypeOf(createNfeBarcodeReader()));
    base.decodeFromCanvas = () => { throw new Error('Fatal decoder test'); };
  });
  await open(page);
  await expect(dialog(page).getByRole('alert')).toBeVisible();
  await expect(dialog(page).getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  expect(await streamStates(page)).toEqual(['ended']);
});

test('lanterna e zoom aparecem só com suporte; controles não reabrem câmera', async ({ page }) => {
  await setup(page, { controls: true });
  await open(page);
  await searching(page);
  const startCount = await page.evaluate(() => window.scannerCamera.calls.length);
  await dialog(page).getByRole('button', { name: 'Ativar lanterna', exact: true }).click();
  await expect(dialog(page).getByRole('button', { name: 'Desativar lanterna' })).toHaveAttribute('aria-pressed', 'true');
  const zoom = dialog(page).getByRole('slider', { name: 'Zoom da câmera' });
  await expect(zoom).toHaveAttribute('max', '10');
  await zoom.fill('2');
  await expect.poll(() => page.evaluate(() => window.scannerCamera.streams.at(-1).getVideoTracks()[0].getSettings().zoom)).toBe(2);
  await dialog(page).getByRole('button', { name: 'Desativar lanterna' }).click();
  await expect(dialog(page).getByRole('button', { name: 'Ativar lanterna', exact: true })).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.scannerCamera.calls.length)).toBe(startCount);
  const effective = await page.evaluate(() => window.scannerCamera.streams.at(-1).getVideoTracks()[0].getSettings());
  expect(effective).toMatchObject({ focusMode: 'continuous', exposureMode: 'continuous', whiteBalanceMode: 'continuous', zoom: 2, torch: false });
  await dialog(page).getByRole('button', { name: 'Cancelar' }).click();
  expect(await streamStates(page)).toEqual(['ended']);
});

test('controles sem suporte ficam ocultos; dicas são sugestões alternadas', async ({ page }) => {
  await setup(page, { noFocus: true });
  await open(page);
  await searching(page);
  await expect(dialog(page).getByRole('button', { name: /lanterna/ })).toHaveCount(0);
  await expect(dialog(page).getByRole('slider')).toHaveCount(0);
  await expect(dialog(page).getByText('Dica: Aproxime um pouco', { exact: true })).toBeVisible();
  await expect(dialog(page).getByText('Dica: Afaste um pouco', { exact: true })).toBeVisible({ timeout: 6500 });
  await page.evaluate((url) => window.scannerCamera.drawBarcode(url), FIXTURE);
  await expect(dialog(page)).toHaveCount(0);
});

test('falhas de lanterna e zoom não param decode nem aceitam conteúdo inválido', async ({ page }) => {
  await setup(page, { controls: true, failTorch: true, failZoom: true });
  await open(page);
  await searching(page);
  await dialog(page).getByRole('button', { name: 'Ativar lanterna', exact: true }).click();
  await expect(dialog(page).getByText('Não foi possível alterar a lanterna. A leitura continua.')).toBeVisible();
  await dialog(page).getByRole('slider').fill('2');
  await expect(dialog(page).getByText('Não foi possível ajustar o zoom. A leitura continua.')).toBeVisible();
  expect(await streamStates(page)).toEqual(['live']);
  await page.evaluate((url) => window.scannerCamera.drawBarcode(url), FIXTURE);
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByLabel('Chave de acesso', { exact: true })).toHaveValue(KEY);
});

for (const angle of [-8, 8]) {
  test(`ROI lê barras estreitas inclinadas ${angle} graus e com contraste reduzido`, async ({ page }) => {
    await setup(page);
    await open(page);
    await searching(page);
    await page.evaluate(async ({ url, degrees }) => {
      window.scannerCamera.drawing = { angle: degrees, height: 80, contrast: 0.3, y: 0.5 };
      await window.scannerCamera.drawBarcode(url);
    }, { url: FIXTURE, degrees: angle });
    await expect(dialog(page)).toHaveCount(0, { timeout: 8000 });
    await expect(page.getByLabel('Chave de acesso', { exact: true })).toHaveValue(KEY);
  });
}

test('usa ROI nativa menor e fallback de frame completo para código fora da guia', async ({ page }) => {
  await setup(page);
  await page.evaluate(async () => {
    const { createNfeBarcodeReader } = await import('/src/utils/nfeBarcodeReader.js');
    const base = Object.getPrototypeOf(Object.getPrototypeOf(createNfeBarcodeReader()));
    const original = base.decodeFromCanvas;
    window.decodeSizes = [];
    base.decodeFromCanvas = function (canvas) {
      window.decodeSizes.push({ width: canvas.width, height: canvas.height });
      return original.call(this, canvas);
    };
  });
  await open(page);
  await searching(page);
  await page.evaluate(async (url) => {
    window.scannerCamera.drawing = { angle: 0, contrast: 1, height: 60, y: 0.2 };
    await window.scannerCamera.drawBarcode(url);
  }, FIXTURE);
  await expect(dialog(page)).toHaveCount(0, { timeout: 8000 });
  const sizes = await page.evaluate(() => window.decodeSizes);
  expect(sizes.some((size) => size.width === 1280 && size.height < 400)).toBe(true);
  expect(sizes.some((size) => size.width === 1280 && size.height === 720)).toBe(true);
  await expect(page.getByLabel('Chave de acesso', { exact: true })).toHaveValue(KEY);
});

test('ícone circular muda estado visual e aria somente depois de confirmar torch', async ({ page }) => {
  await setup(page, { controls: true, capabilitiesAfterPlayback: true });
  await open(page);
  await searching(page);
  const button = dialog(page).locator('.barcode-torch-button');
  await expect(button.locator('svg')).toHaveCount(1);
  expect((await button.textContent()).trim()).toBe('');
  await expect(button).toHaveAttribute('aria-label', 'Ativar lanterna');
  const off = await button.evaluate((element) => ({
    color: getComputedStyle(element).borderTopColor,
    radius: getComputedStyle(element).borderRadius,
    width: element.getBoundingClientRect().width,
  }));
  expect(off.radius).toBe('50%');
  expect(off.width).toBeGreaterThanOrEqual(44);
  await page.evaluate(() => { window.scannerCamera.holdCommands = true; });
  await button.click();
  await expect.poll(() => page.evaluate(() => Boolean(window.scannerCamera.releaseCommand))).toBe(true);
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(button).toBeDisabled();
  await page.evaluate(() => window.scannerCamera.releaseCommand());
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(button).toHaveAttribute('aria-label', 'Desativar lanterna');
  await expect(button.locator('.barcode-torch-rays')).toHaveCSS('visibility', 'visible');
  await expect(button).toHaveCSS('border-top-color', 'rgb(23, 92, 211)');
  expect(off.color).toBe('rgb(137, 147, 164)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(button).toHaveCSS('border-top-color', 'rgb(118, 173, 255)');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(button).toHaveCSS('border-top-color', 'rgb(151, 163, 182)');
});

test('zoom mostra valor efetivo enquanto slider aguarda; última posição prevalece', async ({ page }) => {
  await setup(page, { controls: true });
  await open(page);
  await searching(page);
  await page.evaluate(() => { window.scannerCamera.holdCommands = true; });
  const slider = dialog(page).getByRole('slider');
  await slider.fill('2');
  await expect.poll(() => page.evaluate(() => Boolean(window.scannerCamera.releaseCommand))).toBe(true);
  await expect(dialog(page).getByText('Zoom: 1.0×', { exact: true })).toBeVisible();
  await slider.fill('3');
  await slider.fill('4');
  await page.evaluate(() => window.scannerCamera.releaseCommand());
  await expect(dialog(page).getByText('Zoom: 4.0×', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.scannerCamera.focus.filter((value) => 'zoom' in (value.advanced?.[0] ?? {})).length)).toBe(2);
  expect(await page.evaluate(() => window.scannerCamera.calls.length)).toBe(1);
});

test('troca de câmera limpa torch e recalcula limites e zoom da track exibida', async ({ page }) => {
  await setup(page, { initialZoom: { rear: 1.25, front: 2.5 }, deviceCapabilities: {
    rear: { torch: true, zoom: { min: 0.5, max: 5, step: 0.25 } },
    front: { torch: false, zoom: { min: 2, max: 6, step: 0.5 } },
    ultra: {},
  } });
  await open(page);
  await searching(page);
  await expect(dialog(page).getByText('Zoom: 1.25×', { exact: true })).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Ativar lanterna' }).click();
  await expect(dialog(page).locator('.barcode-torch-button')).toHaveAttribute('aria-pressed', 'true');
  await dialog(page).getByRole('button', { name: 'Trocar câmera' }).click();
  await searching(page);
  await expect(dialog(page).getByRole('button', { name: /lanterna/ })).toHaveCount(0);
  const slider = dialog(page).getByRole('slider');
  await expect(slider).toHaveAttribute('min', '2');
  await expect(slider).toHaveAttribute('max', '6');
  await expect(slider).toHaveAttribute('step', '0.5');
  await expect(dialog(page).getByText('Zoom: 2.5×', { exact: true })).toBeVisible();
  await slider.fill('3.5');
  await expect(dialog(page).getByText('Zoom: 3.5×', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.scannerCamera.appliedTracks.at(-1))).toBe('front');
  expect(await streamStates(page)).toEqual(['ended', 'live']);
  await dialog(page).getByRole('button', { name: 'Trocar câmera' }).click();
  await searching(page);
  await expect(dialog(page).getByRole('slider')).toHaveCount(0);
});

test('fallback exact modifica câmera sem reabrir; zoom sincroniza arredondamento real', async ({ page }) => {
  await setup(page, { controls: true, exactOnly: true, roundZoom: true });
  await open(page);
  await searching(page);
  await dialog(page).getByRole('button', { name: 'Ativar lanterna' }).click();
  await expect(dialog(page).locator('.barcode-torch-button')).toHaveAttribute('aria-pressed', 'true');
  await dialog(page).getByRole('slider').fill('2.3');
  await expect(dialog(page).getByText('Zoom: 2.5×', { exact: true })).toBeVisible();
  await expect(dialog(page).getByRole('slider')).toHaveValue('2.5');
  expect(await page.evaluate(() => window.scannerCamera.focus.some((value) => value.torch?.exact === true))).toBe(true);
  expect(await page.evaluate(() => window.scannerCamera.focus.some((value) => value.zoom?.exact === 2.3))).toBe(true);
  expect(await page.evaluate(() => window.scannerCamera.calls.length)).toBe(1);
});

for (const missingSettings of [false, true]) {
  test(`constraints ignoradas ou settings ausentes (${missingSettings}) não simulam sucesso`, async ({ page }) => {
    await setup(page, { controls: true, missingSettings, ignoreControls: !missingSettings });
    await open(page);
    await searching(page);
    const caption = missingSettings ? 'Zoom não informado' : 'Zoom: 1.0×';
    await dialog(page).getByRole('button', { name: 'Ativar lanterna' }).click();
    await expect(dialog(page).getByText('Não foi possível alterar a lanterna. A leitura continua.')).toBeVisible();
    await expect(dialog(page).locator('.barcode-torch-button')).toHaveAttribute('aria-pressed', 'false');
    await dialog(page).getByRole('slider').fill('4');
    await expect(dialog(page).getByText('Não foi possível ajustar o zoom. A leitura continua.')).toBeVisible();
    await expect(dialog(page).getByText(caption, { exact: true })).toBeVisible();
    await page.evaluate((url) => window.scannerCamera.drawBarcode(url), FIXTURE);
    await expect(dialog(page)).toHaveCount(0);
  });
}

test('erro ao desligar mantém estado anterior e cancelar encerra stream', async ({ page }) => {
  await setup(page, { controls: true, failTorchOff: true });
  await open(page);
  await searching(page);
  await dialog(page).getByRole('button', { name: 'Ativar lanterna' }).click();
  await expect(dialog(page).locator('.barcode-torch-button')).toHaveAttribute('aria-pressed', 'true');
  await dialog(page).getByRole('button', { name: 'Desativar lanterna' }).click();
  await expect(dialog(page).getByText('Não foi possível alterar a lanterna. A leitura continua.')).toBeVisible();
  await expect(dialog(page).locator('.barcode-torch-button')).toHaveAttribute('aria-pressed', 'true');
  await dialog(page).getByRole('button', { name: 'Cancelar' }).click();
  expect(await streamStates(page)).toEqual(['ended']);
  await open(page);
  await searching(page);
  await expect(dialog(page).locator('.barcode-torch-button')).toHaveAttribute('aria-pressed', 'false');
});

test('resposta tardia da lanterna antiga não altera nova câmera', async ({ page }) => {
  await setup(page, { controls: true });
  await open(page);
  await searching(page);
  await page.evaluate(() => { window.scannerCamera.holdCommands = true; });
  await dialog(page).getByRole('button', { name: 'Ativar lanterna' }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.scannerCamera.releaseCommand))).toBe(true);
  await dialog(page).getByRole('button', { name: 'Trocar câmera' }).click();
  await searching(page);
  await page.evaluate(() => window.scannerCamera.releaseCommand());
  await expect(dialog(page).locator('.barcode-torch-button')).toHaveAttribute('aria-pressed', 'false');
  expect(await streamStates(page)).toEqual(['ended', 'live']);
  await page.evaluate((url) => window.scannerCamera.drawBarcode(url), FIXTURE);
  await expect(dialog(page)).toHaveCount(0);
});
