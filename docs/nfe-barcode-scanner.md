# Diagnóstico do scanner de NF-e

## Análise da implementação anterior

Foram analisados `NotaFiscalBarcodeScanner.jsx`, `nfeBarcode.js`, o CSS e o código
instalado de `@zxing/browser` 0.2.1 / `@zxing/library` 0.23.0 antes das alterações.

- `decodeFromVideoDevice(undefined, ...)` preferia `environment`, mas não pedia
  resolução. O navegador podia entregar poucos pixels para as barras estreitas
  de uma chave de 44 dígitos. A resolução anterior efetiva não foi medida.
- O preview vertical 3:4 com `object-fit: cover` escondia partes do frame, embora
  ZXing decodificasse o frame completo. Isso podia induzir distância/enquadramento
  ruins, sobretudo nas margens brancas laterais necessárias para CODE-128.
- Enumerar câmeras apenas preenchia a lista de troca; não havia preferência pela
  traseira principal nem tentativa de foco contínuo.
- O callback ignorava todos os erros, inclusive falhas fatais que encerram o loop.
- CODE-128 já estava explicitamente configurado; CODE-128C não é outro formato.
- Nos testes reais do decoder, a camada `MultiFormatReader` da library 0.23.0
  emitiu avisos de `NotFoundException` a cada frame vazio. O scanner agora usa
  `Code128Reader` com `BrowserCodeReader`, ambos do ZXing, e hints explícitos
  `POSSIBLE_FORMATS: [BarcodeFormat.CODE_128]`. Isso evita esses avisos sem
  interceptar o console global. Os conjuntos A, B e C continuam aceitos.
- O canvas de leitura do browser 0.2.1 era criado com as dimensões iniciais do
  vídeo. Agora é redimensionado e redesenhado quando `videoWidth/videoHeight`
  mudam, mantendo o mesmo stream e loop.

A causa provável é a combinação de resolução insuficiente e enquadramento,
eventualmente agravada por lente/foco. Isso ainda exige confirmação em aparelhos
físicos com o DANFE que apresentou a falha.

## Captura, seleção e leitura

A primeira captura solicita `audio: false`, `facingMode: { ideal: 'environment' }`,
largura ideal 1920, altura ideal 1080 e proporção ideal 16:9. Nenhum desses valores
é obrigatório. Uma resolução negociada inferior é aceita imediatamente. Se houver
`OverconstrainedError`/`ConstraintNotSatisfiedError`, a captura é tentada novamente
sem largura, altura ou proporção. Erros de permissão não disparam novas tentativas.

Depois de abrir, uma resolução abaixo de 60% dos pixels de 1920×1080 recebe
uma tentativa adicional de melhoria na mesma track, somente se as capabilities
anunciarem dimensões que possam aumentar os pixels em mais de 25%, sem reduzir
nenhuma dimensão atual. Usa `ideal`, considera orientação e não reabre o stream.
Se a tentativa falhar, a leitura continua com a resolução negociada. Não há upscale.

Após obter permissão, `enumerateDevices()` lista as câmeras. A seleção combina
`getSettings().deviceId/facingMode`, `getCapabilities().facingMode` e pistas dos
labels: favorece traseira/principal, penaliza frontal, ultra-wide, teleobjetiva,
macro e profundidade. Com labels vazios ou genéricos, conserva a traseira já
confirmada pela track. Em empate, conserva a câmera ativa. Não há uma API padrão
que identifique universalmente a lente principal de todo iPhone/Android; por isso,
essa escolha é uma heurística e o botão **Trocar câmera** continua disponível.

Uma troca automática fecha o primeiro stream antes de abrir o próximo. Caso a
opção preferida esteja indisponível, tenta recuperar a câmera anterior. A troca
manual solicita o `deviceId` ideal, sem competir com `facingMode`. A seleção
efetiva sempre vem da track: navegadores podem ignorar preferências `ideal`.

