import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  cameraAccessErrorMessage,
  createNfeScanSession,
  normalizeNfeBarcode,
} from '../src/utils/nfeBarcode.js';

const VALID_ACCESS_KEY = '12345678901234567890123456789012345678901234';

test('chave NF-e válida com 44 dígitos é aceita', () => {
  assert.equal(normalizeNfeBarcode(VALID_ACCESS_KEY), VALID_ACCESS_KEY);
});

test('caracteres de formatação são removidos da chave detectada', () => {
  const formatted = VALID_ACCESS_KEY.replace(/(.{4})(?=.)/g, '$1 . ');
  assert.equal(normalizeNfeBarcode(formatted), VALID_ACCESS_KEY);
});

test('códigos menores ou maiores que 44 dígitos são ignorados', () => {
  assert.equal(normalizeNfeBarcode(VALID_ACCESS_KEY.slice(0, 43)), null);
  assert.equal(normalizeNfeBarcode(`${VALID_ACCESS_KEY}5`), null);
});

test('callback válido acontece uma vez e interrompe o scanner', () => {
  let detections = 0;
  let stops = 0;
  const session = createNfeScanSession({
    onDetected: () => {
      detections += 1;
    },
  });
  session.attachControls({ stop: () => { stops += 1; } });

  assert.equal(session.handleDetection(VALID_ACCESS_KEY), true);
  assert.equal(session.handleDetection(VALID_ACCESS_KEY), false);
  assert.equal(detections, 1);
  assert.equal(stops, 1);
});

test('código inválido mantém scanner ativo', () => {
  let invalidDetections = 0;
  const session = createNfeScanSession({
    onDetected: () => assert.fail('não deveria aceitar o código'),
    onInvalid: () => {
      invalidDetections += 1;
    },
  });

  assert.equal(session.handleDetection('123'), false);
  assert.equal(session.isStopped(), false);
  assert.equal(invalidDetections, 1);
});

test('cancelamento encerra controles e recursos apenas uma vez', () => {
  let controlsStopped = 0;
  let resourcesReleased = 0;
  const session = createNfeScanSession({
    onDetected: () => {},
    onStop: () => {
      resourcesReleased += 1;
    },
  });
  session.attachControls({ stop: () => { controlsStopped += 1; } });

  assert.equal(session.stop(), true);
  assert.equal(session.stop(), false);
  assert.equal(controlsStopped, 1);
  assert.equal(resourcesReleased, 1);
});

test('desmontagem do componente encerra a sessão da câmera', () => {
  const source = readFileSync(
    new URL('../src/components/NotaFiscalBarcodeScanner.jsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /return \(\) => \{[\s\S]*stopScanner\(\);[\s\S]*\};/);
  assert.match(source, /releaseVideoStream\(videoRef\.current\)/);
});

test('erros de permissão e HTTP sem contexto seguro recebem mensagens amigáveis', () => {
  assert.match(
    cameraAccessErrorMessage({ name: 'NotAllowedError' }, true),
    /permissão do navegador/,
  );
  assert.match(
    cameraAccessErrorMessage({ name: 'InsecureContextError' }, false),
    /HTTPS/,
  );
});

test('scanner restringe leitura a CODE-128 e pode trocar câmeras', () => {
  const source = readFileSync(
    new URL('../src/components/NotaFiscalBarcodeScanner.jsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /reader\.possibleFormats = \[BarcodeFormat\.CODE_128\]/);
  assert.match(source, /BrowserCodeReader\.listVideoInputDevices\(\)/);
  assert.match(source, /Trocar câmera/);
});

test('chave detectada preenche o formulário sem remover a digitação manual', () => {
  const source = readFileSync(
    new URL('../src/pages/NotaFiscalFormPage.jsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /change\('chaveAcesso', accessKey\)/);
  assert.match(
    source,
    /onChange=\{\(event\) => change\('chaveAcesso', event\.target\.value\)\}/,
  );
  assert.match(source, /Escanear código de barras/);
});
