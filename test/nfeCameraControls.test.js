import test from 'node:test';
import assert from 'node:assert/strict';
import { createNfeCameraControls, nfeResolutionUpgrade, nfeZoomRange } from '../src/utils/nfeCamera.js';
import { nfeReadRegion, nfeDecodeStrategy, nfeDecodeDelay } from '../src/utils/nfeReadRegion.js';

function trackMock(capabilities = {}, initial = {}) {
  const settings = { width: 1280, height: 720, zoom: 1, torch: false, ...initial };
  const calls = [];
  const constraints = { width: { ideal: 1920 }, height: { ideal: 1080 } };
  return { calls, settings, readyState: 'live',
    getCapabilities: () => capabilities, getSettings: () => ({ ...settings }),
    getConstraints: () => constraints,
    async applyConstraints(value) {
      calls.push(value);
      for (const entry of value.advanced ?? []) Object.assign(settings, entry);
      for (const key of ['torch', 'zoom']) {
        if (value[key]?.exact !== undefined) settings[key] = value[key].exact;
      }
    },
  };
}

test('torch só é oferecido quando pode ser ligado, inclusive capabilities em array', async () => {
  for (const torch of [undefined, false, [false]]) {
    const track = trackMock({ torch });
    const controls = createNfeCameraControls(track);
    assert.equal(controls.torchSupported, false);
    assert.equal((await controls.setTorch(true)).ok, false);
    assert.equal(track.calls.length, 0);
  }
  for (const torch of [true, [true, false]]) {
    const track = trackMock({ torch });
    const controls = createNfeCameraControls(track);
    assert.deepEqual(await controls.setTorch(true), { ok: true, value: true });
    assert.deepEqual(await controls.setTorch(false), { ok: true, value: false });
    assert.equal(track.settings.torch, false);
  }
});

test('lanterna e zoom preservam resolução e os três modos contínuos', async () => {
  const track = trackMock({ torch: true, zoom: { min: 1, max: 10, step: 0.1 },
    focusMode: ['continuous'], exposureMode: ['continuous'], whiteBalanceMode: ['continuous'] });
  const controls = createNfeCameraControls(track);
  await controls.configure();
  await controls.setTorch(true);
  await controls.setZoom(2);
  await controls.setTorch(false);
  const last = track.calls.at(-1);
  assert.deepEqual(last.width, { ideal: 1920 });
  assert.deepEqual(last.height, { ideal: 1080 });
  assert.deepEqual(Object.assign({}, ...last.advanced), {
    focusMode: 'continuous', exposureMode: 'continuous', whiteBalanceMode: 'continuous', zoom: 2, torch: false,
  });
});

test('somente modos anunciados são aplicados e rejeição isolada não impede os demais', async () => {
  const track = trackMock({ focusMode: ['continuous'], exposureMode: ['continuous'], whiteBalanceMode: ['manual'] });
  const apply = track.applyConstraints.bind(track);
  track.applyConstraints = async (value) => {
    if (value.advanced.some((entry) => entry.focusMode)) throw new Error('focus rejected');
    return apply(value);
  };
  await createNfeCameraControls(track).configure();
  assert.equal(track.settings.exposureMode, 'continuous');
  assert.equal(track.settings.whiteBalanceMode, undefined);
  const unsupported = trackMock();
  await createNfeCameraControls(unsupported).configure();
  assert.equal(unsupported.calls.length, 0);
});

test('falha/constraint ignorada de torch não lança nem afirma que ligou', async () => {
  const track = trackMock({ torch: true });
  track.applyConstraints = async () => { throw new Error('unsupported'); };
  assert.equal((await createNfeCameraControls(track).setTorch(true)).ok, false);
  track.applyConstraints = async () => {};
  assert.deepEqual(await createNfeCameraControls(track).setTorch(true), { ok: false, value: false });
});

test('zoom é opcional, respeita intervalo real e não começa com aproximação automática', async () => {
  assert.equal(nfeZoomRange({}), null);
  assert.equal(nfeZoomRange({ zoom: { min: 1, max: 1 } }), null);
  assert.equal(nfeZoomRange({ zoom: { min: 1, max: 10, step: 0.7 } }).max, 10);
  assert.equal(nfeZoomRange({ zoom: { min: 1, max: 2, step: 4 } }), null);
  const track = trackMock({ zoom: { min: 1, max: 12, step: 0.1 } });
  const controls = createNfeCameraControls(track);
  await controls.configure();
  assert.equal(track.calls.length, 0);
  assert.equal(controls.zoom.max, 12);
  assert.equal((await controls.setZoom(20)).value, 12);
  assert.equal((await controls.setZoom(-1)).value, 1);
  assert.equal((await controls.setZoom(NaN)).ok, false);
});

