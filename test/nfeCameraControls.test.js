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

test('zoom é opcional, limitado e não começa com aproximação automática', async () => {
  assert.equal(nfeZoomRange({}), null);
  assert.equal(nfeZoomRange({ zoom: { min: 1, max: 1 } }), null);
  assert.equal(nfeZoomRange({ zoom: { min: 1, max: 10, step: 0.7 } }).max, 2.4);
  assert.equal(nfeZoomRange({ zoom: { min: 1, max: 2, step: 4 } }), null);
  const track = trackMock({ zoom: { min: 1, max: 12, step: 0.1 } });
  const controls = createNfeCameraControls(track);
  await controls.configure();
  assert.equal(track.calls.length, 0);
  assert.equal(controls.zoom.max, 3);
  assert.equal((await controls.setZoom(20)).value, 3);
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
