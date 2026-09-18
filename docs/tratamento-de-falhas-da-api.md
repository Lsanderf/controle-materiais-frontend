# Falhas de rede, timeout e respostas de proxy

O tratamento é compartilhado por todas as chamadas JSON e pelos downloads de
evidências. `api.js` mantém a configuração e a autenticação; `apiClient.js`
executa as requisições; `apiErrors.js` prepara mensagens públicas seguras.

## Respostas e mensagens

| Situação | Tratamento |
| --- | --- |
| JSON de erro da API, com `erro` ou `message` | Preserva mensagem pública, status HTTP, `campos` válidos e `requestId`. Isso inclui HTTP 400 e 500. |
| `Content-Type: text/html` ou XHTML | Descarta o corpo como fonte de mensagem. Não apresenta a página de erro do proxy. |
| JSON válido sem `Content-Type` | Mantém o retorno ou erro estruturado da API. |
| Texto, HTML, JSON inválido ou estrutura inesperada | Exibe a mensagem de comunicação abaixo. |
| Falha de `fetch` ou interrupção na leitura do corpo | Exibe a mensagem de comunicação, sem detalhes internos. |
| Timeout da requisição ou HTTP 408/504 sem erro estruturado da API | Exibe a mensagem específica de timeout. |
| HTTP 401 estruturado da API | Mantém o encerramento da sessão. HTML 401 do proxy não encerra a sessão. |

Mensagem de comunicação:

> Não foi possível se comunicar com o servidor. Verifique sua conexão e tente novamente.

Mensagem de timeout:

> O servidor demorou para responder. Verifique sua conexão e tente novamente.

O limite padrão é de **30 segundos**, incluindo a leitura do corpo da resposta.
`apiRequest` e `apiBlobRequest` aceitam `timeoutMs` e um `signal` opcional. O
temporizador e o listener de cancelamento são removidos ao concluir a chamada.

`ApiError.requestId` e `ApiError.details.requestId` mantêm o identificador
presente no JSON da API ou, na sua ausência, em `X-Request-Id`. O header precisa
estar acessível por CORS para o navegador conseguir lê-lo. A interface apresenta
somente mensagem e erros de campos seguros, nunca `stack`, `trace` ou o objeto
completo. A verificação também é aplicada pelo componente `ErrorMessage`.

Os downloads continuam retornando `Blob`. Páginas de proxy e respostas JSON
inesperadas são recusadas como arquivos, inclusive quando falta o tipo de
conteúdo. Nenhuma chamada de escrita é repetida automaticamente.

## Estado após falha

- Retirada e devolução: o modal de assinatura continua aberto; os botões voltam
  a funcionar; campos, assinatura e foto permanecem disponíveis para reenviar.
  A limpeza continua ocorrendo somente após uma resposta de sucesso.
- Consulta do saldo da devolução: a falha aparece como saldo indisponível,
  com ação para recarregar. A tela não converte indisponibilidade em saldo zero.
- Confirmação de NF: o rascunho permanece na tela e pode ser confirmado novamente.
- Login: usuário e senha permanecem preenchidos e o botão de entrada é liberado.
- Importação de XML: os dados e associações do formulário permanecem intactos;
  o botão de importação é liberado e o mesmo arquivo pode ser selecionado outra vez.

O frontend não consegue inferir se uma escrita foi concluída no servidor quando
a resposta se perde. As alterações tratam comunicação e apresentação; as regras
de estoque, confirmação, assinatura e validação continuam no backend existente.

## Testes

`test/apiClient.test.js` executa o cliente com `fetch` simulado e respostas reais
de `Response`: HTML 502/503/530 (Cloudflare), HTML 200/401, rede, timeout antes e
depois dos headers, JSON 400/500 e demais erros HTTP, ausência de `Content-Type`,
requestId, campos, autenticação, multipart, downloads e limpeza do temporizador.

Os cenários em `e2e/apiFailureFlows.spec.js` e `e2e/movementEvidence.spec.js`
usam a aplicação no navegador com respostas HTTP simuladas. Exercitam falhas de
proxy, rede e timeout em login, retirada, devolução, confirmação de NF e upload
de XML, conferindo a recuperação e uma nova tentativa explícita. Nas
movimentações, comparam os dados e os bytes da assinatura reenviada e da foto.
O timeout é exercitado avançando o relógio do navegador, sem esperar 30 segundos.

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm.cmd run test:e2e
```