test('melhoria de resolução depende de capacidade real e considera orientação', () => {
  const caps = { width: { max: 1920 }, height: { max: 1920 } };
  assert.deepEqual(nfeResolutionUpgrade({ width: 640, height: 480 }, caps), {
    width: { ideal: 1920 }, height: { ideal: 1080 }, aspectRatio: { ideal: 16 / 9 },
  });
  assert.deepEqual(nfeResolutionUpgrade({ width: 720, height: 1280 }, caps), {
    width: { ideal: 1080 }, height: { ideal: 1920 }, aspectRatio: { ideal: 9 / 16 },
  });
  assert.equal(nfeResolutionUpgrade({ width: 1920, height: 1080 }, caps), null);
  assert.equal(nfeResolutionUpgrade({ width: 640, height: 480 }, {}), null);
  assert.equal(nfeResolutionUpgrade({ width: 720, height: 1280 },
    { width: { max: 1920 }, height: { max: 1080 } }), null);
  assert.equal(nfeResolutionUpgrade({ width: 640, height: 480 }, { width: { max: 640 }, height: { max: 480 } }), null);
});

test('rejeição da melhoria de resolução conserva o stream e permite foco', async () => {
  const track = trackMock({ width: { max: 1920 }, height: { max: 1080 }, focusMode: ['continuous'] });
  const apply = track.applyConstraints.bind(track);
  let upgrades = 0;
  track.applyConstraints = async (value) => {
    if (!value.advanced) { upgrades += 1; throw new Error('resolution rejected'); }
    return apply(value);
  };
  await createNfeCameraControls(track).configure();
  assert.equal(upgrades, 1);
  assert.equal(track.readyState, 'live');
  assert.equal(track.settings.focusMode, 'continuous');
});

test('operações são serializadas e mudanças pendentes são ignoradas após cancelamento', async () => {
  const track = trackMock({ torch: true, zoom: { min: 1, max: 3, step: 0.1 } });
  let release;
  let cancelled = false;
  track.applyConstraints = (value) => {
    track.calls.push(value);
    return new Promise((resolve) => { release = resolve; });
  };
  const controls = createNfeCameraControls(track, () => cancelled);
  const torch = controls.setTorch(true);
  const zoom = controls.setZoom(2);
  await Promise.resolve();
  assert.equal(track.calls.length, 1);
  cancelled = true;
  release();
  assert.equal((await torch).ok, false);
  assert.equal((await zoom).ok, false);
  assert.equal(track.calls.length, 1);
});

test('ROI acompanha a moldura mantendo margem lateral até as bordas do frame', () => {
  assert.deepEqual(nfeReadRegion(1920, 1080,
    { left: 0, top: 0, width: 1920, height: 1080 },
    { left: 38.4, top: 300, width: 1843.2, height: 480 }),
  { x: 0, y: 300, width: 1920, height: 480 });
});

test('ROI considera vídeo vertical e letterbox de object-fit contain', () => {
  assert.deepEqual(nfeReadRegion(1080, 1920,
    { left: 0, top: 0, width: 360, height: 640 },
    { left: 7.2, top: 280, width: 345.6, height: 80 }),
  { x: 0, y: 840, width: 1080, height: 240 });
  assert.deepEqual(nfeReadRegion(1920, 1080,
    { left: 0, top: 0, width: 400, height: 400 },
    { left: 8, top: 150, width: 384, height: 100 }),
  { x: 0, y: 300, width: 1920, height: 480 });
});

test('ROI inválida usa frame inteiro; estratégia alterna inclinações e fallback', () => {
  assert.deepEqual(nfeReadRegion(1920, 1080, {}, {}), { x: 0, y: 0, width: 1920, height: 1080 });
  const strategies = Array.from({ length: 6 }, (_, i) => nfeDecodeStrategy(i));
  assert.equal(strategies.filter((entry) => entry.fullFrame).length, 1);
  assert.deepEqual(strategies.map((entry) => entry.angle), [0, 0, -8, 0, 8, 0]);
  assert.deepEqual(nfeDecodeStrategy(6), strategies[0]);
});

test('cadência desacelera em aparelhos lentos, sem loop de tentativas simultâneas', () => {
  assert.equal(nfeDecodeDelay(5), 160);
  assert.equal(nfeDecodeDelay(180), 360);
  assert.equal(nfeDecodeDelay(2000), 1000);
});

test('torch/zoom têm prioridade em advanced mesmo após foco/exposição', async () => {
  const track = trackMock({ torch: true, zoom: { min: 1, max: 8, step: 0.1 },
    focusMode: ['continuous'], exposureMode: ['continuous'] });
  const controls = createNfeCameraControls(track);
  await controls.configure();
  await controls.setTorch(true);
  assert.deepEqual(track.calls.at(-1).advanced[0], { torch: true });
  await controls.setZoom(2);
  assert.deepEqual(track.calls.at(-1).advanced[0], { zoom: 2 });
});

