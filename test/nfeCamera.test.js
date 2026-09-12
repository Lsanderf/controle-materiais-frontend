import test from 'node:test';
import assert from 'node:assert/strict';
import { BarcodeFormat } from '@zxing/browser';
import library from '@zxing/library';
import {
  applyNfeContinuousFocus, nfeCameraConstraints, openNfeCamera, selectNfeCamera,
} from '../src/utils/nfeCamera.js';
import { createNfeScanSession } from '../src/utils/nfeBarcode.js';
import { handleNfeDecodeResult } from '../src/utils/nfeBarcodeReader.js';

const KEY = '52060433009911002506550120000007800267301615';
const device = (deviceId, label = '') => ({ deviceId, label, kind: 'videoinput' });
function mockStream(settings = { deviceId: 'rear', facingMode: 'environment' }, capabilities = {}) {
  const track = {
    label: '', stops: 0, constraints: [],
    stop() { this.stops += 1; },
    getSettings: () => settings,
    getCapabilities: () => capabilities,
    async applyConstraints(value) { this.constraints.push(value); },
  };
  return { getVideoTracks: () => [track], getTracks: () => [track], track };
}
const errorNamed = (name) => Object.assign(new Error(name), { name });

test('captura solicita traseira, 1920x1080 e 16:9 como ideal, sem áudio', () => {
  assert.deepEqual(nfeCameraConstraints(), {
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 },
      height: { ideal: 1080 }, aspectRatio: { ideal: 16 / 9 } },
  });
  assert.deepEqual(nfeCameraConstraints('front').video.deviceId, { ideal: 'front' });
  assert.equal(nfeCameraConstraints('front').video.facingMode, undefined);
});

test('resolução negociada inferior é aceita sem reabrir câmera', async () => {
  const stream = mockStream({ deviceId: 'rear', width: 640, height: 480 });
  let calls = 0;
  const result = await openNfeCamera({ mediaDevices: {
    getUserMedia: async () => { calls += 1; return stream; },
    enumerateDevices: async () => [],
  } });
  assert.equal(result.stream.track.getSettings().width, 640);
  assert.equal(result.resolutionFallback, false);
  assert.equal(calls, 1);
});

test('OverconstrainedError remove resolução e aspect ratio, preservando seleção ideal', async () => {
  const calls = [];
  const stream = mockStream();
  const result = await openNfeCamera({ deviceId: 'rear', mediaDevices: {
    getUserMedia: async (constraints) => {
      calls.push(constraints);
      if (calls.length === 1) throw errorNamed('OverconstrainedError');
      return stream;
    },
    enumerateDevices: async () => [],
  } });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], { audio: false, video: { deviceId: { ideal: 'rear' } } });
  assert.equal(result.resolutionFallback, true);
});

test('erro de permissão não provoca novas solicitações', async () => {
  let calls = 0;
  await assert.rejects(openNfeCamera({ mediaDevices: {
    getUserMedia: async () => { calls += 1; throw errorNamed('NotAllowedError'); },
  } }), { name: 'NotAllowedError' });
  assert.equal(calls, 1);
});

test('enumeração só acontece depois de obter permissão e falha não impede captura', async () => {
  const stream = mockStream();
  let acquired = false;
  const result = await openNfeCamera({ mediaDevices: {
    getUserMedia: async () => { acquired = true; return stream; },
    enumerateDevices: async () => { assert.equal(acquired, true); throw new Error('unavailable'); },
  } });
  assert.equal(result.stream, stream);
  assert.deepEqual(result.devices, []);
});

test('prefere traseira principal a ultra-wide e frontal', () => {
  const cameras = [device('front', 'Front camera'), device('ultra', 'Back Ultra Wide Camera'),
    device('rear', 'Back Camera'), device('tele', 'Back Telephoto Camera')];
  assert.equal(selectNfeCamera(cameras, mockStream({ deviceId: 'ultra', facingMode: 'environment' }).track).deviceId, 'rear');
  assert.equal(selectNfeCamera(cameras, mockStream({ deviceId: 'front', facingMode: 'user' }).track).deviceId, 'rear');
});

