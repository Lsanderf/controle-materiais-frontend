import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calculateNfeCheckDigit,
  cameraAccessErrorMessage,
  createNfeScanSession,
  isValidNfeAccessKey,
  normalizeNfeBarcode,
} from '../src/utils/nfeBarcode.js';

const VALID_ACCESS_KEY = '52060433009911002506550120000007800267301615';

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

test('chave com DV inválido ou um único dígito alterado é rejeitada', () => {
  const invalidCheckDigit = `${VALID_ACCESS_KEY.slice(0, 43)}4`;
  const changedDigit = `6${VALID_ACCESS_KEY.slice(1)}`;

  assert.equal(isValidNfeAccessKey(invalidCheckDigit), false);
  assert.equal(isValidNfeAccessKey(changedDigit), false);
  assert.equal(normalizeNfeBarcode(invalidCheckDigit), null);
});

test('DV igual a zero é calculado para os restos zero e um', () => {
  const remainderZero = '0'.repeat(43);
  const remainderOne = `${'0'.repeat(42)}6`;

  assert.equal(calculateNfeCheckDigit(remainderZero), 0);
  assert.equal(calculateNfeCheckDigit(remainderOne), 0);
  assert.equal(isValidNfeAccessKey(`${remainderZero}0`), true);
  assert.equal(isValidNfeAccessKey(`${remainderOne}0`), true);
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

test('scanner rejeita 44 dígitos com DV inválido e informa o motivo', () => {
  let rejectionReason;
  let detections = 0;
  const session = createNfeScanSession({
    onDetected: () => {
      detections += 1;
    },
    onInvalid: (reason) => {
      rejectionReason = reason;
    },
  });

  assert.equal(
    session.handleDetection(`${VALID_ACCESS_KEY.slice(0, 43)}4`),
    false,
  );
  assert.equal(rejectionReason, 'INVALID_CHECK_DIGIT');
  assert.equal(detections, 0);
  assert.equal(session.isStopped(), false);
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
  assert.match(source, /accessKeyCheckDigitError/);
  assert.match(source, /aria-invalid=\{Boolean\(accessKeyCheckDigitError\)\}/);
});
