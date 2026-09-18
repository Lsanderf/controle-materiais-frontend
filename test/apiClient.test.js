import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/services/apiClient.js';
import {
  ApiError, CONNECTION_ERROR_MESSAGE, TIMEOUT_ERROR_MESSAGE, safeErrorText,
} from '../src/services/apiErrors.js';

const HTML = '<!DOCTYPE html><html><body>Cloudflare Tunnel error 1033</body></html>';
const STACK = 'java.lang.IllegalStateException: private database\n\tat com.app.Service.save(Service.java:42)';

function setup(t, fetchImpl) {
  const onUnauthorized = t.mock.fn();
  const client = createApiClient({
    baseUrl: 'https://api.test', readAuth: () => ({ token: 'token' }), onUnauthorized,
  });
  const fetchMock = t.mock.method(globalThis, 'fetch', fetchImpl);
  return { ...client, fetchMock, onUnauthorized };
}

function response(body, status = 200, contentType = 'application/json') {
  const result = new Response(body, { status });
  if (contentType) result.headers.set('Content-Type', contentType);
  else result.headers.delete('Content-Type');
  return result;
}

function errorMatches(message, status) {
  return (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.message, message);
    assert.equal(error.status, status);
    assert.doesNotMatch(JSON.stringify(error.details), /DOCTYPE|Cloudflare|IllegalStateException/);
    return true;
  };
}