Foco, exposição e balanço de branco recebem `continuous` em constraints opcionais
`advanced` somente quando a capability correspondente anunciar esse valor.
Cada modo é tentado separadamente; uma rejeição não impede os demais nem a leitura.
O log informa o modo solicitado e o efetivo, quando exposto. Todas as mudanças da
track são serializadas e preservam resolução e controles aplicados anteriormente.

**Ativar lanterna / Desativar lanterna** aparece apenas quando `torch` é anunciado
como suportado. A falha recebe uma mensagem não fatal, mantendo a leitura.
O estado efetivo da track é consultado quando disponível. Encerrar a câmera também
encerra o uso da lanterna. O controle **Zoom** só aparece para um intervalo ajustável;
respeita `min/max/step` e limita o máximo a até três vezes a base do intervalo
(tipicamente 1–3×). Não aproxima automaticamente. Ajustes do slider são agrupados
por 180 ms e não sobrevivem à troca/cancelamento da sessão.

O preview preserva as proporções intrínsecas do vídeo e mostra o frame completo.
A guia horizontal usa 96% da largura do preview, que ocupa quase toda a largura
disponível em celular vertical. O decoder prioriza a faixa central delimitada pela
guia. A ROI é calculada usando as posições reais da guia e do vídeo, considerando
`object-fit: contain`, eventuais margens vazias e as dimensões nativas. Inclui 2%
extras da largura nativa em cada lado da guia para proteger as quiet zones — no
layout atual, a faixa conserva toda a largura da imagem. Não cria margens brancas
falsas para substituir quiet zones ausentes no enquadramento.

A cada seis tentativas, executa: ROI normal, ROI normal, ROI girada −8°, ROI normal,
ROI girada +8° e frame completo. Cada tentativa faz **um único decode síncrono**,
sem concorrência. As rotações ampliam o canvas necessário para não cortar os cantos;
não ampliam os pixels da câmera. O fallback de frame inteiro permite encontrar um
código fora da guia. CSS e ROI acompanham a orientação sem reiniciar a câmera.

O loop do `@zxing/browser` aguarda o fim do decode antes de agendar o próximo.
A pausa mínima passou de 250 para 160 ms (teto teórico de aproximadamente seis
tentativas/s); quando o decode demora, a pausa aumenta para duas vezes a duração,
até 1000 ms. Após detectar conteúdo, preserva a pausa de 400 ms. Os logs agregados
permitem medir o custo em cada celular sem registrar frames. Não foram adicionados
OCR, filtros pesados ou processamento de imagens em servidor.