test('fallback exact confirma a alteração quando advanced é ignorado', async () => {
  const track = trackMock({ torch: true, zoom: { min: 1, max: 8, step: 0.1 } });
  track.applyConstraints = async (constraints) => {
    track.calls.push(constraints);
    for (const key of ['torch', 'zoom']) {
      if (constraints[key]?.exact !== undefined) track.settings[key] = constraints[key].exact;
    }
  };
  const controls = createNfeCameraControls(track);
  assert.deepEqual(await controls.setTorch(true), { ok: true, value: true });
  assert.deepEqual(track.calls[1].torch, { exact: true });
  assert.deepEqual(await controls.setZoom(2), { ok: true, value: 2 });
  assert.deepEqual(track.calls[3].zoom, { exact: 2 });
  assert.deepEqual(await controls.setTorch(false), { ok: true, value: false });
  assert.equal(track.settings.zoom, 2);
  assert.deepEqual(track.calls.at(-1).width, { ideal: 1920 });
});

test('fallback não confirma sucesso se ambas as formas forem ignoradas', async () => {
  const track = trackMock({ torch: true, zoom: { min: 1, max: 8, step: 0.1 } });
  track.applyConstraints = async (value) => { track.calls.push(value); };
  const controls = createNfeCameraControls(track);
  assert.deepEqual(await controls.setZoom(4), { ok: false, value: 1 });
  assert.equal(track.calls.length, 3); // advanced, exact, restore
  assert.deepEqual(await controls.setTorch(true), { ok: false, value: false });
  assert.equal(controls.getState().torchOn, false);
});

test('settings ausentes nunca são substituídos pelo valor solicitado', async () => {
  const track = trackMock({ torch: true, zoom: { min: 1, max: 8, step: 0.1 } });
  track.getSettings = () => ({});
  const controls = createNfeCameraControls(track);
  assert.equal(controls.zoom.value, null);
  assert.deepEqual(await controls.setTorch(true), { ok: false, value: false });
  assert.deepEqual(await controls.setZoom(4), { ok: false, value: null });
  assert.equal(controls.zoom.value, null);
});

test('falha ao desligar mantém lanterna ligada e erro não desativa track', async () => {
  const track = trackMock({ torch: true }, { torch: true });
  track.applyConstraints = async () => { throw new Error('rejected'); };
  const controls = createNfeCameraControls(track);
  assert.deepEqual(await controls.setTorch(false), { ok: false, value: true });
  assert.equal(controls.getState().torchOn, true);
  assert.equal(track.readyState, 'live');
});

test('zoom respeita step com origem diferente de 1 e informa arredondamento real', async () => {
  const track = trackMock({ zoom: { min: 0.5, max: 5, step: 0.25 } }, { zoom: 1.25 });
  const controls = createNfeCameraControls(track);
  assert.deepEqual(controls.zoom, { min: 0.5, max: 5, step: 0.25, value: 1.25 });
  await controls.setZoom(2.37);
  assert.deepEqual(track.calls.at(-1).advanced[0], { zoom: 2.25 });
  track.applyConstraints = async () => { track.settings.zoom = 2.5; };
  assert.deepEqual(await controls.setZoom(3), { ok: true, value: 2.5 });
});

test('capabilities são consultadas novamente e track diferente impede alteração', async () => {
  const track = trackMock();
  let active = track;
  let capabilities = {};
  track.getCapabilities = () => capabilities;
  const controls = createNfeCameraControls(track, () => false, () => active);
  assert.equal(controls.torchSupported, false);
  capabilities = { torch: true, zoom: { min: 2, max: 6, step: 0.5 } };
  assert.equal(controls.torchSupported, true);
  assert.equal(controls.zoom.min, 2);
  active = trackMock();
  assert.equal(controls.isActive(), false);
  assert.equal((await controls.setTorch(true)).ok, false);
  assert.equal(track.calls.length, 0);
  assert.deepEqual(controls.getState(), { torchSupported: false, torchOn: false, zoom: null });
});

test('último zoom prevalece e fila descarta posições intermediárias', async () => {
  const track = trackMock({ zoom: { min: 1, max: 8, step: 0.1 } });
  let release;
  const apply = track.applyConstraints.bind(track);
  track.applyConstraints = async (value) => {
    if (!track.calls.length) await new Promise((resolve) => { release = resolve; });
    await apply(value);
  };
  const controls = createNfeCameraControls(track);
  const first = controls.setZoom(2);
  await Promise.resolve();
  const middle = controls.setZoom(3);
  const last = controls.setZoom(4);
  release();
  await first;
  assert.equal((await middle).ok, false);
  assert.deepEqual(await last, { ok: true, value: 4 });
  assert.equal(track.calls.length, 2);
  assert.equal(track.settings.zoom, 4);
});

test('getSettings ausente/lançando erro e capabilities inválidas não quebram scanner', async () => {
  const track = trackMock({ torch: 'true', zoom: { min: 1, max: Infinity, step: 0.1 } });
  track.getSettings = () => { throw new Error('unavailable'); };
  const controls = createNfeCameraControls(track);
  assert.deepEqual(controls.getState(), { torchSupported: false, torchOn: false, zoom: null });
  assert.equal((await controls.setTorch(true)).ok, false);
  assert.equal((await controls.setZoom(2)).ok, false);
});