for (const method of ['apiRequest', 'apiBlobRequest']) {
  for (const status of [502, 503, 530, 200, 401]) {
    test(`${method}: HTML ${status} não aparece nem invalida a sessão`, async (t) => {
      const client = setup(t, async () => response(HTML, status, 'text/html; charset=utf-8'));
      await assert.rejects(client[method]('/recurso'), errorMatches(CONNECTION_ERROR_MESSAGE, status));
      assert.equal(client.onUnauthorized.mock.callCount(), 0);
      assert.equal(client.fetchMock.mock.callCount(), 1);
    });
  }

  test(`${method}: falha de rede tem mensagem amigável e não repete a operação`, async (t) => {
    const client = setup(t, async () => { throw new TypeError('Failed to fetch\n at internal:42'); });
    await assert.rejects(client[method]('/recurso'), errorMatches(CONNECTION_ERROR_MESSAGE, 0));
    assert.equal(client.fetchMock.mock.callCount(), 1);
    assert.equal(client.onUnauthorized.mock.callCount(), 0);
  });

  test(`${method}: timeout aborta o fetch e libera a solicitação`, async (t) => {
    const client = setup(t, (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    await assert.rejects(client[method]('/recurso', { timeoutMs: 5 }), errorMatches(TIMEOUT_ERROR_MESSAGE, 0));
    assert.equal(client.fetchMock.mock.calls[0].arguments[1].signal.aborted, true);
    assert.equal(client.fetchMock.mock.callCount(), 1);
  });

  test(`${method}: timeout também cobre a leitura do corpo após os headers`, async (t) => {
    const client = setup(t, async (_url, { signal }) => {
      const stream = new ReadableStream({
        start(controller) {
          signal.addEventListener('abort', () => controller.error(signal.reason), { once: true });
        },
      });
      return new Response(stream, { headers: { 'Content-Type': method === 'apiRequest' ? 'application/json' : 'image/png' } });
    });
    await assert.rejects(client[method]('/recurso', { timeoutMs: 5 }), errorMatches(TIMEOUT_ERROR_MESSAGE, 0));
  });

  for (const status of [400, 401, 403, 409, 500, 503, 504]) {
    test(`${method}: JSON ${status} da API preserva mensagem, campos, status e requestId`, async (t) => {
      const body = {
        status, erro: status === 400 ? 'Dados inválidos' : 'Não foi possível concluir a operação',
        campos: { quantidade: 'Informe uma quantidade válida.' }, requestId: 'req-api-123',
        dataHora: '14/09/2026 12:00',
      };
      const client = setup(t, async () => response(JSON.stringify(body), status));
      await assert.rejects(client[method]('/recurso'), (error) => {
        assert.equal(error.message, body.erro);
        assert.equal(error.status, status);
        assert.equal(error.requestId, body.requestId);
        assert.deepEqual(error.fields, body.campos);
        assert.deepEqual(error.details, body);
        return true;
      });
      assert.equal(client.onUnauthorized.mock.callCount(), status === 401 ? 1 : 0);
    });
  }

  test(`${method}: JSON válido sem Content-Type mantém o erro da API`, async (t) => {
    const client = setup(t, async () => response(JSON.stringify({ erro: 'Quantidade inválida', requestId: 'req-no-type' }), 400, null));
    await assert.rejects(client[method]('/recurso'), (error) => {
      assert.equal(error.message, 'Quantidade inválida');
      assert.equal(error.requestId, 'req-no-type');
      assert.equal(error.status, 400);
      return true;
    });
  });

  for (const body of [HTML, STACK, 'upstream connection refused', '{invalid json', JSON.stringify({ error: 'Bad Gateway', code: 1033 })]) {
    test(`${method}: resposta inesperada sem Content-Type é segura (${body.slice(0, 24)})`, async (t) => {
      const client = setup(t, async () => response(body, 503, null));
      await assert.rejects(client[method]('/recurso'), errorMatches(CONNECTION_ERROR_MESSAGE, 503));
    });
  }
}

test('JSON 500 descarta trace/stack e campos inseguros, mantendo mensagem pública e requestId do header', async (t) => {
  const client = setup(t, async () => {
    const result = response(JSON.stringify({
      erro: 'Ocorreu um erro interno inesperado', trace: STACK, stack: STACK,
      campos: { nome: 'Nome obrigatório', descricao: HTML, interno: STACK, objeto: { message: HTML } },
    }), 500);
    result.headers.set('X-Request-Id', 'req-header-123');
    return result;
  });
  await assert.rejects(client.apiRequest('/recurso'), (error) => {
    assert.equal(error.message, 'Ocorreu um erro interno inesperado');
    assert.equal(error.requestId, 'req-header-123');
    assert.deepEqual(error.fields, { nome: 'Nome obrigatório' });
    assert.equal(error.details.trace, undefined);
    assert.equal(error.details.stack, undefined);
    return true;
  });
});

test('HTML, stack ou mensagem de proxy dentro de JSON nunca viram mensagem pública', async (t) => {
  for (const message of [HTML, STACK, 'Cloudflare Tunnel error 1033']) {
    const client = setup(t, async () => response(JSON.stringify({ message }), 500));
    await assert.rejects(client.apiRequest('/recurso'), errorMatches(CONNECTION_ERROR_MESSAGE, 500));
  }
});

test('mensagem insegura da API é substituída preservando requestId e status', async (t) => {
  const client = setup(t, async () => response(JSON.stringify({ erro: STACK, status: 500, requestId: 'req-stack' }), 500));
  await assert.rejects(client.apiRequest('/recurso'), (error) => {
    assert.equal(error.message, CONNECTION_ERROR_MESSAGE);
    assert.equal(error.requestId, 'req-stack');
    assert.equal(error.status, 500);
    assert.doesNotMatch(JSON.stringify(error.details), /IllegalStateException/);
    return true;
  });
});

test('erro estruturado no campo message mantém a mensagem existente', async (t) => {
  const client = setup(t, async () => response(JSON.stringify({ message: 'Arquivo inválido', requestId: 'req-message' }), 400));
  await assert.rejects(client.apiRequest('/recurso'), { message: 'Arquivo inválido', requestId: 'req-message', status: 400 });
});

test('JSON de proxy com status 200 não é tratado como sucesso', async (t) => {
  const client = setup(t, async () => response('{"message":"Cloudflare Tunnel error 1033"}'));
  await assert.rejects(client.apiRequest('/recurso'), errorMatches(CONNECTION_ERROR_MESSAGE, 200));
});

test('falha durante leitura do corpo recebe tratamento de rede', async (t) => {
  const client = setup(t, async () => new Response(new ReadableStream({
    start(controller) { controller.error(new TypeError('connection reset')); },
  })));
  await assert.rejects(client.apiRequest('/recurso'), errorMatches(CONNECTION_ERROR_MESSAGE, 0));
});

test('timeout externo e HTTP 504 inesperado possuem mensagem de timeout', async (t) => {
  const client = setup(t, async () => { throw new DOMException('internal details', 'TimeoutError'); });
  await assert.rejects(client.apiRequest('/recurso'), errorMatches(TIMEOUT_ERROR_MESSAGE, 0));
  client.fetchMock.mock.mockImplementation(async () => response(HTML, 504, 'text/html'));
  await assert.rejects(client.apiRequest('/recurso'), errorMatches(TIMEOUT_ERROR_MESSAGE, 504));
});

test('JSON de sucesso com ou sem Content-Type e HTTP 204 mantêm os retornos', async (t) => {
  const client = setup(t, async () => response('[{"id":1}]', 200, null));
  assert.deepEqual(await client.apiRequest('/materiais'), [{ id: 1 }]);
  client.fetchMock.mock.mockImplementation(async () => response('{"id":2}', 201));
  assert.deepEqual(await client.apiRequest('/materiais'), { id: 2 });
  client.fetchMock.mock.mockImplementation(async () => new Response(null, { status: 204 }));
  assert.equal(await client.apiRequest('/recurso'), null);
});

test('imagem permanece binária; HTML de sucesso sem tipo não vira evidência', async (t) => {
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN2kAAAAASUVORK5CYII=', 'base64');
  const client = setup(t, async () => response(bytes, 200, 'image/png'));
  assert.deepEqual(Buffer.from(await (await client.apiBlobRequest('/arquivo')).arrayBuffer()), bytes);
  client.fetchMock.mock.mockImplementation(async () => response(HTML, 200, null));
  await assert.rejects(client.apiBlobRequest('/arquivo'), errorMatches(CONNECTION_ERROR_MESSAGE, 200));
});

test('autenticação, payload JSON e multipart são preservados; login 401 não invalida sessão', async (t) => {
  const client = setup(t, async () => response('{"id":1}'));
  await client.apiRequest('/materiais', { method: 'POST', body: { nome: 'Cabo' }, headers: { 'X-Custom': 'value' } });
  const [url, options] = client.fetchMock.mock.calls[0].arguments;
  assert.equal(url, 'https://api.test/materiais');
  assert.equal(options.headers.get('Authorization'), 'Bearer token');
  assert.equal(options.headers.get('Content-Type'), 'application/json');
  assert.equal(options.headers.get('X-Custom'), 'value');
  assert.equal(options.body, '{"nome":"Cabo"}');
  const body = new FormData();
  body.append('arquivo', new Blob(['xml']), 'nota.xml');
  await client.apiRequest('/importar-xml', { method: 'POST', body });
  assert.equal(client.fetchMock.mock.calls[1].arguments[1].body, body);
  assert.equal(client.fetchMock.mock.calls[1].arguments[1].headers.has('Content-Type'), false);
  client.fetchMock.mock.mockImplementation(async () => response('{"erro":"Credenciais inválidas"}', 401));
  await assert.rejects(client.apiRequest('/auth/login', { auth: false }), { message: 'Credenciais inválidas' });
  assert.equal(client.onUnauthorized.mock.callCount(), 0);
  assert.equal(client.fetchMock.mock.calls[2].arguments[1].headers.has('Authorization'), false);
});

test('timer é limpo após sucesso e sinal externo continua funcionando', async (t) => {
  const controller = new AbortController();
  const client = setup(t, async () => response('{}'));
  await client.apiRequest('/recurso', { signal: controller.signal, timeoutMs: 5 });
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(client.fetchMock.mock.calls[0].arguments[1].signal.aborted, false);
  client.fetchMock.mock.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  const request = client.apiRequest('/recurso', { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, { message: 'A solicitação foi cancelada. Tente novamente.' });
});

test('renderização de erros locais também recusa HTML, stack, objetos e conteúdo de proxy', () => {
  for (const value of [HTML, STACK, '&lt;html&gt;erro&lt;/html&gt;', 'Error: secret\n at foo.js:2', { message: HTML }]) {
    assert.equal(safeErrorText(value), CONNECTION_ERROR_MESSAGE);
  }
  assert.equal(safeErrorText('A quantidade deve ser maior que 0.'), 'A quantidade deve ser maior que 0.');
  assert.equal(new ApiError('Dados inválidos', 400).requestId, undefined);
});