O ZXing já faz a conversão para tons de cinza e binarização. Não duplicamos esse
trabalho nem aplicamos contraste artificial, que pode amplificar ruído e reflexos.
A intervenção leve é o crop e a rotação ocasional da ROI. Os testes sintéticos com
contraste reduzido passaram usando esse processamento. A conversão nativa está na
[implementação do ZXing](https://github.com/zxing-js/browser/blob/master/src/common/HTMLCanvasElementLuminanceSource.ts).

As dicas alternam a cada cinco segundos e são identificadas como **Dica**:
“Aproxime um pouco”, “Afaste um pouco”, “Evite reflexos” e, com torch disponível
e desligado, “Use a lanterna se necessário”. São sugestões de enquadramento;
não há alegação de que o sistema mediu distância, foco, iluminação ou reflexos.

Frames sem código (`NotFoundException`), checksum de barras inválido e formato
ilegível continuam tentando. Falhas fatais mostram erro e liberam o stream.
As validações de 44 dígitos e DV, a liberação da câmera e a proteção contra
callbacks duplicados permanecem ativas.

## Logs em desenvolvimento

Execute `npm run dev` e use o HTTPS de desenvolvimento já configurado para o
celular. O console deve incluir o nível **Debug/Verbose**. Filtre por
`[NF-e scanner]`:

- `selected camera`: label, deviceId solicitado, constraints usadas e settings
  efetivos, incluindo resolução e facingMode quando disponíveis;
- `resolution fallback` / `camera selection fallback`: negociação alternativa;
- `track capabilities` e `continuous camera mode`: suporte e tentativas dos modos;
- `resolution improvement`: resolução anterior, solicitação adicional e resultado;
- `optional camera control unavailable`: falha não fatal de controle;
- `video dimensions`: `videoWidth/videoHeight` e tamanho do elemento na tela;
- `decoded barcode`: formato, `textLength`, `digits` (texto normalizado),
  resultado da validação;
- `fatal camera/ZXing error`: exceção fatal para diagnóstico.
- `decode performance`: a cada cinco segundos, quantidade de tentativas, duração
  média/máxima, pausa atual, estratégia, ROI e dimensões nativas.

Os logs da aplicação são removidos pelo build de produção. Nenhuma imagem/frame
é persistida ou enviada; o canvas de decodificação é temporário e fica em memória.

## Imagem conhecida: isolar o decoder

No console do navegador conectado ao Vite de desenvolvimento, execute:

```js
const { diagnoseNfeBarcodeImage } = await import('/src/dev/nfeBarcodeDiagnostic.js');
await diagnoseNfeBarcodeImage();
```

Resultado esperado: `format: 'CODE_128'`, `textLength: 44`,
`digits: '52060433009911002506550120000007800267301615'`, `isValid: true`.

A fixture em `test/fixtures/nfe-code128c.svg` contém uma chave sintética com DV
válido, início do conjunto C (105), checksum CODE-128 13, stop 106 e margens
brancas de 12 módulos em cada lado. Suas dimensões são 1204×192.

O utilitário também recebe uma URL local de desenvolvimento ou um elemento
`HTMLImageElement` já carregado:

```js
await diagnoseNfeBarcodeImage('/test/fixtures/minha-imagem.png');
```

Ele usa a mesma fábrica de decoder do scanner, sem acessar câmera ou formulário.
A imagem estática usa toda a imagem; a ROI e a alternância de inclinação dependem
da guia/vídeo e são verificadas pelos testes de streaming no navegador.
Não há rota, upload nem importação desse utilitário no produto. O build não inclui
o utilitário nem a fixture. Se a fixture passa e a câmera falha com o mesmo código
impresso/exibido em outra tela, investigue resolução, foco, luz e enquadramento.
Se somente uma imagem específica falha, examine suas margens e qualidade.

## Teste físico no iPhone / Safari

1. Abra a URL **HTTPS** do Vite no Safari do iPhone. Entre no sistema e vá a
   **Notas fiscais → Nova nota fiscal → Escanear código de barras**.
2. Permita acesso à câmera. Aguarde **Procurando código...**. Sem código na imagem,
   deixe aberto por 10 segundos: a câmera deve continuar ativa, sem alerta.
3. Com luz uniforme e sem reflexo sobre o DANFE, mantenha as barras horizontais na
   guia. Siga a instrução: **Aproxime ou afaste até que todo o código de barras
   apareça dentro da área, incluindo as margens laterais.** Faça ajustes pequenos
   e aguarde o foco estabilizar. Não cubra as margens brancas laterais.
4. Confirme que a chave de 44 dígitos preenche o campo uma vez, o modal fecha e o
   indicador de uso da câmera se apaga. O preenchimento não salva a NF sozinho.
5. Reabra o scanner, desative o bloqueio de rotação e gire o aparelho para
   horizontal **enquanto procura**, antes de posicionar o código. Leia novamente.
   Reabra e repita de horizontal para vertical. A rotação não deve pedir permissão
   novamente nem reabrir continuamente a câmera.
6. Reabra, use **Trocar câmera** e compare nitidez/distância. Cancele e confirme
   que a câmera é liberada. Reabra e repita a leitura com a traseira principal.
7. Para obter logs, habilite **Inspetor Web** em **Ajustes → Apps → Safari →
   Avançado** (em versões antigas, Safari aparece diretamente em Ajustes). Conecte
   o iPhone a um Mac, confie no computador e habilite os recursos de desenvolvimento
   no Safari do Mac. Em **Desenvolvimento → [iPhone] → [página HTTPS]**, abra o
   Console. Execute o teste de imagem e registre os campos de resolução/câmera/foco.
   Referências: [WebKit](https://webkit.org/web-inspector/enabling-web-inspector/)
   e [Apple](https://developer.apple.com/documentation/safari-developer-tools/inspecting-ios).

## Teste físico no Android / Chrome

1. Abra a mesma URL **HTTPS** no Chrome do Android. Entre em **Notas fiscais →
   Nova nota fiscal → Escanear código de barras** e permita a câmera.
2. Execute os passos de enquadramento, espera sem código, leitura, rotação,
   troca e cancelamento descritos nos itens 2–6 do teste de iPhone.
3. Para obter logs, ative as **Opções do desenvolvedor → Depuração USB** no Android,
   conecte-o ao computador e aceite a autorização de depuração no aparelho.
4. No Chrome do computador, abra `chrome://inspect/#devices`, habilite
   **Discover USB devices** e clique em **Inspect** na aba HTTPS do celular.
   No Console, inclua o nível **Verbose**, filtre `[NF-e scanner]` e execute o
   teste de imagem. Consulte a [documentação do Chrome](https://developer.chrome.com/docs/devtools/remote-debugging/).

Em ambos, teste também um CODE-128 curto: deve mostrar **Código detectado, mas não
corresponde a uma chave NF-e.** Um código com 44 dígitos e DV errado deve manter
a mensagem de DV inválido. Em seguida, um DANFE válido deve ser aceito sem reabrir.
Registre modelo, versão do sistema/navegador, orientação, câmera efetiva,
resolução solicitada, `settings.width/height`, `videoWidth/videoHeight`, foco
exposto e tempo aproximado até a leitura. Repita cada orientação três vezes.

Para verificar a robustez, repita com luz ambiente moderada e inclinação pequena
para ambos os lados. Quando oferecida, ligue/desligue a lanterna e confira se houve
melhora ou reflexo. Ajuste o zoom gradualmente, preservando todo o código e as
margens. Repita com zoom inicial; verifique que uma falha de controle não encerra
o scanner. Ao trocar de câmera, capacidades e controles devem acompanhar a nova
track. Ao cancelar com a lanterna ligada, confirme que câmera e luz são desligadas.
Registre `decode performance` e tempo até leitura; os testes de desktop não medem
consumo de bateria, CPU ou qualidade óptica de um iPhone/Android físico.

## Verificação automatizada

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm.cmd run test:e2e -- e2e/nfeBarcodeScanner.spec.js e2e/notaFiscalMaterial.spec.js
```

Os testes usam o ZXing real para imagens e para frames de um MediaStream criado
por canvas. Permissão, enumeração, capacidades e foco da câmera são simulados.
Cobrem negociação/fallback, seleção traseira, foco opcional, CODE-128 A/B/C,
frames vazios e continuidade, mensagens de chave inválida, troca, cancelamento,
stream tardio, erro fatal, mudança intrínseca do vídeo e regressão do formulário.

Na revisão inicial passaram 82 testes unitários e 42 testes de navegador,
incluindo regressão do formulário. A revisão de robustez adiciona cobertura para
torch, exposição/balanço, zoom, preservação/serialização das constraints, melhoria
opcional da resolução, ROI com letterbox/orientação, estratégias de decode,
falhas de controles e inclinações ±8° com contraste reduzido. Os cenários de
inclinação usam uma imagem sintética com barras de altura reduzida e opacidade
0,3 sobre branco; isso não simula todas as condições de pouca luz ou reflexo.
Resultado final da revisão de robustez: **94 testes unitários e 54 testes de
navegador passaram** (Chrome desktop e perfil mobile Pixel 7, incluindo o formulário
de NF-e). Lint e build passaram; o build foi verificado sem logs da aplicação nem
utilitário/imagem de diagnóstico.
No teste de captura, foram solicitados **1920×1080** e recebidos **1280×720** do
stream simulado. Após a troca das dimensões, o vídeo efetivo foi **720×1280** e a
leitura continuou sem reabertura. O teste unitário também aceita **640×480**.
Isso não mede uma câmera física nem valida Safari/WebKit: a resolução e a taxa de
sucesso reais de iPhone/Android ainda devem ser registradas pelo procedimento acima.