test('labels genéricos ou vazios preservam traseira confirmada por getSettings', () => {
  const cameras = [device('a', 'Camera 1'), device('b'), device('c', 'Camera 3')];
  assert.equal(selectNfeCamera(cameras, mockStream({ deviceId: 'b', facingMode: 'environment' }).track).deviceId, 'b');
});

test('capability facingMode pode confirmar traseira quando settings não informa', () => {
  const cameras = [device('a', 'Back Camera'), device('b', 'Camera 2')];
  const track = mockStream({ deviceId: 'b' }, { facingMode: ['environment'] }).track;
  assert.equal(selectNfeCamera(cameras, track).deviceId, 'b');
});

test('traseira principal explícita ganha de outra traseira e mantém escolha estável no empate', () => {
  const cameras = [device('a', 'Câmera traseira'), device('b', 'Câmera traseira principal')];
  assert.equal(selectNfeCamera(cameras, mockStream({ deviceId: 'a', facingMode: 'environment' }).track).deviceId, 'b');
  assert.equal(selectNfeCamera([device('a'), device('b')], mockStream({ deviceId: 'b' }).track).deviceId, 'b');
});

test('troca automática libera primeira câmera antes de abrir traseira melhor', async () => {
  const initial = mockStream({ deviceId: 'ultra', facingMode: 'environment' });
  const main = mockStream();
  const calls = [];
  const result = await openNfeCamera({ mediaDevices: {
    getUserMedia: async (constraints) => {
      calls.push(constraints);
      if (calls.length === 1) return initial;
      assert.equal(initial.track.stops, 1);
      assert.deepEqual(constraints.video.deviceId, { ideal: 'rear' });
      return main;
    },
    enumerateDevices: async () => [device('ultra', 'Back Ultra Wide Camera'), device('rear', 'Back Camera')],
  } });
  assert.equal(result.stream, main);
  assert.equal(calls.length, 2);
});

test('falha de câmera preferida recupera câmera inicial', async () => {
  let calls = 0;
  const initial = mockStream({ deviceId: 'ultra', facingMode: 'environment' });
  const recovered = mockStream({ deviceId: 'ultra', facingMode: 'environment' });
  const result = await openNfeCamera({ mediaDevices: {
    getUserMedia: async (constraints) => {
      calls += 1;
      if (calls === 1) return initial;
      if (calls === 2) throw errorNamed('NotReadableError');
      assert.deepEqual(constraints.video.deviceId, { ideal: 'ultra' });
      return recovered;
    },
    enumerateDevices: async () => [device('ultra', 'Back Ultra Wide'), device('rear', 'Back Camera')],
  } });
  assert.equal(result.stream, recovered);
  assert.equal(calls, 3);
});

test('Trocar câmera respeita escolha manual mesmo sendo frontal', async () => {
  const stream = mockStream({ deviceId: 'front', facingMode: 'user' });
  let calls = 0;
  const result = await openNfeCamera({ deviceId: 'front', mediaDevices: {
    getUserMedia: async () => { calls += 1; return stream; },
    enumerateDevices: async () => [device('front', 'Front Camera'), device('rear', 'Back Camera')],
  } });
  assert.equal(result.stream, stream);
  assert.equal(calls, 1);
});

test('cancelamento durante getUserMedia libera stream tardio e não enumera', async () => {
  const stream = mockStream();
  let cancelled = false;
  await assert.rejects(openNfeCamera({ isCancelled: () => cancelled, mediaDevices: {
    getUserMedia: async () => { cancelled = true; return stream; },
    enumerateDevices: () => assert.fail('não deve enumerar'),
  } }), { name: 'AbortError' });
  assert.equal(stream.track.stops, 1);
});

test('cancelamento durante enumeração libera câmera sem trocar', async () => {
  const stream = mockStream();
  let cancelled = false;
  await assert.rejects(openNfeCamera({ isCancelled: () => cancelled, mediaDevices: {
    getUserMedia: async () => stream,
    enumerateDevices: async () => { cancelled = true; return [device('rear')]; },
  } }), { name: 'AbortError' });
  assert.equal(stream.track.stops, 1);
});

test('aplica foco contínuo somente quando anunciado pela track', async () => {
  const { track } = mockStream({}, { focusMode: ['manual', 'continuous'] });
  assert.equal(await applyNfeContinuousFocus(track), true);
  assert.deepEqual(track.constraints, [{ advanced: [{ focusMode: 'continuous' }] }]);
});

test('ausência de focusMode, getCapabilities ou foco contínuo não causa erro', async () => {
  for (const track of [mockStream().track, mockStream({}, { focusMode: ['manual'] }).track,
    { getCapabilities() { throw new Error('unsupported'); } }, {}]) {
    assert.equal(await applyNfeContinuousFocus(track), false);
    assert.deepEqual(track.constraints ?? [], []);
  }
});

test('rejeição de foco anunciado não encerra câmera', async () => {
  const { track } = mockStream({}, { focusMode: ['continuous'] });
  track.applyConstraints = async () => { throw errorNamed('OverconstrainedError'); };
  assert.equal(await applyNfeContinuousFocus(track), false);
  assert.equal(track.stops, 0);
});

test('NotFoundException real do ZXing mantém scanner ativo e sem erro visível', () => {
  const session = createNfeScanSession({ onDetected: () => assert.fail(), onInvalid: () => assert.fail() });
  for (let index = 0; index < 10; index += 1) {
    handleNfeDecodeResult(session, undefined, new library.NotFoundException(), () => assert.fail('não é fatal'));
  }
  assert.equal(session.isStopped(), false);
  for (const error of [new library.ChecksumException(), new library.FormatException()]) {
    handleNfeDecodeResult(session, undefined, error, () => assert.fail('erro recuperável'));
  }
  assert.equal(session.isStopped(), false);
});

test('CODE-128 aceito valida chave e evita callbacks duplicados', () => {
  const values = [];
  const session = createNfeScanSession({ onDetected: (value) => values.push(value) });
  const result = { getText: () => KEY, getBarcodeFormat: () => BarcodeFormat.CODE_128 };
  handleNfeDecodeResult(session, result);
  handleNfeDecodeResult(session, result);
  assert.deepEqual(values, [KEY]);
  assert.equal(session.isStopped(), true);
});

test('formato diferente é ignorado; CODE-128 com tamanho/DV inválidos mantém leitura', () => {
  const reasons = [];
  const session = createNfeScanSession({ onDetected: () => assert.fail(), onInvalid: (reason) => reasons.push(reason) });
  handleNfeDecodeResult(session, { getText: () => KEY, getBarcodeFormat: () => BarcodeFormat.QR_CODE });
  assert.deepEqual(reasons, []);
  for (const text of ['123', `${KEY.slice(0, -1)}4`]) {
    handleNfeDecodeResult(session, { getText: () => text, getBarcodeFormat: () => BarcodeFormat.CODE_128 });
  }
  assert.deepEqual(reasons, ['INVALID_LENGTH', 'INVALID_CHECK_DIGIT']);
  assert.equal(session.isStopped(), false);
});

test('erro fatal é encaminhado; controles que chegam após cancelamento são parados', () => {
  const session = createNfeScanSession({ onDetected: () => assert.fail() });
  const error = new Error('canvas unavailable');
  let fatal;
  handleNfeDecodeResult(session, undefined, error, (value) => { fatal = value; session.stop(); });
  let stops = 0;
  session.attachControls({ stop() { stops += 1; } });
  assert.equal(fatal, error);
  assert.equal(session.isStopped(), true);
  assert.equal(stops, 1);
});
